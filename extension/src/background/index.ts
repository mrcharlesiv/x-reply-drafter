// Smart Reply Engine - Minimal version for extension
// Full version in backend; this is a thin client

function classifyTweet(text: string): string {
  const lower = text.toLowerCase();
  if (/\?/.test(text) && /^(what|how|why|who|when|where|is|are|do|does|can|could|would|should)/i.test(lower)) return 'question';
  if (/😂|💀|lmao|lol|shitpost|meme/i.test(text) && text.length < 100) return 'meme';
  if (/unpopular opinion|hot take|controversial|hear me out/i.test(text)) return 'hot-take';
  if (/announcing|launched|releasing|introducing|🚀|🎉/i.test(text)) return 'announcement';
  return 'statement';
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DRAFT_REPLY") {
    handleDraftReply(message.payload).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "SAVE_POST") {
    handleSavePost(message.payload);
    return false;
  }
  if (message.type === "TRACK_ENGAGEMENT") {
    handleTrackEngagement(message.payload);
    return false;
  }
  return false;
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      userId: "",
      backendUrl: "",
      apiKey: "",
      apiProvider: "openai",
      apiBaseUrl: "",
      selectedModel: "gpt-4o-mini",
      autoSubmit: false,
      defaultTone: "viral-model",
      activePromptId: "",
      prompts: []
    }, resolve);
  });
}

async function handleDraftReply(payload: any) {
  const { tweetText, author } = payload;
  const settings = await getSettings();

  // Determine backend URL
  const backendUrl = settings.backendUrl || "https://x-reply-drafter-site.vercel.app";

  // Call backend smart reply endpoint
  const response = await fetch(`${backendUrl}/api/drafts/simple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweetText, author: author || "unknown" }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Failed to generate draft");
  }

  // Return the smart-scored draft with metadata
  return {
    draft: result.draft,
    tweetType: result.tweetType,
    strategies: result.strategies,
    score: result.score,
    issues: result.issues,
    note: result.note,
  };
}

async function handleSavePost(payload: any) {
  const { text, engagement } = payload;
  const settings = await getSettings();
  
  let posts: any[] = [];
  await new Promise((resolve) => {
    chrome.storage.local.get({ posts: [] }, (data) => {
      posts = data.posts || [];
      resolve(null);
    });
  });

  posts.push({
    id: Math.random().toString(36).substring(7),
    text,
    engagement: engagement || {},
    createdAt: new Date().toISOString(),
  });

  await new Promise((resolve) => {
    chrome.storage.local.set({ posts }, resolve);
  });
}

async function handleTrackEngagement(payload: any) {
  const { replyUrl, replyText } = payload;
  const settings = await getSettings();
  const backendUrl = settings.backendUrl || "https://x-reply-drafter-site.vercel.app";

  // POST engagement data to backend
  await fetch(`${backendUrl}/api/engagement/log-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: replyUrl, text: replyText, timestamp: new Date().toISOString() }),
  }).catch(err => console.error("Engagement tracking failed:", err));
}

export {};
