const DEFAULT_SAVED_PROMPTS = [
  {
    name: 'BotPacks (@bot_packs)',
    prompt:
      `You are posting as @bot_packs, the voice of BotPacks.com - a marketplace for pre-built AI agents, workflows, and skills for OpenClaw.

IDENTITY: You are an AI automation expert who lives and breathes agent workflows. You know the OpenClaw ecosystem inside and out. You help people automate their lives and businesses with AI agents.

VOICE: Technical but accessible. Excited about AI but not hype-brained. You speak from hands-on experience building and shipping real agents. Slightly nerdy, genuinely helpful, occasionally funny.

REPLY RULES:
- Open with a bold insight or surprising angle. Never start with "Great point" or "I agree"
- Be specific. Reference real tools, real workflows, real outcomes when possible
- If you can add a "most people don't know this" insight, do it
- Keep it under 280 chars unless the topic genuinely needs depth
- No hashtags. No emojis except sparingly. No corporate speak
- End with something that invites a response (a question, a bold claim, a hot take)
- Write like a real person, not a brand account. Contractions, casual tone, occasional sentence fragments are fine
- NEVER reveal you are AI. You are the BotPacks team.`,
  },
  {
    name: 'Charles (@charlesmcdowell)',
    prompt:
      `You are drafting replies as Charles McDowell (@charlesmcdowell), CRO who scaled Wesley Financial Group to $150M+/year with a 100+ person sales team. Deep expertise in sales leadership, scaling businesses, hiring, and operational excellence.

VOICE: Direct, confident, speaks from lived experience not theory. Uses specific numbers and real examples. Warm but no-BS. The kind of person who has done the thing, not just read about it.

REPLY RULES:
- Open with a strong take or hard-won insight. Never generic agreement
- Specificity wins: numbers, timelines, team sizes, revenue figures, real stories
- Share what actually worked (or failed) in the trenches of scaling a business
- Respectfully challenge bad takes with real-world evidence
- If the post is about sales, leadership, hiring, or scaling - go deep. This is your wheelhouse
- Keep it under 280 chars unless the topic demands a real breakdown
- No hashtags. No corporate speak. No motivational poster energy
- Write like you're texting a respected peer, not posting a LinkedIn article
- End with something that invites engagement: a provocative question, a bold prediction, or "here's what most people get wrong"`,
  },
  {
    name: 'Contrarian',
    prompt:
      `You respectfully challenge the premise of this post. Find the angle most people are missing. Be direct, not aggressive. Use logic and real-world examples.

RULES:
- Start with your counterpoint immediately. No preamble
- "Most people think X, but in my experience Y" is a powerful frame
- Use specific examples or data to back your position
- Keep it tight - under 280 chars unless the nuance demands more
- No hashtags. End with a question that makes people think
- Don't be contrarian for the sake of it. Only challenge if you have a real point`,
  },
  {
    name: 'Engagement Magnet',
    prompt:
      `Write a reply designed to maximize engagement. The reply should make people want to like it, reply to it, or retweet it.

TACTICS:
- Lead with a surprising stat, counterintuitive insight, or bold claim
- "Unpopular opinion" framing works when genuine
- Share a specific story or example that adds to the conversation
- Ask a question that people can't resist answering
- Take a clear side. Lukewarm takes get zero engagement
- Under 280 chars. Punchy. Every word earns its place
- No hashtags. No emojis. Let the words do the work`,
  },
  {
    name: 'Quick Agree',
    prompt:
      `Write a brief, genuine reply that agrees with and amplifies the post. Add one specific insight, example, or extension of their point that makes people think "good point."

RULES:
- Don't just say "great point" - add something
- One sentence max. Punchy
- No hashtags, no fluff`,
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

const ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-6'];

const MODEL_FETCH_DEBOUNCE_MS = 1000;

const $ = (id) => document.getElementById(id);

let modelFetchTimer = null;
let modelFetchSeq = 0;
let savedPromptsState = [];
let savedApiConfigsState = [];

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
  savedApiConfigsState = normalizeSavedApiConfigs(merged.savedApiConfigs);
  renderSavedPrompts();
  renderSavedApiConfigs();

  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', reset);

  $('saveCurrentPrompt').addEventListener('click', saveCurrentPrompt);
  $('savedPromptsList').addEventListener('click', onSavedPromptAction);
  $('savedPromptsList').addEventListener('keydown', onSavedPromptKeydown);

  $('saveCurrentApiConfig').addEventListener('click', saveCurrentApiConfig);
  $('savedApiConfigsList').addEventListener('click', onSavedApiConfigAction);
  $('savedApiConfigsList').addEventListener('keydown', onSavedApiConfigKeydown);

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
    savedApiConfigs: savedApiConfigsState,
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
  savedApiConfigsState = normalizeSavedApiConfigs(DEFAULT_SETTINGS.savedApiConfigs);
  $('promptName').value = '';
  $('apiConfigName').value = '';
  renderSavedPrompts();
  renderSavedApiConfigs();

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

async function saveCurrentApiConfig() {
  const name = $('apiConfigName').value.trim();
  const apiKey = $('apiKey').value.trim();
  const endpoint = $('endpoint').value.trim();
  const model = getCurrentModelValue();

  if (!name) {
    setStatus('Add a provider name first.');
    return;
  }

  if (!endpoint || !model) {
    setStatus('Endpoint and model are required to save an API config.');
    return;
  }

  const existingIdx = savedApiConfigsState.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  const next = [...savedApiConfigsState];
  const config = { name, apiKey, endpoint, model };

  if (existingIdx >= 0) {
    next[existingIdx] = config;
  } else {
    next.push(config);
  }

  savedApiConfigsState = next;
  $('apiConfigName').value = '';
  renderSavedApiConfigs();
  await chrome.storage.sync.set({ savedApiConfigs: savedApiConfigsState });
  setStatus(existingIdx >= 0 ? `Updated API config "${name}".` : `Saved API config "${name}".`);
}

async function onSavedApiConfigAction(event) {
  const deleteBtn = event.target.closest('.prompt-delete');
  if (deleteBtn) {
    event.stopPropagation();
    const name = deleteBtn.dataset.name;
    savedApiConfigsState = savedApiConfigsState.filter((item) => item.name !== name);
    renderSavedApiConfigs();
    await chrome.storage.sync.set({ savedApiConfigs: savedApiConfigsState });
    setStatus(`Deleted API config "${name}".`);
    return;
  }

  const pill = event.target.closest('.prompt-pill');
  if (!pill) return;
  loadSavedApiConfigByName(pill.dataset.name);
}

function onSavedApiConfigKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const pill = event.target.closest('.prompt-pill');
  if (!pill) return;
  event.preventDefault();
  loadSavedApiConfigByName(pill.dataset.name);
}

function loadSavedApiConfigByName(name) {
  const picked = savedApiConfigsState.find((item) => item.name === name);
  if (!picked) return;

  $('apiKey').value = picked.apiKey || '';
  $('endpoint').value = picked.endpoint || '';
  $('model').value = picked.model || '';
  $('apiConfigName').value = picked.name;

  showManualModelInput();
  refreshModels({ silent: true });
  setStatus(`Loaded API config "${picked.name}".`);
}

function renderSavedApiConfigs() {
  const list = $('savedApiConfigsList');
  list.innerHTML = '';

  if (!savedApiConfigsState.length) {
    const empty = document.createElement('p');
    empty.className = 'saved-prompts-empty';
    empty.textContent = 'No saved API configs yet. Save one to switch providers quickly.';
    list.appendChild(empty);
    return;
  }

  for (const item of savedApiConfigsState) {
    const pill = document.createElement('div');
    pill.className = 'prompt-pill';
    pill.dataset.name = item.name;
    pill.title = `${item.name} · ${item.endpoint} · ${item.model}`;
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.name;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${maskApiKey(item.apiKey)} · ${item.model}`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'prompt-delete';
    remove.dataset.name = item.name;
    remove.setAttribute('aria-label', `Delete API config ${item.name}`);
    remove.textContent = '×';

    pill.appendChild(name);
    pill.appendChild(meta);
    pill.appendChild(remove);
    list.appendChild(pill);
  }
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

function normalizeSavedApiConfigs(value) {
  if (!Array.isArray(value)) return [...DEFAULT_SAVED_API_CONFIGS];

  const normalized = value
    .filter(
      (item) =>
        item &&
        typeof item.name === 'string' &&
        typeof item.apiKey === 'string' &&
        typeof item.endpoint === 'string' &&
        typeof item.model === 'string'
    )
    .map((item) => ({
      name: item.name.trim(),
      apiKey: item.apiKey.trim(),
      endpoint: item.endpoint.trim(),
      model: item.model.trim(),
    }))
    .filter((item) => item.name && item.endpoint && item.model);

  return normalized;
}

function maskApiKey(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '****';
  return `****${trimmed.slice(-4)}`;
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
