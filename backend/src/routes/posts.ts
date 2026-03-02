// @ts-nocheck
import { Hono } from 'hono';
import {
  getPosts,
  savePost,
  getPost,
  updatePostEngagement,
  updatePostNotes,
  getAnalytics,
  type PostRecord,
} from '../lib/storage.js';

const posts = new Hono();

// GET /api/posts — List posts with engagement + notes
posts.get('/', async (c) => {
  const userId = c.get('userId');
  const limit = Number(c.req.query('limit')) || 50;
  const offset = Number(c.req.query('offset')) || 0;
  const search = c.req.query('search');

  let list = await getPosts(userId, 500, 0); // Get all for filtering

  // Filter by search (searches notes, replyText, postText)
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p =>
      p.notes?.toLowerCase().includes(q) ||
      p.replyText?.toLowerCase().includes(q) ||
      p.postText?.toLowerCase().includes(q) ||
      p.postAuthor?.toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limit);

  return c.json({ posts: paginated, total });
});

// GET /api/posts/:postId — Single post detail
posts.get('/:postId', async (c) => {
  const userId = c.get('userId');
  const postId = c.req.param('postId');
  const post = await getPost(userId, postId);

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  return c.json({ post });
});

// POST /api/posts — Save a new reply record
posts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const post: PostRecord = {
    postId: body.postId,
    postAuthor: body.postAuthor || '',
    postText: body.postText || '',
    replyText: body.replyText || '',
    replyPostId: body.replyPostId,
    promptId: body.promptId || '',
    tone: body.tone || 'casual',
    timestamp: Date.now(),
    engagement: {
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      lastChecked: 0,
    },
    notes: '',
  };

  await savePost(userId, post);
  return c.json({ post });
});

// POST /api/track-engagement — Update engagement for a post
posts.post('/track-engagement', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { postId, likes, retweets, replies, impressions } = body;

  if (!postId) {
    return c.json({ error: 'postId is required' }, 400);
  }

  const updated = await updatePostEngagement(userId, postId, {
    likes: likes || 0,
    retweets: retweets || 0,
    replies: replies || 0,
    impressions: impressions || 0,
    lastChecked: Date.now(),
  });

  if (!updated) {
    return c.json({ error: 'Post not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/notes/:postId — Add/update notes for a post
posts.post('/notes/:postId', async (c) => {
  const userId = c.get('userId');
  const postId = c.req.param('postId');
  const body = await c.req.json();
  const { notes } = body;

  if (typeof notes !== 'string') {
    return c.json({ error: 'notes must be a string' }, 400);
  }

  const updated = await updatePostNotes(userId, postId, notes);

  if (!updated) {
    return c.json({ error: 'Post not found' }, 404);
  }

  return c.json({ success: true });
});

// GET /api/analytics — Engagement analytics
posts.get('/analytics/summary', async (c) => {
  const userId = c.get('userId');
  const analytics = await getAnalytics(userId);
  return c.json(analytics);
});

export default posts;
