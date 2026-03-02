// @ts-nocheck
import { Hono } from 'hono';
import { getPrompts, savePrompt, deletePrompt, type Prompt } from '../lib/storage.js';

const prompts = new Hono();

// GET /api/prompts — List all prompts (ranked by engagement)
prompts.get('/', async (c) => {
  const userId = c.get('userId');
  const list = await getPrompts(userId);
  return c.json({ prompts: list });
});

// POST /api/prompts — Create or update a prompt
prompts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { id, text, tags, tone } = body;

  if (!text) {
    return c.json({ error: 'text is required' }, 400);
  }

  const prompt: Prompt = {
    id: id || crypto.randomUUID(),
    text,
    tags: tags || [],
    tone: tone || 'casual',
    createdAt: Date.now(),
    totalEngagement: 0,
    useCount: 0,
    avgEngagement: 0,
  };

  // If updating, preserve engagement stats
  if (id) {
    const existing = (await getPrompts(userId)).find(p => p.id === id);
    if (existing) {
      prompt.totalEngagement = existing.totalEngagement;
      prompt.useCount = existing.useCount;
      prompt.avgEngagement = existing.avgEngagement;
      prompt.createdAt = existing.createdAt;
    }
  }

  await savePrompt(userId, prompt);
  return c.json({ prompt });
});

// DELETE /api/prompts/:id — Delete a prompt
prompts.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const promptId = c.req.param('id');
  const deleted = await deletePrompt(userId, promptId);

  if (!deleted) {
    return c.json({ error: 'Prompt not found' }, 404);
  }

  return c.json({ success: true });
});

export default prompts;
