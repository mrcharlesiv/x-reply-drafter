/**
 * Vercel KV storage abstraction.
 * All data keyed by userId (extension generates a unique install ID).
 */

import { kv } from '@vercel/kv';

// --- Types ---

export interface Prompt {
  id: string;
  text: string;
  tags: string[];
  tone: 'professional' | 'casual' | 'provocative' | 'contrarian';
  createdAt: number;
  totalEngagement: number;
  useCount: number;
  avgEngagement: number;
}

export interface PostRecord {
  postId: string;          // X post ID we replied to
  postAuthor: string;      // original author handle
  postText: string;        // original post text (truncated)
  replyText: string;       // our reply
  replyPostId?: string;    // our reply's X post ID (for tracking)
  promptId: string;        // which prompt was used
  tone: string;
  timestamp: number;       // when we replied
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    lastChecked: number;
  };
  notes: string;           // user notes about this reply
  notesUpdatedAt?: number;
}

export interface UserSettings {
  apiKey?: string;         // encrypted
  apiProvider: 'openai' | 'anthropic' | 'custom';
  apiBaseUrl?: string;     // for custom OpenAI-compatible
  selectedModel: string;
  autoSubmit: boolean;
  defaultTone: string;
  backendUrl?: string;
}

// --- Keys ---

const keys = {
  settings: (uid: string) => `user:${uid}:settings`,
  prompts: (uid: string) => `user:${uid}:prompts`,
  posts: (uid: string) => `user:${uid}:posts`,
  post: (uid: string, postId: string) => `user:${uid}:post:${postId}`,
};

// --- Settings ---

export async function getSettings(userId: string): Promise<UserSettings | null> {
  return kv.get<UserSettings>(keys.settings(userId));
}

export async function saveSettings(userId: string, settings: UserSettings): Promise<void> {
  await kv.set(keys.settings(userId), settings);
}

// --- Prompts ---

export async function getPrompts(userId: string): Promise<Prompt[]> {
  const prompts = await kv.get<Prompt[]>(keys.prompts(userId));
  if (!prompts) return [];
  // Sort by average engagement descending
  return prompts.sort((a, b) => b.avgEngagement - a.avgEngagement);
}

export async function savePrompt(userId: string, prompt: Prompt): Promise<void> {
  const prompts = await getPrompts(userId);
  const existing = prompts.findIndex(p => p.id === prompt.id);
  if (existing >= 0) {
    prompts[existing] = prompt;
  } else {
    prompts.push(prompt);
  }
  await kv.set(keys.prompts(userId), prompts);
}

export async function deletePrompt(userId: string, promptId: string): Promise<boolean> {
  const prompts = await getPrompts(userId);
  const filtered = prompts.filter(p => p.id !== promptId);
  if (filtered.length === prompts.length) return false;
  await kv.set(keys.prompts(userId), filtered);
  return true;
}

// --- Posts ---

export async function getPosts(userId: string, limit = 50, offset = 0): Promise<PostRecord[]> {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId));
  if (!posts) return [];
  // Sort by timestamp descending (newest first)
  const sorted = posts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(offset, offset + limit);
}

export async function savePost(userId: string, post: PostRecord): Promise<void> {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId)) || [];
  const existing = posts.findIndex(p => p.postId === post.postId);
  if (existing >= 0) {
    posts[existing] = { ...posts[existing], ...post };
  } else {
    posts.push(post);
  }
  await kv.set(keys.posts(userId), posts);
}

export async function getPost(userId: string, postId: string): Promise<PostRecord | null> {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId));
  if (!posts) return null;
  return posts.find(p => p.postId === postId) || null;
}

export async function updatePostEngagement(
  userId: string,
  postId: string,
  engagement: PostRecord['engagement']
): Promise<boolean> {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId));
  if (!posts) return false;
  const idx = posts.findIndex(p => p.postId === postId || p.replyPostId === postId);
  if (idx < 0) return false;

  posts[idx].engagement = engagement;
  await kv.set(keys.posts(userId), posts);

  // Update prompt's engagement stats
  const prompts = await getPrompts(userId);
  const prompt = prompts.find(p => p.id === posts[idx].promptId);
  if (prompt) {
    // Recalculate from all posts using this prompt
    const promptPosts = posts.filter(p => p.promptId === prompt.id);
    const totalEng = promptPosts.reduce((sum, p) =>
      sum + p.engagement.likes + p.engagement.retweets + p.engagement.replies, 0);
    prompt.totalEngagement = totalEng;
    prompt.useCount = promptPosts.length;
    prompt.avgEngagement = promptPosts.length > 0 ? totalEng / promptPosts.length : 0;
    await savePrompt(userId, prompt);
  }

  return true;
}

export async function updatePostNotes(
  userId: string,
  postId: string,
  notes: string
): Promise<boolean> {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId));
  if (!posts) return false;
  const idx = posts.findIndex(p => p.postId === postId);
  if (idx < 0) return false;

  posts[idx].notes = notes;
  posts[idx].notesUpdatedAt = Date.now();
  await kv.set(keys.posts(userId), posts);
  return true;
}

// --- Analytics ---

export async function getAnalytics(userId: string) {
  const posts = await kv.get<PostRecord[]>(keys.posts(userId)) || [];
  const prompts = await getPrompts(userId);

  // Engagement by tone
  const byTone: Record<string, { total: number; count: number }> = {};
  // Engagement by hour
  const byHour: Record<number, { total: number; count: number }> = {};

  for (const post of posts) {
    const eng = post.engagement.likes + post.engagement.retweets + post.engagement.replies;

    // By tone
    if (!byTone[post.tone]) byTone[post.tone] = { total: 0, count: 0 };
    byTone[post.tone].total += eng;
    byTone[post.tone].count++;

    // By hour
    const hour = new Date(post.timestamp).getHours();
    if (!byHour[hour]) byHour[hour] = { total: 0, count: 0 };
    byHour[hour].total += eng;
    byHour[hour].count++;
  }

  return {
    totalPosts: posts.length,
    totalEngagement: posts.reduce((s, p) =>
      s + p.engagement.likes + p.engagement.retweets + p.engagement.replies, 0),
    byTone: Object.entries(byTone).map(([tone, data]) => ({
      tone,
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    })),
    byHour: Object.entries(byHour).map(([hour, data]) => ({
      hour: Number(hour),
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    })).sort((a, b) => a.hour - b.hour),
    topPrompts: prompts.slice(0, 10).map(p => ({
      id: p.id,
      text: p.text.slice(0, 100),
      avgEngagement: p.avgEngagement,
      useCount: p.useCount,
      tags: p.tags,
    })),
  };
}
