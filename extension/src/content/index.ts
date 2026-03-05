const BC = 'xrd-draft-btn', DC = 'xrd-drafting';

/**
 * Resilient text extraction - tries multiple selector strategies
 */
function extractPostText(article) {
  // Try primary selector first
  let te = article.querySelector('[data-testid="tweetText"]');
  if (!te) {
    // Fallback: look for any div with role="article" containing text
    te = article.querySelector('div[lang]');
  }
  if (!te) {
    // Last resort: find the largest text container
    const textDivs = article.querySelectorAll('div[lang], [data-testid*="text"]');
    te = Array.from(textDivs).find((el) => (el.textContent?.length || 0) > 10);
  }
  return te?.textContent?.trim() || '';
}

/**
 * Extract author - multiple fallback strategies
 */
function extractAuthor(article) {
  // Try User-Name component first
  let un = article.querySelector('[data-testid="User-Name"]');
  let authorLink = null;
  
  if (un) {
    authorLink = un.querySelector('a[href*="/"]');
  }
  
  // Fallback: find any link that looks like a profile
  if (!authorLink) {
    const links = article.querySelectorAll('a[href*="/"]');
    authorLink = Array.from(links).find((l) => {
      const href = l.getAttribute('href') || '';
      return href.match(/^\/[a-zA-Z0-9_]+$/) && !href.includes('/status');
    });
  }
  
  if (authorLink) {
    const href = authorLink.getAttribute('href') || '';
    const match = href.match(/^\/([a-zA-Z0-9_]+)/);
    if (match) return match[1];
  }
  
  return '';
}

/**
 * Extract post ID from article - multiple strategies
 */
function extractPostId(article) {
  // Try timestamp link first (most reliable)
  const timeLink = article.querySelector('a[href*="/status/"]');
  if (timeLink) {
    const href = timeLink.getAttribute('href') || '';
    const m = href.match(/\/status\/(\d+)/);
    if (m) return m[1];
  }
  
  // Fallback: look at all article links
  const links = article.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/status\/(\d+)/);
    if (m) return m[1];
  }
  
  return '';
}

function extract(a) {
  const text = extractPostText(a);
  if (!text || text.length < 5) return null; // Minimum viable text
  
  const author = extractAuthor(a);
  const postId = extractPostId(a);
  
  if (!postId) return null; // Can't track without ID
  
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
    e.preventDefault();
    e.stopPropagation();
    
    if (b.classList.contains(DC)) return;
    b.classList.add(DC);
    
    const sp = b.querySelector('span');
    sp.textContent = '...';
    
    try {
      const pd = extract(a);
      if (!pd) {
        sp.textContent = 'Error';
        setTimeout(() => {
          sp.textContent = 'Draft';
          b.classList.remove(DC);
        }, 2000);
        return;
      }
      
      const r = await chrome.runtime.sendMessage({ type: 'DRAFT_REPLY', payload: pd });
      if (r?.error) {
        sp.textContent = 'Err';
        console.error('Draft error:', r.error);
        setTimeout(() => {
          sp.textContent = 'Draft';
          b.classList.remove(DC);
        }, 2000);
        return;
      }
      
      // Find and click reply button
      const rb = a.querySelector('[data-testid="reply"]');
      if (rb) {
        rb.click();
        await new Promise((resolve) => setTimeout(resolve, 600));
        
        // Find compose textarea - multiple fallback strategies
        let cb = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (!cb) {
          cb = document.querySelector('textarea[aria-label*="Post"]');
        }
        if (!cb) {
          cb = document.querySelector('div[role="textbox"][contenteditable="true"]');
        }
        if (!cb) {
          // Last resort: find any contenteditable div in compose area
          const composeArea = document.querySelector('[data-testid="tweetTextarea"]') || 
                             document.querySelector('[role="dialog"] [contenteditable]');
          cb = composeArea;
        }
        
        if (cb) {
          cb.focus();
          
          // Use DataTransfer paste — most reliable for Draft.js/React editors on X
          const dt = new DataTransfer();
          dt.setData('text/plain', r.draft);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          });
          cb.dispatchEvent(pasteEvent);
          
          // Save post data
          chrome.runtime.sendMessage({
            type: 'SAVE_POST',
            payload: {
              postId: pd.postId,
              postAuthor: pd.author,
              postText: pd.text.slice(0, 500),
              replyText: r.draft,
              promptId: r.promptId || '',
              tone: r.tone || 'casual',
            },
          });
          
          // Handle auto-submit
          chrome.storage.local.get({ autoSubmit: false }, (d) => {
            if (d.autoSubmit) {
              setTimeout(() => {
                // Try multiple submit button selectors
                let sb = document.querySelector('[data-testid="tweetButton"]');
                if (!sb) {
                  sb = document.querySelector('button[aria-label="Post"]');
                }
                if (!sb) {
                  sb = document.querySelector('button:contains("Post")') ||
                       Array.from(document.querySelectorAll('button')).find(
                         (btn) => btn.textContent.includes('Post')
                       );
                }
                if (sb) {
                  (sb as HTMLButtonElement).click();
                }
              }, 300);
            }
          });
        } else {
          console.warn('Could not find reply textarea');
          sp.textContent = 'Err';
        }
      }
      
      sp.textContent = 'Done';
      setTimeout(() => {
        sp.textContent = 'Draft';
        b.classList.remove(DC);
      }, 2000);
    } catch (err) {
      console.error('Draft error:', err);
      sp.textContent = 'Err';
      setTimeout(() => {
        sp.textContent = 'Draft';
        b.classList.remove(DC);
      }, 2000);
    }
  });
  bar.appendChild(b);
}
function scan() { document.querySelectorAll('article[data-testid="tweet"]').forEach(a => inject(a)); }
const obs = new MutationObserver(ms => { for (const m of ms) if (m.addedNodes.length) { requestAnimationFrame(scan); break; } });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { scan(); obs.observe(document.body, { childList: true, subtree: true }); });
else { scan(); obs.observe(document.body, { childList: true, subtree: true }); }
// Engagement tracking handled via X API (scripts/track-engagement.mjs)
// Content script only handles draft button injection + text insertion
