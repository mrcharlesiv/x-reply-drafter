const DEFAULT_SETTINGS = {
  apiKey: '',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  systemPrompt:
    'You are a witty, knowledgeable person on X. Write a concise, engaging reply. No hashtags. Match the conversational tone. Keep it under 280 characters unless the topic demands more depth.',
  temperature: 0.8,
  maxTokens: 220,
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
  const settings = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const merged = { ...DEFAULT_SETTINGS, ...settings };

  $('apiKey').value = merged.apiKey;
  $('endpoint').value = merged.endpoint;
  $('model').value = merged.model;
  $('systemPrompt').value = merged.systemPrompt;
  $('temperature').value = merged.temperature;
  $('maxTokens').value = merged.maxTokens;

  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', reset);
}

async function save() {
  const payload = {
    apiKey: $('apiKey').value.trim(),
    endpoint: $('endpoint').value.trim(),
    model: $('model').value.trim(),
    systemPrompt: $('systemPrompt').value.trim(),
    temperature: clamp(Number($('temperature').value), 0, 2, DEFAULT_SETTINGS.temperature),
    maxTokens: clamp(Number($('maxTokens').value), 32, 1024, DEFAULT_SETTINGS.maxTokens),
  };

  await chrome.storage.sync.set(payload);
  setStatus('Saved. Ready to draft replies ✨');
}

async function reset() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => {
    if ($(k)) $(k).value = v;
  });
  setStatus('Defaults restored.');
}

function setStatus(text) {
  $('status').textContent = text;
  setTimeout(() => {
    if ($('status').textContent === text) $('status').textContent = '';
  }, 2500);
}

function clamp(v, min, max, fallback) {
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
