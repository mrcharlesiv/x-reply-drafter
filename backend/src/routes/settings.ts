// @ts-nocheck
import { Hono } from 'hono';
import { getSettings, saveSettings, type UserSettings } from '../lib/storage.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const settings = new Hono();

// GET /api/settings
settings.get('/', async (c) => {
  const userId = c.get('userId');
  const s = await getSettings(userId);

  if (!s) {
    return c.json({
      settings: {
        apiProvider: 'openai',
        selectedModel: 'gpt-4o-mini',
        autoSubmit: false,
        defaultTone: 'casual',
        hasApiKey: false,
      },
    });
  }

  return c.json({
    settings: {
      apiProvider: s.apiProvider,
      apiBaseUrl: s.apiBaseUrl,
      selectedModel: s.selectedModel,
      autoSubmit: s.autoSubmit,
      defaultTone: s.defaultTone,
      hasApiKey: !!s.apiKey,
    },
  });
});

// POST /api/settings
settings.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const existing = await getSettings(userId);
  const updated: UserSettings = {
    apiProvider: body.apiProvider || existing?.apiProvider || 'openai',
    apiBaseUrl: body.apiBaseUrl || existing?.apiBaseUrl,
    selectedModel: body.selectedModel || existing?.selectedModel || 'gpt-4o-mini',
    autoSubmit: body.autoSubmit ?? existing?.autoSubmit ?? false,
    defaultTone: body.defaultTone || existing?.defaultTone || 'casual',
  };

  // Only update API key if provided
  if (body.apiKey) {
    updated.apiKey = await encrypt(body.apiKey);
  } else if (existing?.apiKey) {
    updated.apiKey = existing.apiKey;
  }

  await saveSettings(userId, updated);
  return c.json({ success: true });
});

export default settings;
