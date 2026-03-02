const BC = 'xrd-draft-btn', DC = 'xrd-drafting';
function extract(a) {
  const te = a.querySelector('[data-testid="tweetText"]'); const text = te?.textContent?.trim() || ''; if (!text) return null;
  let author = ''; const un = a.querySelector('[data-testid="User-Name"]');
  if (un) { const h = un.querySelector('a[tabindex="-1"]') || un.querySelectorAll('a')[1]; if (h) { const p = h.pathname; if (p) author = p.slice(1); } }
  let postId = ''; const tl = a.querySelector('a[href*="/status/"] time')?.parentElement;
  if (tl?.href) { const m = tl.href.match(/\/status\/(\d+)/); if (m) postId = m[1]; }
  return { text, author, postId };
}
function mkBtn() {
  const b = document.createElement('button'); b.className = BC;
  b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Draft</span>';
  b.title = 'Draft AI Reply'; return b;
}
function inject(a) {
  if (a.querySelector('.' + BC)) return;
  const bar = a.querySelector('[role="group"]'); if (!bar) return;
  const b = mkBtn();
  b.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (b.classList.contains(DC)) return; b.classList.add(DC);
    const sp = b.querySelector('span'); sp.textContent = '...';
    try {
      const pd = extract(a);
      if (!pd) { sp.textContent = 'Error'; setTimeout(() => { sp.textContent = 'Draft'; b.classList.remove(DC); }, 2000); return; }
      const r = await chrome.runtime.sendMessage({ type: 'DRAFT_REPLY', payload: pd });
      if (r?.error) { sp.textContent = 'Err'; setTimeout(() => { sp.textContent = 'Draft'; b.classList.remove(DC); }, 2000); return; }
      const rb = a.querySelector('[data-testid="reply"]');
      if (rb) {
        rb.click(); await new Promise(r => setTimeout(r, 500));
        const cb = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (cb) {
          cb.focus(); document.execCommand('insertText', false, r.draft);
          cb.dispatchEvent(new Event('input', { bubbles: true }));
          chrome.runtime.sendMessage({ type: 'SAVE_POST', payload: { postId: pd.postId, postAuthor: pd.author, postText: pd.text.slice(0, 500), replyText: r.draft, promptId: r.promptId || '', tone: r.tone || 'casual' } });
          chrome.storage.local.get({ autoSubmit: false }, d => {
            if (d.autoSubmit) setTimeout(() => { const sb = document.querySelector('[data-testid="tweetButton"],[data-testid="tweetButtonInline"]'); if (sb) sb.click(); }, 300);
          });
        }
      }
      sp.textContent = 'Done'; setTimeout(() => { sp.textContent = 'Draft'; b.classList.remove(DC); }, 2000);
    } catch (err) { sp.textContent = 'Err'; setTimeout(() => { sp.textContent = 'Draft'; b.classList.remove(DC); }, 2000); }
  });
  bar.appendChild(b);
}
function scan() { document.querySelectorAll('article[data-testid="tweet"]').forEach(a => inject(a)); }
const obs = new MutationObserver(ms => { for (const m of ms) if (m.addedNodes.length) { requestAnimationFrame(scan); break; } });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { scan(); obs.observe(document.body, { childList: true, subtree: true }); });
else { scan(); obs.observe(document.body, { childList: true, subtree: true }); }
setInterval(() => {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
    const pd = extract(a); if (!pd?.postId) return;
    const pc = s => { if (!s) return 0; s = s.trim().toLowerCase(); if (s.endsWith('k')) return parseFloat(s)*1000; if (s.endsWith('m')) return parseFloat(s)*1e6; return parseInt(s)||0; };
    const l = a.querySelector('[data-testid="like"] [data-testid="app-text-transition-container"]')?.textContent;
    const rt = a.querySelector('[data-testid="retweet"] [data-testid="app-text-transition-container"]')?.textContent;
    const rp = a.querySelector('[data-testid="reply"] [data-testid="app-text-transition-container"]')?.textContent;
    if (l||rt||rp) chrome.runtime.sendMessage({type:'TRACK_ENGAGEMENT',payload:{postId:pd.postId,likes:pc(l),retweets:pc(rt),replies:pc(rp)}});
  });
}, 30000);
