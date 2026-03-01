const BUTTON_CLASS = 'xrd-draft-btn';
const PROCESSED_ATTR = 'data-xrd-processed';

let generating = false;

boot();

function boot() {
  injectButtons();

  const observer = new MutationObserver(
    debounce(() => {
      injectButtons();
    }, 250)
  );

  observer.observe(document.body, { childList: true, subtree: true });
}

function injectButtons() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach((tweet) => {
    if (tweet.getAttribute(PROCESSED_ATTR) === '1') return;

    const actionBar = tweet.querySelector('div[role="group"]');
    if (!actionBar) return;

    const btn = createButton();
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (generating) return;
      await draftIntoReplyBox(tweet, btn);
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
  button.dataset.defaultLabel = 'Draft Reply';
  button.innerHTML = '<span>✍️</span><span class="xrd-btn-label">Draft Reply</span>';
  return button;
}

async function draftIntoReplyBox(tweetEl, button) {
  generating = true;
  setButtonLoading(button, true);

  try {
    const context = extractTweetContext(tweetEl);
    const draft = await requestDraft(context);
    if (!draft) throw new Error('No draft returned');

    let editor = findOpenReplyEditor(tweetEl);
    if (!editor) {
      const replyButton = findReplyButton(tweetEl);
      if (!replyButton) throw new Error('Reply button not found');
      replyButton.click();
      editor = await waitForReplyEditor(6000);
    }

    if (!editor) throw new Error('Reply editor did not appear');

    applyDraftToEditor(editor, draft);
    flashButtonState(button, 'Inserted');
  } catch (err) {
    flashButtonState(button, err?.message || 'Failed');
  } finally {
    generating = false;
    setTimeout(() => setButtonLoading(button, false), 700);
  }
}

function setButtonLoading(button, isLoading) {
  const label = button.querySelector('.xrd-btn-label');
  if (!label) return;
  button.disabled = isLoading;
  label.textContent = isLoading ? 'Generating...' : button.dataset.defaultLabel || 'Draft Reply';
}

function flashButtonState(button, text) {
  const label = button.querySelector('.xrd-btn-label');
  if (!label) return;
  label.textContent = text;
}

function findReplyButton(tweetEl) {
  return tweetEl.querySelector('button[data-testid="reply"], [role="button"][data-testid="reply"]');
}

function findOpenReplyEditor(tweetEl) {
  const selectors = [
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[contenteditable="true"][role="textbox"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"][aria-label*="Reply" i]',
    'div[role="textbox"][contenteditable="true"][data-placeholder*="Post your reply" i]',
    'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
  ];

  for (const sel of selectors) {
    const local = tweetEl.querySelector(sel);
    if (isVisible(local)) return local;
  }

  for (const sel of selectors) {
    const all = [...document.querySelectorAll(sel)];
    const visible = all.find((el) => isVisible(el));
    if (visible) return visible;
  }

  return null;
}

function waitForReplyEditor(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const first = findOpenReplyEditor(document);
    if (first) return resolve(first);

    const obs = new MutationObserver(() => {
      const found = findOpenReplyEditor(document);
      if (found) {
        obs.disconnect();
        clearTimeout(timer);
        resolve(found);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function applyDraftToEditor(editor, draft) {
  const text = String(draft || '');
  editor.focus();

  const selection = window.getSelection();
  if (selection && editor.contains(selection.anchorNode)) {
    selection.removeAllRanges();
  }

  let inserted = false;
  try {
    inserted = document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } catch {
    inserted = false;
  }

  if (!inserted) {
    editor.textContent = text;
  }

  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
  editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ', code: 'Space' }));
}

async function requestDraft(context) {
  const res = await chrome.runtime.sendMessage({
    type: 'x-reply-drafter:generate',
    payload: {
      author: context.author,
      text: context.text,
      quoteText: context.quoteText,
    },
  });

  if (!res?.ok) throw new Error(res?.error || 'Failed to generate draft');
  return res.draft || '';
}

function extractTweetContext(tweetEl) {
  const author =
    tweetEl
      .querySelector('div[data-testid="User-Name"] a[role="link"]')
      ?.getAttribute('href')
      ?.replace('/', '') ||
    tweetEl.querySelector('div[data-testid="User-Name"] span')?.textContent ||
    'unknown';

  // Try multiple selectors for tweet text
  let mainText = '';
  const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
  if (tweetTextEl) {
    mainText = tweetTextEl.innerText?.trim() || tweetTextEl.textContent?.trim() || '';
  }
  // Fallback: grab text from the tweet's main content area
  if (!mainText) {
    const langDiv = tweetEl.querySelector('div[lang]');
    if (langDiv) {
      mainText = langDiv.innerText?.trim() || langDiv.textContent?.trim() || '';
    }
  }

  const quoteCandidates = tweetEl.querySelectorAll('[data-testid="tweetText"]');
  let quoteText = '';
  if (quoteCandidates.length > 1) {
    quoteText = quoteCandidates[1].innerText?.trim() || quoteCandidates[1].textContent?.trim() || '';
  }

  console.log('[XRD] Extracted tweet context:', { author, mainText, quoteText });

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

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
