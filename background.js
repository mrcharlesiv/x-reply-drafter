const DEFAULT_SAVED_PROMPTS = [
  {
    name: 'Witty & Concise',
    prompt:
      'You are a witty, knowledgeable person on X. Write a concise, engaging reply. No hashtags. Match the conversational tone. Keep it under 280 characters unless the topic demands more depth.',
  },
  {
    name: 'Professional',
    prompt:
      'You are a thoughtful business leader. Write a professional, insightful reply that adds value to the conversation. Be direct and substantive. No hashtags.',
  },
  {
    name: 'Challenger',
    prompt:
      'You respectfully challenge the premise of this post with a well-reasoned counterpoint. Be direct but not aggressive. Back up your position with logic. No hashtags.',
  },
];

const DEFAULT_SAVED_API_CONFIGS = [
  {
    name: 'Anthropic',
    apiKey: '',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-opus-4-6',
  },
];

const DEFAULT_SETTINGS = {
  apiKey: '',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  systemPrompt: DEFAULT_SAVED_PROMPTS[0].prompt,
  temperature: 0.8,
  maxTokens: 220,
  savedPrompts: DEFAULT_SAVED_PROMPTS,
  savedApiConfigs: DEFAULT_SAVED_API_CONFIGS,
};

const RATE_LIMIT_MS = 1500;
let lastRequestTs = 0;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const merged = { ...DEFAULT_SETTINGS, ...current };
  await chrome.storage.sync.set(merged);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'x-reply-drafter:generate') {
    handleGenerate(message.payload)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => sendResponse({ ok: false, error: normalizeError(err) }));
    return true;
  }

  if (message?.type === 'x-reply-drafter:get-settings') {
    chrome.storage.sync
      .get(Object.keys(DEFAULT_SETTINGS))
      .then((settings) => sendResponse({ ok: true, settings: { ...DEFAULT_SETTINGS, ...settings } }))
      .catch((err) => sendResponse({ ok: false, error: normalizeError(err) }));
    return true;
  }
});

async function handleGenerate(payload) {
  const now = Date.now();
  const waitMs = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTs));
  if (waitMs) await delay(waitMs);
  lastRequestTs = Date.now();

  const settingsRaw = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...settingsRaw };

  if (!settings.apiKey?.trim()) {
    throw new Error('Missing API key. Open extension settings and add your API key.');
  }

  const endpoint = (settings.endpoint || '').trim();
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error('Invalid endpoint URL in settings.');
  }

  const provider = detectProvider(endpoint, settings.model);
  const generated = await callModel(provider, endpoint, settings, payload);

  return {
    draft: generated.trim(),
    provider,
  };
}

function detectProvider(endpoint, model = '') {
  const e = endpoint.toLowerCase();
  const m = (model || '').toLowerCase();
  if (e.includes('anthropic.com') || m.startsWith('claude')) return 'anthropic';
  return 'openai-compatible';
}

async function callModel(provider, endpoint, settings, payload) {
  if (provider === 'anthropic') {
    return callAnthropic(endpoint, settings, payload);
  }
  return callOpenAICompatible(endpoint, settings, payload);
}

async function callOpenAICompatible(endpoint, settings, payload) {
  const body = {
    model: settings.model,
    temperature: Number(settings.temperature ?? 0.8),
    max_tokens: Number(settings.maxTokens ?? 220),
    messages: [
      { role: 'system', content: settings.systemPrompt },
      { role: 'user', content: buildUserPrompt(payload) },
    ],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error?.message || `API error (${res.status})`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return sanitizeDraft(content);
  if (Array.isArray(content)) {
    const text = content
      .map((p) => (typeof p === 'string' ? p : p?.text || ''))
      .join(' ')
      .trim();
    if (text) return sanitizeDraft(text);
  }
  throw new Error('No draft returned from API.');
}

async function callAnthropic(endpoint, settings, payload) {
  const body = {
    model: settings.model,
    max_tokens: Number(settings.maxTokens ?? 220),
    temperature: Number(settings.temperature ?? 0.8),
    system: settings.systemPrompt,
    messages: [{ role: 'user', content: buildUserPrompt(payload) }],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error?.type || `API error (${res.status})`);
  }

  const content = data?.content;
  if (Array.isArray(content)) {
    const text = content
      .map((c) => (c?.type === 'text' ? c.text : ''))
      .join(' ')
      .trim();
    if (text) return sanitizeDraft(text);
  }

  throw new Error('No draft returned from API.');
}

function buildUserPrompt(payload) {
  const quote = payload.quoteText?.trim();
  const tweetText = payload.text?.trim() || '';
  const author = payload.author?.trim() || 'Unknown author';

  return [
    `Author: @${author}`,
    'Post text:',
    tweetText || '(No text found)',
    quote ? `\nQuoted post:\n${quote}` : '',
    '\nWrite one reply only. Do not use hashtags. No preamble or explanation.',
  ]
    .filter(Boolean)
    .join('\n');
}

function sanitizeDraft(text) {
  return String(text)
    .replace(/^```[a-z]*\n?/gi, '')
    .replace(/```$/g, '')
    .replace(/^['"“”]|['"“”]$/g, '')
    .trim();
}

function normalizeError(err) {
  const msg = err?.message || String(err);
  if (/401|403|unauthorized|invalid api/i.test(msg)) {
    return 'Authentication failed. Check API key, endpoint, and model.';
  }
  return msg;
}

function safeJson(res) {
  return res
    .json()
    .catch(() => ({}));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
