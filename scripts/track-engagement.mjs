#!/usr/bin/env node
/**
 * X Reply Engagement Tracker
 * 
 * 1. Fetches user's recent replies from X API
 * 2. Matches them to saved drafts (by text similarity)
 * 3. Tracks real engagement metrics on those replies
 * 4. Saves everything to a local JSON file
 * 
 * Usage: node track-engagement.mjs [--once] [--interval 300] [--username charlesmcdowell]
 */

import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

const DATA_DIR = join(homedir(), '.openclaw', 'workspace', 'x-reply-drafter', 'data');
const DATA_FILE = join(DATA_DIR, 'replies.json');
const CONFIG_PATH = join(homedir(), '.clawdbot', 'secrets', 'x-api-charles.json');

// Parse args
const args = process.argv.slice(2);
const once = args.includes('--once');
const intervalIdx = args.indexOf('--interval');
const intervalSec = intervalIdx >= 0 ? parseInt(args[intervalIdx + 1]) || 300 : 300;
const usernameIdx = args.indexOf('--username');
const username = usernameIdx >= 0 ? args[usernameIdx + 1] : 'charlesmcdowell';

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error('X API config not found at', CONFIG_PATH);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function loadData() {
  if (!existsSync(DATA_FILE)) return { drafts: [], replies: [], lastFetch: 0 };
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch { return { drafts: [], replies: [], lastFetch: 0 }; }
}

function saveData(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/** Simple text similarity (Jaccard on words) */
function similarity(a, b) {
  if (!a || !b) return 0;
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...wa].filter(x => wb.has(x)));
  const union = new Set([...wa, ...wb]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

async function run() {
  const config = loadConfig();
  const client = new TwitterApi({
    appKey: config.consumerKey,
    appSecret: config.consumerSecret,
    accessToken: config.accessToken,
    accessSecret: config.accessTokenSecret,
  });

  const data = loadData();
  
  // Get user ID
  const user = await client.v2.userByUsername(username);
  if (!user.data) {
    console.error('User not found:', username);
    return;
  }

  // Fetch recent tweets (replies included)
  const since = new Date();
  since.setDate(since.getDate() - 7); // Last 7 days
  
  const timeline = await client.v2.userTimeline(user.data.id, {
    max_results: 100,
    'tweet.fields': ['created_at', 'public_metrics', 'referenced_tweets', 'in_reply_to_user_id', 'conversation_id'],
    exclude: ['retweets'],
    start_time: since.toISOString(),
  });

  if (!timeline.data?.data) {
    console.log('No recent tweets found.');
    return;
  }

  const userReplies = timeline.data.data.filter(t => 
    t.referenced_tweets?.some(ref => ref.type === 'replied_to')
  );

  console.log(`Found ${userReplies.length} replies in last 7 days`);

  // Match drafts to actual replies by text similarity
  let matched = 0;
  for (const draft of data.drafts) {
    if (draft.replyPostId) continue; // Already matched
    
    const bestMatch = userReplies
      .map(reply => ({ reply, score: similarity(draft.replyText, reply.text) }))
      .filter(m => m.score > 0.4) // 40% word overlap threshold
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestMatch) {
      draft.replyPostId = bestMatch.reply.id;
      draft.matchScore = bestMatch.score;
      draft.postedAt = bestMatch.reply.created_at;
      matched++;
      console.log(`Matched draft → tweet ${bestMatch.reply.id} (score: ${bestMatch.score.toFixed(2)})`);
    }
  }

  // Fetch engagement for all known reply IDs
  const replyIds = data.drafts
    .filter(d => d.replyPostId)
    .map(d => d.replyPostId);

  if (replyIds.length > 0) {
    console.log(`Fetching engagement for ${replyIds.length} replies...`);
    
    for (let i = 0; i < replyIds.length; i += 100) {
      const batch = replyIds.slice(i, i + 100);
      try {
        const response = await client.v2.tweets(batch, {
          'tweet.fields': ['public_metrics'],
        });
        
        if (response.data) {
          for (const tweet of response.data) {
            const m = tweet.public_metrics || {};
            const draft = data.drafts.find(d => d.replyPostId === tweet.id);
            if (draft) {
              draft.engagement = {
                likes: m.like_count || 0,
                retweets: m.retweet_count || 0,
                replies: m.reply_count || 0,
                impressions: m.impression_count || 0,
                quotes: m.quote_count || 0,
                lastChecked: Date.now(),
              };
            }
          }
        }
      } catch (err) {
        console.error('Error fetching engagement:', err.message);
      }
    }
  }

  // Also store all user replies for historical tracking
  for (const reply of userReplies) {
    const m = reply.public_metrics || {};
    const existing = data.replies.find(r => r.id === reply.id);
    const replyData = {
      id: reply.id,
      text: reply.text,
      createdAt: reply.created_at,
      parentTweetId: reply.referenced_tweets?.find(r => r.type === 'replied_to')?.id,
      engagement: {
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
        replies: m.reply_count || 0,
        impressions: m.impression_count || 0,
        quotes: m.quote_count || 0,
        lastChecked: Date.now(),
      },
    };
    
    if (existing) {
      Object.assign(existing, replyData);
    } else {
      data.replies.push(replyData);
    }
  }

  data.lastFetch = Date.now();
  saveData(data);
  console.log(`Done. Matched ${matched} new drafts. Tracking ${data.drafts.length} drafts, ${data.replies.length} replies total.`);
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
