#!/usr/bin/env node
/**
 * X Reply Drafter - Full Engagement Pipeline
 * 
 * 1. Fetches user's recent replies from X API
 * 2. Reads saved drafts from the drafts log
 * 3. Matches drafts → actual posted replies (text similarity)
 * 4. Tracks engagement on matched replies over time
 * 5. Builds performance analytics for optimization
 * 
 * Usage: node track-engagement.mjs [--once] [--interval 300] [--username charlesmcdowell]
 */

import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DATA_DIR = join(homedir(), '.openclaw', 'workspace', 'x-reply-drafter', 'data');
const DRAFTS_FILE = join(DATA_DIR, 'drafts.json');
const TRACKING_FILE = join(DATA_DIR, 'tracking.json');
const ANALYTICS_FILE = join(DATA_DIR, 'analytics.json');
const CONFIG_PATH = join(homedir(), '.clawdbot', 'secrets', 'x-api-charles.json');

// Parse args
const args = process.argv.slice(2);
const once = args.includes('--once');
const intervalIdx = args.indexOf('--interval');
const intervalSec = intervalIdx >= 0 ? parseInt(args[intervalIdx + 1]) || 300 : 300;
const usernameIdx = args.indexOf('--username');
const username = usernameIdx >= 0 ? args[usernameIdx + 1] : 'charlesmcdowell';

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function saveJSON(path, data) {
  ensureDir();
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/** Jaccard similarity on words */
function similarity(a, b) {
  if (!a || !b) return 0;
  const wa = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const intersection = [...wa].filter(x => wb.has(x)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error('X API config not found at', CONFIG_PATH);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

async function run() {
  const config = loadConfig();
  const client = new TwitterApi({
    appKey: config.consumerKey,
    appSecret: config.consumerSecret,
    accessToken: config.accessToken,
    accessSecret: config.accessTokenSecret,
  });

  // Load data
  const drafts = loadJSON(DRAFTS_FILE, []);
  const tracking = loadJSON(TRACKING_FILE, { 
    matches: [],       // draft → reply linkages
    replies: [],       // all tracked replies with engagement history
    lastFetch: 0,
    totalDrafts: 0,
    totalMatched: 0,
  });

  // Get user ID
  const user = await client.v2.userByUsername(username);
  if (!user.data) {
    console.error('User not found:', username);
    return;
  }
  const userId = user.data.id;

  // Fetch recent replies (last 7 days)
  const since = new Date();
  since.setDate(since.getDate() - 7);
  
  let allReplies = [];
  try {
    const timeline = await client.v2.userTimeline(userId, {
      max_results: 100,
      'tweet.fields': ['created_at', 'public_metrics', 'referenced_tweets', 'in_reply_to_user_id', 'conversation_id'],
      exclude: ['retweets'],
      start_time: since.toISOString(),
    });

    if (timeline.data?.data) {
      allReplies = timeline.data.data.filter(t => 
        t.referenced_tweets?.some(ref => ref.type === 'replied_to')
      );
    }
  } catch (err) {
    console.error('Error fetching timeline:', err.message);
    return;
  }

  console.log(`Found ${allReplies.length} replies in last 7 days, ${drafts.length} saved drafts`);

  // --- STEP 1: Match unlinked drafts to posted replies ---
  let newMatches = 0;
  const matchedReplyIds = new Set(tracking.matches.map(m => m.replyTweetId));
  
  for (const draft of drafts) {
    // Skip if this draft is already matched
    if (tracking.matches.some(m => m.draftId === draft.id)) continue;

    // Find best matching reply by text similarity
    const candidates = allReplies
      .filter(r => !matchedReplyIds.has(r.id)) // Don't double-match
      .map(reply => ({
        reply,
        score: similarity(draft.replyText, reply.text),
      }))
      .filter(m => m.score > 0.35) // 35% word overlap threshold
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const best = candidates[0];
      const parentTweetId = best.reply.referenced_tweets?.find(r => r.type === 'replied_to')?.id;
      
      const match = {
        draftId: draft.id,
        replyTweetId: best.reply.id,
        parentTweetId: parentTweetId || draft.postId,
        parentAuthor: draft.postAuthor,
        draftText: draft.replyText,
        postedText: best.reply.text,
        matchScore: Math.round(best.score * 100),
        tone: draft.tone,
        promptId: draft.promptId,
        draftedAt: draft.timestamp,
        postedAt: best.reply.created_at,
        model: draft.model || 'unknown',
      };
      
      tracking.matches.push(match);
      matchedReplyIds.add(best.reply.id);
      newMatches++;
      console.log(`  Matched: "${draft.replyText.slice(0, 50)}..." → tweet ${best.reply.id} (${match.matchScore}%)`);
    }
  }

  // --- STEP 2: Fetch engagement for ALL matched replies ---
  const replyIds = tracking.matches.map(m => m.replyTweetId);
  
  if (replyIds.length > 0) {
    console.log(`Fetching engagement for ${replyIds.length} tracked replies...`);
    
    for (let i = 0; i < replyIds.length; i += 100) {
      const batch = replyIds.slice(i, i + 100);
      try {
        const response = await client.v2.tweets(batch, {
          'tweet.fields': ['public_metrics', 'created_at'],
        });
        
        if (response.data) {
          for (const tweet of response.data) {
            const m = tweet.public_metrics || {};
            const match = tracking.matches.find(mt => mt.replyTweetId === tweet.id);
            if (match) {
              // Store current engagement
              match.engagement = {
                likes: m.like_count || 0,
                retweets: m.retweet_count || 0,
                replies: m.reply_count || 0,
                impressions: m.impression_count || 0,
                quotes: m.quote_count || 0,
                bookmarks: m.bookmark_count || 0,
                lastChecked: Date.now(),
              };
              
              // Store engagement history (for trend tracking)
              if (!match.engagementHistory) match.engagementHistory = [];
              match.engagementHistory.push({
                t: Date.now(),
                l: m.like_count || 0,
                rt: m.retweet_count || 0,
                r: m.reply_count || 0,
                i: m.impression_count || 0,
              });
              // Keep last 50 snapshots per reply
              if (match.engagementHistory.length > 50) {
                match.engagementHistory = match.engagementHistory.slice(-50);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching engagement batch:', err.message);
      }
    }
  }

  // --- STEP 3: Build analytics ---
  const analytics = buildAnalytics(tracking);
  
  // Save everything
  tracking.lastFetch = Date.now();
  tracking.totalDrafts = drafts.length;
  tracking.totalMatched = tracking.matches.length;
  
  saveJSON(TRACKING_FILE, tracking);
  saveJSON(ANALYTICS_FILE, analytics);
  
  console.log(`\nDone. ${newMatches} new matches. ${tracking.matches.length} total tracked.`);
  if (analytics.topPerformers.length > 0) {
    console.log(`\nTop performer: "${analytics.topPerformers[0].text.slice(0, 60)}..." (${analytics.topPerformers[0].impressions} impressions, ${analytics.topPerformers[0].likes} likes)`);
  }
  console.log(`\nAnalytics:`);
  console.log(`  Avg impressions: ${analytics.avgImpressions}`);
  console.log(`  Avg likes: ${analytics.avgLikes}`);
  console.log(`  Avg engagement rate: ${analytics.avgEngagementRate}%`);
  if (analytics.bestTone) console.log(`  Best tone: ${analytics.bestTone.tone} (${analytics.bestTone.avgEngagement} avg engagement)`);
}

function buildAnalytics(tracking) {
  const matches = tracking.matches.filter(m => m.engagement);
  
  if (matches.length === 0) {
    return {
      totalTracked: 0,
      avgImpressions: 0,
      avgLikes: 0,
      avgEngagementRate: 0,
      topPerformers: [],
      worstPerformers: [],
      byTone: {},
      bestTone: null,
      byModel: {},
      bestModel: null,
      byParentAuthor: {},
      recentTrend: null,
    };
  }

  // Basic averages
  const totalImpressions = matches.reduce((s, m) => s + (m.engagement.impressions || 0), 0);
  const totalLikes = matches.reduce((s, m) => s + (m.engagement.likes || 0), 0);
  const totalRetweets = matches.reduce((s, m) => s + (m.engagement.retweets || 0), 0);
  const totalReplies = matches.reduce((s, m) => s + (m.engagement.replies || 0), 0);

  const avgImpressions = Math.round(totalImpressions / matches.length);
  const avgLikes = Math.round((totalLikes / matches.length) * 10) / 10;
  const avgEngagementRate = totalImpressions > 0 
    ? Math.round(((totalLikes + totalRetweets + totalReplies) / totalImpressions) * 10000) / 100
    : 0;

  // Sort by total engagement
  const scored = matches.map(m => ({
    replyTweetId: m.replyTweetId,
    text: m.postedText || m.draftText,
    parentAuthor: m.parentAuthor,
    tone: m.tone,
    model: m.model,
    likes: m.engagement.likes || 0,
    retweets: m.engagement.retweets || 0,
    replies: m.engagement.replies || 0,
    impressions: m.engagement.impressions || 0,
    engagementRate: m.engagement.impressions > 0
      ? Math.round(((m.engagement.likes + m.engagement.retweets + m.engagement.replies) / m.engagement.impressions) * 10000) / 100
      : 0,
    postedAt: m.postedAt,
  })).sort((a, b) => (b.likes + b.retweets + b.replies) - (a.likes + a.retweets + a.replies));

  // By tone
  const byTone = {};
  for (const m of scored) {
    const t = m.tone || 'unknown';
    if (!byTone[t]) byTone[t] = { count: 0, totalLikes: 0, totalImpressions: 0, totalEngagement: 0 };
    byTone[t].count++;
    byTone[t].totalLikes += m.likes;
    byTone[t].totalImpressions += m.impressions;
    byTone[t].totalEngagement += m.likes + m.retweets + m.replies;
  }
  for (const t of Object.keys(byTone)) {
    byTone[t].avgLikes = Math.round((byTone[t].totalLikes / byTone[t].count) * 10) / 10;
    byTone[t].avgEngagement = Math.round((byTone[t].totalEngagement / byTone[t].count) * 10) / 10;
    byTone[t].avgImpressions = Math.round(byTone[t].totalImpressions / byTone[t].count);
  }
  const bestTone = Object.entries(byTone)
    .filter(([_, v]) => v.count >= 2)
    .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)[0];

  // By model
  const byModel = {};
  for (const m of scored) {
    const mod = m.model || 'unknown';
    if (!byModel[mod]) byModel[mod] = { count: 0, totalLikes: 0, totalEngagement: 0 };
    byModel[mod].count++;
    byModel[mod].totalLikes += m.likes;
    byModel[mod].totalEngagement += m.likes + m.retweets + m.replies;
  }
  for (const mod of Object.keys(byModel)) {
    byModel[mod].avgLikes = Math.round((byModel[mod].totalLikes / byModel[mod].count) * 10) / 10;
    byModel[mod].avgEngagement = Math.round((byModel[mod].totalEngagement / byModel[mod].count) * 10) / 10;
  }
  const bestModel = Object.entries(byModel)
    .filter(([_, v]) => v.count >= 2)
    .sort(([_, a], [__, b]) => b.avgEngagement - a.avgEngagement)[0];

  // By parent author (which accounts get best engagement when you reply)
  const byParentAuthor = {};
  for (const m of scored) {
    const author = m.parentAuthor || 'unknown';
    if (!byParentAuthor[author]) byParentAuthor[author] = { count: 0, totalEngagement: 0, totalImpressions: 0 };
    byParentAuthor[author].count++;
    byParentAuthor[author].totalEngagement += m.likes + m.retweets + m.replies;
    byParentAuthor[author].totalImpressions += m.impressions;
  }
  for (const a of Object.keys(byParentAuthor)) {
    byParentAuthor[a].avgEngagement = Math.round((byParentAuthor[a].totalEngagement / byParentAuthor[a].count) * 10) / 10;
    byParentAuthor[a].avgImpressions = Math.round(byParentAuthor[a].totalImpressions / byParentAuthor[a].count);
  }

  return {
    totalTracked: matches.length,
    avgImpressions,
    avgLikes,
    avgEngagementRate,
    topPerformers: scored.slice(0, 10),
    worstPerformers: scored.slice(-5).reverse(),
    byTone,
    bestTone: bestTone ? { tone: bestTone[0], ...bestTone[1] } : null,
    byModel,
    bestModel: bestModel ? { model: bestModel[0], ...bestModel[1] } : null,
    byParentAuthor,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  if (once) {
    await run();
  } else {
    console.log(`Starting engagement tracker (interval: ${intervalSec}s, user: @${username})`);
    await run();
    setInterval(run, intervalSec * 1000);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
