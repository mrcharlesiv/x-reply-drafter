// @ts-nocheck
import { Hono } from 'hono';
import { callLLM, fetchModels } from '../lib/llm.js';
import { decrypt } from '../lib/crypto.js';
import { getSettings } from '../lib/storage.js';

const draft = new Hono();

const VIRAL_REPLY_MODEL = `
REPLY RULES (from analysis of 1,150 real viral X replies - Round 2):

STRATEGY RANKINGS (by avg likes):
1. QUESTION (121.6 avg) ← #1 WINNER. Ask a genuine question, not rhetorical.
2. YES-AND (76.7 avg) - Agree + add genuinely novel angle
3. QUICK-REACT (68.9 avg) - Instant gut reaction, under 50 chars
4. HUMOR/WIT (60.9 avg) - Short, clever observations
5. FRAMEWORK/LIST (48.8 avg) - Structured insight
[Skip the low performers: Personal story 14.4, Contrarian 11.8, Data 8.2]

LENGTH IS BIMODAL - NOT just "be short":
- <50 chars: 65.4 avg ✅
- 50-100 chars: 35 avg ❌ AVOID (dead zone)
- 100-200 chars: 50 avg
- 200-400 chars: 64.8 avg ✅ (ties with ultra-short)
- 400+ chars: 34.5 avg ❌
Go very short OR substantive. Middle ground kills.

TIMING IS CRITICAL:
- Within 30 min: 101.5 avg likes ⭐ (4x better than late)
- 30-120 min: 58 avg
- 120+ min: 24.9 avg
Speed matters more than content quality.

TONE:
- Curious: 171.3 avg likes ← Sound genuinely interested
- Enthusiastic: 72.1 avg
- Authoritative: 37 avg

HOOKS:
- Question hooks: 189.6 avg ← Open with a real question
- Agreement openers: 3.2 avg ❌ ("Great point!" = death)

NEVER:
- Mini-essays, sycophantic openers, hedging, reframes, numbered lists
- Explain your joke, hedge your opinion, qualify your take
- Long sentences, em dashes, semicolons, bullet points

ONE IDEA PER REPLY. Lead with the punch. Match parent energy.
`;

// Build system prompt based on tone and custom prompt
function buildSystemPrompt(tone: string, customPrompt?: string): string {
  const toneInstructions: Record<string, string> = {
    'viral-model': 'Follow the viral reply model exactly. Prioritize questions above all else.',
    professional: 'Write a thoughtful, professional reply. Be insightful and add value to the conversation. Maintain credibility.',
    casual: 'Write a casual, conversational reply. Be friendly and relatable. Use natural language.',
    provocative: 'Write a bold, provocative reply that challenges assumptions. Be attention-grabbing but not offensive.',
    contrarian: 'Write a contrarian reply that offers an opposing viewpoint. Be respectful but firm in disagreeing.',
  };

  const base = toneInstructions[tone] || toneInstructions['viral-model'];

  return `You are a skilled X (Twitter) reply writer. Your job is to draft engaging replies to posts.

${base}

${VIRAL_REPLY_MODEL}

YOUR GENERATION PRIORITY (FOLLOW THIS ORDER):
1. FIRST: Try to ask a genuine question (121.6 avg likes). This wins consistently.
2. If no good question fits: Use YES-AND (agree + add novel angle)
3. If that doesn't fit: Use QUICK-REACT (instant gut reaction, <50 chars)
4. Last resort: HUMOR/WIT (only if other strategies won't work)

DO NOT default to humor. DO NOT use sarcasm. DO NOT be clever for cleverness's sake.
PRIORITIZE questions. Ask what the original post makes you genuinely curious about.

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Rules:
- Keep replies concise (under 280 characters when possible, or go 200-400 for substance)
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
