import { generateDraftDirect, getStoredLLMConfig } from '../lib/api';
import { getLocalPrompts, getSettings, addLocalPost } from '../lib/storage';
const ATTR = 'data-xrd';
function extract(el: Element) {
  const txt = el.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
  if (!txt) return null;
  const href = el.querySelector('a[role="link"]')?.getAttribute('href') || '';
  const author = href.split('/').filter(Boolean)[0] || '';
  const statusHref = el.querySelector('a[href*="/status/"] time')?.parentElement?.getAttribute('href') || '';
  const tweetId = statusHref.split('/status/')[1]?.split(/[/?]/)[0] || '';
  return { content: txt, author, tweetId };
}
async function showPanel(article: Element) {
  const post = extract(article); if (!post) return;
  const old = article.querySelector('.xrd-panel'); if (old) { old.remove(); return; }
  const settings = await getSettings();
  const prompts = (await getLocalPrompts()).sort((a, b) => b.avgEngagement - a.avgEngagement);
  const config = await getStoredLLMConfig();
  const panel = document.createElement('div'); panel.className = 'xrd-panel';
  panel.innerHTML = `<div class="xrd-panel-header"><span class="xrd-panel-title">✍️ Draft Reply</span><button class="xrd-close">✕</button></div>
<div class="xrd-body">
  ${!config ? '<div class="xrd-warn">⚠️ No API key. Click extension icon.</div>' : ''}
  <div class="xrd-field"><label>Tone</label><div class="xrd-tones">
    ${['casual','professional','provocative','contrarian'].map(t => `<button class="xrd-tone ${t===settings.defaultTone?'active':''}" data-t="${t}">${{casual:'😎',professional:'👔',provocative:'🔥',contrarian:'🤔'}[t]} ${t}</button>`).join('')}
  </div></div>
  <div class="xrd-field"><label>Prompt</label><select class="xrd-sel" id="xrd-ps"><option value="">Default</option>${prompts.map(p=>`<option value="${p.id}" data-txt="${encodeURIComponent(p.text)}">${p.text.slice(0,60)}</option>`).join('')}</select></div>
  <button class="xrd-gen" id="xrd-gen">✨ Generate</button>
  <div class="xrd-result" id="xrd-res" style="display:none"><textarea class="xrd-textarea" id="xrd-txt" rows="3"></textarea><div class="xrd-acts"><button class="xrd-btn2" id="xrd-regen">🔄 Redo</button><button class="xrd-btn1" id="xrd-use">📋 Use</button></div></div>
  <div class="xrd-loading" id="xrd-load" style="display:none"><div class="xrd-spin"></div>Generating...</div>
  <div class="xrd-err" id="xrd-err" style="display:none"></div>
</div>`;
  const bar = article.querySelector('[role="group"]');
  if (bar) bar.parentElement?.insertBefore(panel, bar.nextSibling); else article.appendChild(panel);
  let tone = settings.defaultTone, promptId = settings.defaultPromptId || '';
  panel.querySelector('.xrd-close')?.addEventListener('click', () => panel.remove());
  panel.querySelectorAll('.xrd-tone').forEach(b => b.addEventListener('click', () => { panel.querySelectorAll('.xrd-tone').forEach(x => x.classList.remove('active')); b.classList.add('active'); tone = (b as HTMLElement).dataset.t || 'casual'; }));
  const sel = panel.querySelector('#xrd-ps') as HTMLSelectElement;
  sel?.addEventListener('change', () => { promptId = sel.value; });
  async function gen() {
    const load = panel.querySelector('#xrd-load') as HTMLElement, res = panel.querySelector('#xrd-res') as HTMLElement;
    const txt = panel.querySelector('#xrd-txt') as HTMLTextAreaElement, err = panel.querySelector('#xrd-err') as HTMLElement;
    const btn = panel.querySelector('#xrd-gen') as HTMLButtonElement;
    load.style.display = 'flex'; res.style.display = 'none'; err.style.display = 'none'; btn.disabled = true;
    let pt = 'Write a natural, engaging reply.';
    if (promptId) { const o = sel?.selectedOptions[0]; if (o?.dataset.txt) pt = decodeURIComponent(o.dataset.txt); }
    try { txt.value = await generateDraftDirect(post.content, post.author, pt, tone); res.style.display = 'block'; }
    catch (e: any) { err.textContent = e.message; err.style.display = 'block'; }
    load.style.display = 'none'; btn.disabled = false;
  }
  panel.querySelector('#xrd-gen')?.addEventListener('click', gen);
  panel.querySelector('#xrd-regen')?.addEventListener('click', gen);
  panel.querySelector('#xrd-use')?.addEventListener('click', async () => {
    const text = (panel.querySelector('#xrd-txt') as HTMLTextAreaElement)?.value; if (!text) return;
    const reply = article.querySelector('[data-testid="reply"]') as HTMLElement;
    if (reply) { reply.click(); await new Promise(r => setTimeout(r, 500));
      const box = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
      if (box) { box.focus(); document.execCommand('insertText', false, text);
        try { await addLocalPost({ tweetId: post.tweetId, replyTweetId: '', originalAuthor: post.author, originalContent: post.content, replyContent: text, promptId, tone, likes: 0, retweets: 0, replies: 0, impressions: 0, postedAt: new Date().toISOString(), lastTrackedAt: new Date().toISOString() }); } catch {}
        if (settings.autoSubmit) { await new Promise(r => setTimeout(r, 300)); (document.querySelector('[data-testid="tweetButtonInline"]') as HTMLElement)?.click(); }
      }
    }
    panel.remove();
  });
}
function process() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
    if (a.hasAttribute(ATTR)) return; a.setAttribute(ATTR, '1');
    const g = a.querySelector('[role="group"]'); if (!g) return;
    const c = document.createElement('div'); c.className = 'xrd-btn-wrap';
    const b = document.createElement('button'); b.className = 'xrd-draft-btn'; b.innerHTML = '✍️'; b.title = 'Draft AI Reply';
    b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); showPanel(a); });
    c.appendChild(b); g.appendChild(c);
  });
}
const obs = new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) requestAnimationFrame(process); });
function init() { process(); obs.observe(document.body, { childList: true, subtree: true }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
let lastUrl = location.href;
new MutationObserver(() => { if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(process, 1000); } }).observe(document.body, { childList: true, subtree: true });
