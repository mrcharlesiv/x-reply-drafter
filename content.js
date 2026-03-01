const BUTTON_CLASS = 'xrd-draft-btn';
const PROCESSED_ATTR = 'data-xrd-processed';
const OVERLAY_ID = 'xrd-overlay-root';

let currentContext = null;
let generating = false;

boot();

function boot() {
  injectButtons();
  const observer = new MutationObserver(debounce(injectButtons, 300));
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectButtons() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach((tweet) => {
    if (tweet.getAttribute(PROCESSED_ATTR) === '1') return;
    const actionBar = tweet.querySelector('div[role="group"]');
    if (!actionBar) return;

    const btn = createButton();
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openOverlay(extractTweetContext(tweet));
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'xrd-action-wrap';
    wrapper.appendChild(btn);
    actionBar.appendChild(wrapper);

    tweet.setAttribute(PROCESSED_ATTR, '1');
  });
}

function createButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.title = 'Draft AI reply';
  button.innerHTML = '<span>✍️</span><span>Draft Reply</span>';
  return button;
}

function extractTweetContext(tweetEl) {
  const author =
    tweetEl
      .querySelector('div[data-testid="User-Name"] a[role="link"]')
      ?.getAttribute('href')
      ?.replace('/', '') ||
    tweetEl.querySelector('div[data-testid="User-Name"] span')?.textContent ||
    'unknown';

  const mainText =
    tweetEl.querySelector('div[data-testid="tweetText"]')?.innerText?.trim() || '';

  const quoteCandidates = tweetEl.querySelectorAll('div[data-testid="tweetText"]');
  const quoteText = quoteCandidates.length > 1 ? quoteCandidates[1].innerText.trim() : '';

  return {
    author: normalizeHandle(author),
    text: mainText,
    quoteText,
    element: tweetEl,
  };
}

function normalizeHandle(v) {
  return String(v || '')
    .replace(/^@/, '')
    .trim();
}

function openOverlay(context) {
  currentContext = context;

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.innerHTML = `
    <div class="xrd-backdrop"></div>
    <div class="xrd-panel" role="dialog" aria-modal="true" aria-label="X Reply Drafter">
      <div class="xrd-head">
        <div>
          <h3>X Reply Drafter</h3>
          <p>Drafting for @${escapeHtml(context.author || 'unknown')}</p>
        </div>
        <button class="xrd-icon-btn" data-action="close" aria-label="Close">✕</button>
      </div>

      <div class="xrd-source">
        <label>Original post</label>
        <div class="xrd-source-box">${escapeHtml(context.text || '(No text found)')}</div>
        ${context.quoteText ? `<label>Quoted post</label><div class="xrd-source-box quote">${escapeHtml(context.quoteText)}</div>` : ''}
      </div>

      <div class="xrd-controls">
        <button class="xrd-btn primary" data-action="generate">Generate draft</button>
      </div>

      <label class="xrd-label" for="xrd-draft-text">Draft</label>
      <textarea id="xrd-draft-text" placeholder="Your drafted reply appears here..."></textarea>
      <div class="xrd-footer">
        <div class="left">
          <button class="xrd-btn" data-action="copy">Copy</button>
          <button class="xrd-btn" data-action="insert">Insert into reply box</button>
        </div>
        <span class="xrd-status" id="xrd-status">Ready</span>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  root.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.getAttribute('data-action');
    if (!action) {
      if (e.target.classList.contains('xrd-backdrop')) closeOverlay();
      return;
    }

    if (action === 'close') return closeOverlay();
    if (action === 'generate') return generateDraft(root);
    if (action === 'copy') return copyDraft(root);
    if (action === 'insert') return insertDraft(root);
  });

  root.querySelector('#xrd-draft-text').focus();
}

async function generateDraft(root) {
  if (generating) return;
  generating = true;
  setStatus(root, 'Generating…');
  toggleControls(root, true);

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'x-reply-drafter:generate',
      payload: {
        author: currentContext.author,
        text: currentContext.text,
        quoteText: currentContext.quoteText,
      },
    });

    if (!res?.ok) throw new Error(res?.error || 'Failed to generate draft');

    const textarea = root.querySelector('#xrd-draft-text');
    textarea.value = res.draft || '';
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    setStatus(root, `Draft ready • ${textarea.value.length} chars`);
  } catch (err) {
    setStatus(root, err.message || 'Generation failed');
  } finally {
    generating = false;
    toggleControls(root, false);
  }
}

async function copyDraft(root) {
  const draft = getDraft(root);
  if (!draft) return setStatus(root, 'No draft to copy');
  try {
    await navigator.clipboard.writeText(draft);
    setStatus(root, 'Copied to clipboard');
  } catch {
    setStatus(root, 'Clipboard blocked by browser');
  }
}

async function insertDraft(root) {
  const draft = getDraft(root);
  if (!draft) return setStatus(root, 'No draft to insert');

  const targetTweet = currentContext?.element;
  if (!targetTweet) return setStatus(root, 'Could not find target post');

  const replyButton = targetTweet.querySelector('button[data-testid="reply"]');
  if (!replyButton) return setStatus(root, 'Reply button not found');

  replyButton.click();

  const editor = await waitForElement('div[role="dialog"] div[role="textbox"][data-testid="tweetTextarea_0"]', 5000);
  if (!editor) {
    setStatus(root, 'Reply editor did not appear');
    return;
  }

  editor.focus();
  editor.textContent = draft;
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: draft }));
  setStatus(root, 'Inserted into reply box');
}

function closeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

function setStatus(root, text) {
  const el = root.querySelector('#xrd-status');
  if (el) el.textContent = text;
}

function getDraft(root) {
  return root.querySelector('#xrd-draft-text')?.value?.trim() || '';
}

function toggleControls(root, disabled) {
  root.querySelectorAll('button').forEach((btn) => {
    if (btn.dataset.action === 'close') return;
    btn.disabled = disabled;
  });
}

function waitForElement(selector, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const first = document.querySelector(selector);
    if (first) return resolve(first);

    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
