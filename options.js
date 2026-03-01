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

const DEFAULT_SETTINGS = {
  apiKey: '',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  systemPrompt: DEFAULT_SAVED_PROMPTS[0].prompt,
  temperature: 0.8,
  maxTokens: 220,
  savedPrompts: DEFAULT_SAVED_PROMPTS,
};

const ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-6'];

const MODEL_FETCH_DEBOUNCE_MS = 1000;

const $ = (id) => document.getElementById(id);

let modelFetchTimer = null;
let modelFetchSeq = 0;
let savedPromptsState = [];

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

  savedPromptsState = normalizeSavedPrompts(merged.savedPrompts);
  renderSavedPrompts();

  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', reset);

  $('saveCurrentPrompt').addEventListener('click', saveCurrentPrompt);
  $('savedPromptsList').addEventListener('click', onSavedPromptAction);
  $('savedPromptsList').addEventListener('keydown', onSavedPromptKeydown);

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
    savedPrompts: savedPromptsState,
  };

  await chrome.storage.sync.set(payload);
  setStatus('Saved. Ready to draft replies ✨');
}

async function reset() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => {
    if ($(k)) $(k).value = v;
  });

  savedPromptsState = normalizeSavedPrompts(DEFAULT_SETTINGS.savedPrompts);
  $('promptName').value = '';
  renderSavedPrompts();

  showManualModelInput();
  $('modelHelp').textContent = 'Defaults restored. Refresh to load models from your provider.';
  setStatus('Defaults restored.');
}

async function saveCurrentPrompt() {
  const name = $('promptName').value.trim();
  const prompt = $('systemPrompt').value.trim();

  if (!name) {
    setStatus('Add a name for this prompt first.');
    return;
  }

  if (!prompt) {
    setStatus('System prompt is empty. Nothing to save.');
    return;
  }

  const existingIdx = savedPromptsState.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  const next = [...savedPromptsState];

  if (existingIdx >= 0) {
    next[existingIdx] = { name, prompt };
  } else {
    next.push({ name, prompt });
  }

  savedPromptsState = next;
  $('promptName').value = '';
  renderSavedPrompts();
  await chrome.storage.sync.set({ savedPrompts: savedPromptsState });
  setStatus(existingIdx >= 0 ? `Updated "${name}".` : `Saved "${name}".`);
}

async function onSavedPromptAction(event) {
  const deleteBtn = event.target.closest('.prompt-delete');
  if (deleteBtn) {
    event.stopPropagation();
    const name = deleteBtn.dataset.name;
    savedPromptsState = savedPromptsState.filter((item) => item.name !== name);
    renderSavedPrompts();
    await chrome.storage.sync.set({ savedPrompts: savedPromptsState });
    setStatus(`Deleted "${name}".`);
    return;
  }

  const pill = event.target.closest('.prompt-pill');
  if (!pill) return;
  loadSavedPromptByName(pill.dataset.name);
}

function onSavedPromptKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const pill = event.target.closest('.prompt-pill');
  if (!pill) return;
  event.preventDefault();
  loadSavedPromptByName(pill.dataset.name);
}

function loadSavedPromptByName(name) {
  const picked = savedPromptsState.find((item) => item.name === name);
  if (!picked) return;

  $('systemPrompt').value = picked.prompt;
  $('promptName').value = picked.name;
  setStatus(`Loaded "${picked.name}".`);
}

function renderSavedPrompts() {
  const list = $('savedPromptsList');
  list.innerHTML = '';

  if (!savedPromptsState.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-prompts-empty';
    empty.textContent = 'No saved prompts yet. Save one to build your library.';
    list.appendChild(empty);
    return;
  }

  for (const item of savedPromptsState) {
    const pill = document.createElement('div');
    pill.className = 'prompt-pill';
    pill.dataset.name = item.name;
    pill.title = item.prompt;
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'prompt-delete';
    remove.dataset.name = item.name;
    remove.setAttribute('aria-label', `Delete ${item.name}`);
    remove.textContent = '×';

    pill.appendChild(name);
    pill.appendChild(remove);
    list.appendChild(pill);
  }
}

function normalizeSavedPrompts(value) {
  if (!Array.isArray(value)) return [...DEFAULT_SAVED_PROMPTS];

  const normalized = value
    .filter((item) => item && typeof item.name === 'string' && typeof item.prompt === 'string')
    .map((item) => ({ name: item.name.trim(), prompt: item.prompt.trim() }))
    .filter((item) => item.name && item.prompt);

  return normalized;
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
      provider === 'anthropic' ? ANTHROPIC_MODELS : await fetchOpenAICompatibleModels(endpoint, apiKey);

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
