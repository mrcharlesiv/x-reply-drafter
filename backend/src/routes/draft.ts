// @ts-nocheck
import { Hono } from 'hono';
import { callLLM, fetchModels } from '../lib/llm.js';
import { decrypt } from '../lib/crypto.js';
import { getSettings } from '../lib/storage.js';

const draft = new Hono();

// Build system prompt based on tone and custom prompt
function buildSystemPrompt(tone: string, customPrompt?: string): string {
  const toneInstructions: Record<string, string> = {
    professional: 'Write a thoughtful, professional reply. Be insightful and add value to the conversation. Maintain credibility.',
    casual: 'Write a casual, conversational reply. Be friendly and relatable. Use natural language.',
    provocative: 'Write a bold, provocative reply that challenges assumptions. Be attention-grabbing but not offensive.',
    contrarian: 'Write a contrarian reply that offers an opposing viewpoint. Be respectful but firm in disagreeing.',
  };

  const base = toneInstructions[tone] || toneInstructions.casual;

  return `You are a skilled X (Twitter) reply writer. Your job is to draft engaging replies to posts.

${base}

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Rules:
- Keep replies concise (under 280 characters when possible)
- Sound human, not like AI
- No hashtags unless they add real value
- Match the energy of the original post
- Be specific, not generic
- Never start with "Great point!" or similar filler

Return ONLY the reply text, nothing else.`;
}

// POST /api/draft — Generate a reply draft
draft.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { postText, postAuthor, tone, promptText, apiKey: clientApiKey, provider: clientProvider, model: clientModel, baseUrl: clientBaseUrl } = body;

  if (!postText) {
    return c.json({ error: 'postText is required' }, 400);
  }

  // Use client-provided credentials or fall back to stored settings
  let apiKey = clientApiKey;
  let provider = clientProvider;
  let model = clientModel;
  let baseUrl = clientBaseUrl;

  if (!apiKey) {
    const settings = await getSettings(userId);
    if (!settings?.apiKey) {
      return c.json({ error: 'No API key configured' }, 400);
    }
    apiKey = await decrypt(settings.apiKey);
    provider = settings.apiProvider;
    model = settings.selectedModel;
    baseUrl = settings.apiBaseUrl;
  }

  const systemPrompt = buildSystemPrompt(tone || 'casual', promptText);
  const userPrompt = `Reply to this X post by @${postAuthor || 'unknown'}:\n\n"${postText}"`;

  try {
    const result = await callLLM({
      provider: provider || 'openai',
      apiKey,
      baseUrl,
      model: model || 'gpt-4o-mini',
      systemPrompt,
      userPrompt,
      maxTokens: 300,
    });

    return c.json({
      draft: result.text,
      model: result.model,
      usage: result.usage,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/draft/models — Fetch available models for a provider
draft.post('/models', async (c) => {
  const body = await c.req.json();
  const { provider, apiKey, baseUrl } = body;

  if (!provider || !apiKey) {
    return c.json({ error: 'provider and apiKey required' }, 400);
  }

  const models = await fetchModels(provider, apiKey, baseUrl);
  return c.json({ models });
});

export default draft;
