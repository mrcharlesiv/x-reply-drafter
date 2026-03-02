chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('track-engagement', { periodInMinutes: 30 }); });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'track-engagement') return;
  const { posts = [] } = await chrome.storage.local.get('posts');
  const week = Date.now() - 7*24*60*60*1000;
  const recent = posts.filter((p: any) => new Date(p.postedAt).getTime() > week && p.replyTweetId);
  if (!recent.length) return;
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*','https://twitter.com/*'] });
  if (!tabs.length || !tabs[0].id) return;
  for (const p of recent.slice(0,10)) { try { chrome.tabs.sendMessage(tabs[0].id, { type: 'TRACK', id: p.replyTweetId }); } catch {} }
});
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg.type === 'ENGAGEMENT_UPDATE') {
    chrome.storage.local.get('posts', r => { const ps = r.posts || []; const p = ps.find((x:any) => x.replyTweetId === msg.data.replyTweetId); if (p) { Object.assign(p, msg.data, { lastTrackedAt: new Date().toISOString() }); chrome.storage.local.set({ posts: ps }); } });
    reply({ ok: true }); return true;
  }
  if (msg.type === 'OPEN_DASHBOARD') { chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }); reply({ ok: true }); return true; }
});
