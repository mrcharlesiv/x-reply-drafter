chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DRAFT_REPLY") { handleDraftReply(message.payload).then(sendResponse).catch(err => sendResponse({ error: err.message })); return true; }
  if (message.type === "SAVE_POST") { handleSavePost(message.payload); return false; }
  if (message.type === "TRACK_ENGAGEMENT") { handleTrackEngagement(message.payload); return false; }
  return false;
});

async function getS() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ userId: "", backendUrl: "", apiKey: "", apiProvider: "openai", apiBaseUrl: "", selectedModel: "gpt-4o-mini", autoSubmit: false, defaultTone: "casual", activePromptId: "", prompts: [] }, resolve);
  });
}

function buildSysPrompt(tone, custom) {
  const t = { professional: "Write a thoughtful, professional reply.", casual: "Write a casual, conversational reply.", provocative: "Write a bold, provocative reply.", contrarian: "Write a contrarian reply." };
  return "You are a skilled X reply writer. " + (t[tone] || t.casual) + " " + (custom ? "Additional: " + custom : "") + " Rules: Under 280 chars. Sound human. No filler. Be specific. Return ONLY reply text.";
}

async function handleDraftReply(payload) {
  const s = await getS();
  if (!s.apiKey) return { error: "No API key. Open extension > Settings." };
  const ap = s.activePromptId ? s.prompts.find(p => p.id === s.activePromptId) : s.prompts[0];
  const tone = s.defaultTone || "casual";
  const sys = buildSysPrompt(tone, ap?.text);
  const usr = "Reply to this X post by @" + payload.author + ": " + payload.text;
  let draft;
  if (s.apiProvider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": s.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: s.selectedModel, max_tokens: 300, system: sys, messages: [{ role: "user", content: usr }], temperature: 0.8 }) });
    if (!res.ok) throw new Error("Anthropic: " + (await res.text()));
    const d = await res.json(); draft = d.content[0].text.trim();
  } else {
    const base = s.apiBaseUrl || "https://api.openai.com/v1";
    const res = await fetch(base + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.apiKey }, body: JSON.stringify({ model: s.selectedModel, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 300, temperature: 0.8 }) });
    if (!res.ok) throw new Error("LLM: " + (await res.text()));
    const d = await res.json(); draft = d.choices[0].message.content.trim();
  }
  return { draft, promptId: ap?.id || "", tone };
}

async function handleSavePost(payload) {
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const post = { ...payload, timestamp: Date.now(), engagement: { likes: 0, retweets: 0, replies: 0, impressions: 0, lastChecked: 0 }, notes: "" };
  data.posts.unshift(post);
  if (data.posts.length > 500) data.posts = data.posts.slice(0, 500);
  await chrome.storage.local.set({ posts: data.posts });
}

async function handleTrackEngagement(payload) {
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const idx = data.posts.findIndex(p => p.postId === payload.postId || p.replyPostId === payload.postId);
  if (idx >= 0) { data.posts[idx].engagement = { ...payload, lastChecked: Date.now() }; await chrome.storage.local.set({ posts: data.posts }); }
}

chrome.alarms.create("eng-check", { periodInMinutes: 30 });