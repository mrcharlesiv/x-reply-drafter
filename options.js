const DEFAULT_SETTINGS = {
  apiKey: '',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  systemPrompt:
    'You are a witty, knowledgeable person on X. Write a concise, engaging reply. No hashtags. Match the conversational tone. Keep it under 280 characters unless the topic demands more depth.',
  temperature: 0.8,
  maxTokens: 220,
};

const ANTHROPIC_MODELS = [
  'claude-opus-4-0520',
  'claude-sonnet-4-20250514',
  'claude-haiku-235-20241022',
  'claude-3-5-haiku-20241022',
];

const MODEL_FETCH_DEBOUNCE_MS = 1000;

const $ = (id) => document.getElementById(id);

let modelFetchTimer = null;
let modelFetchSeq = 0;

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

  $('refreshModels').addEventListener('click', () => refreshModels({ force: true }));
  $('apiKey').addEventListener('input', scheduleRefreshModels);
  $('endpoint').addEventListener('input', scheduleRefreshModels);
  $('modelSelect').addEventListener('change', onModelSelectChange);

  refreshModels({ silent: true });
}

async function save() {
  const payload = {
    apiKey: $('apiKey').value.trim(),
    endpoint: $('endpoint').value.trim(),
    model: getCurrentModelValue(),
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

  showManualModelInput();
  $('modelHelp').textContent = 'Defaults restored. Refresh to load models from your provider.';
  setStatus('Defaults restored.');
}

function scheduleRefreshModels() {
  clearTimeout(modelFetchTimer);
  modelFetchTimer = setTimeout(() => refreshModels({ silent: true }), MODEL_FETCH_DEBOUNCE_MS);
}

async function refreshModels({ force = false, silent = false } = {}) {
  const apiKey = $('apiKey').value.trim();
  const endpoint = $('endpoint').value.trim();

  if (!apiKey || !endpoint) {
    showManualModelInput();
    $('modelHelp').textContent = 'Add API key + endpoint to auto-load models.';
    return;
  }

  const provider = detectProvider(endpoint);
  const thisFetchSeq = ++modelFetchSeq;

  setLoading(true);
  if (!silent) $('modelHelp').textContent = 'Loading models…';

  try {
    const models =
      provider === 'anthropic'
        ? ANTHROPIC_MODELS
        : await fetchOpenAICompatibleModels(endpoint, apiKey);

    if (thisFetchSeq !== modelFetchSeq) return;

    if (!models.length) {
      throw new Error('No models returned by provider.');
    }

    populateModelSelect(models, { force });
    $('modelHelp').textContent = `Loaded ${models.length} model${models.length === 1 ? '' : 's'} (${provider}).`;
  } catch (err) {
    if (thisFetchSeq !== modelFetchSeq) return;

    showManualModelInput();
    $('modelHelp').textContent = `Could not load models (${normalizeError(err)}). You can still type a model manually.`;
  } finally {
    if (thisFetchSeq === modelFetchSeq) {
      setLoading(false);
    }
  }
}

function detectProvider(endpoint = '') {
  const lower = endpoint.toLowerCase();
  if (lower.includes('anthropic.com') || lower.includes('/v1/messages')) return 'anthropic';
  return 'openai-compatible';
}

function normalizeEndpointBase(endpoint) {
  const url = new URL(endpoint);
  url.hash = '';
  url.search = '';

  url.pathname = url.pathname
    .replace(/\/v1\/chat\/completions\/?$/i, '')
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/$/, '');

  return `${url.origin}${url.pathname}`;
}

async function fetchOpenAICompatibleModels(endpoint, apiKey) {
  let base;
  try {
    base = normalizeEndpointBase(endpoint);
  } catch {
    throw new Error('Invalid endpoint URL.');
  }

  const modelsUrl = `${base}/models`;
  const res = await fetch(modelsUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error?.message || `API error ${res.status}`);
  }

  const models = Array.isArray(data?.data)
    ? data.data
        .map((item) => item?.id)
        .filter((id) => typeof id === 'string' && id.trim())
    : [];

  return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
}

function populateModelSelect(models, { force = false } = {}) {
  const select = $('modelSelect');
  const input = $('model');
  const currentModel = (force ? '' : getCurrentModelValue()) || DEFAULT_SETTINGS.model;

  select.innerHTML = '';
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  }

  const selected = models.includes(currentModel) ? currentModel : models[0];
  select.value = selected;
  input.value = selected;

  showModelDropdown();
}

function onModelSelectChange() {
  $('model').value = $('modelSelect').value;
}

function getCurrentModelValue() {
  if (!$('modelSelect').hidden && $('modelSelect').value) return $('modelSelect').value.trim();
  return $('model').value.trim();
}

function showModelDropdown() {
  $('modelSelect').hidden = false;
  $('model').hidden = true;
}

function showManualModelInput() {
  $('modelSelect').hidden = true;
  $('model').hidden = false;
}

function setLoading(isLoading) {
  $('modelsLoading').hidden = !isLoading;
  $('refreshModels').disabled = isLoading;
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

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function normalizeError(err) {
  return err?.message || String(err);
}
