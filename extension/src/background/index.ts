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
  const toneMap = {
    professional: "Write a thoughtful, professional reply.",
    casual: "Write a casual, conversational reply.",
    provocative: "Write a bold, provocative reply.",
    contrarian: "Write a contrarian reply.",
  };
  
  const baseTone = toneMap[tone] || toneMap.casual;
  const customNote = custom ? `\n\nAdditional instructions: ${custom}` : "";
  
  return `You are a skilled X (Twitter) reply writer.

${baseTone}

Rules:
- Keep it concise (under 280 characters preferred)
- Sound natural and human, not AI-generated
- Be specific and substantive - no generic filler
- Match the tone of the conversation
- Return ONLY the reply text, no metadata${customNote}`;
}

async function handleDraftReply(payload) {
  const s = await getS();
  if (!s.apiKey) {
    return { error: "No API key configured. Open extension settings and add your API key." };
  }
  
  const ap = s.activePromptId
    ? s.prompts.find((p) => p.id === s.activePromptId)
    : s.prompts[0];
  
  const tone = s.defaultTone || "casual";
  const sys = buildSysPrompt(tone, ap?.text);
  const usr = `Reply to this X post by @${payload.author}: "${payload.text}"`;
  
  let draft;
  
  if (s.apiProvider === "anthropic") {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": s.apiKey,
          "anthropic-version": "2023-06-01",
          // Note: anthropic-dangerous-direct-browser-access removed - use backend for Anthropic
        },
        body: JSON.stringify({
          model: s.selectedModel || "claude-3-5-sonnet-20241022",
          max_tokens: 300,
          system: sys,
          messages: [{ role: "user", content: usr }],
          temperature: 0.8,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          throw new Error("Invalid Anthropic API key");
        }
        throw new Error(`Anthropic API error: ${res.status}`);
      }

      const d = await res.json();
      if (!d.content || !d.content[0]) {
        throw new Error("Invalid Anthropic response format");
      }
      draft = d.content[0].text.trim();
    } catch (err) {
      console.error("Anthropic error:", err);
      throw new Error(
        `Anthropic call failed: ${err.message}. Note: Direct browser calls to Anthropic may be blocked. Consider using OpenAI or a backend proxy.`
      );
    }
  } else {
    // OpenAI or custom endpoint
    try {
      const base = s.apiBaseUrl || "https://api.openai.com/v1";
      
      // Validate custom endpoint format
      if (s.apiBaseUrl && !s.apiBaseUrl.match(/^https?:\/\/.+/i)) {
        throw new Error(
          `Invalid custom API base URL: "${s.apiBaseUrl}". Should be like "https://api.example.com/v1"`
        );
      }

      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.apiKey}`,
        },
        body: JSON.stringify({
          model: s.selectedModel || "gpt-4o-mini",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: usr },
          ],
          max_tokens: 300,
          temperature: 0.8,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          throw new Error("Invalid API key for selected provider");
        }
        if (res.status === 404) {
          throw new Error(`Model not found. Check your selected model or endpoint.`);
        }
        throw new Error(`API error: ${res.status}`);
      }

      const d = await res.json();
      if (!d.choices || !d.choices[0] || !d.choices[0].message) {
        throw new Error("Invalid API response format");
      }
      draft = d.choices[0].message.content.trim();
    } catch (err) {
      console.error("LLM error:", err);
      throw err;
    }
  }
  
  return { draft, promptId: ap?.id || "", tone };
}

async function syncToBackend(path: string, body: object) {
  try {
    const s = await getS();
    if (!s.backendUrl || !s.userId) return;
    await fetch(`${s.backendUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": s.userId,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("Backend sync failed (non-blocking):", err);
  }
}

async function handleSavePost(payload) {
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const post = { ...payload, timestamp: Date.now(), engagement: { likes: 0, retweets: 0, replies: 0, impressions: 0, lastChecked: 0 }, notes: "" };
  data.posts.unshift(post);
  if (data.posts.length > 500) data.posts = data.posts.slice(0, 500);
  await chrome.storage.local.set({ posts: data.posts });

  // Sync to backend (fire-and-forget)
  syncToBackend("/api/posts", {
    postId: post.postId,
    postAuthor: post.postAuthor,
    postText: post.postText,
    replyText: post.replyText,
    promptId: post.promptId,
    tone: post.tone,
  });
}

async function handleTrackEngagement(payload) {
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const idx = data.posts.findIndex(p => p.postId === payload.postId || p.replyPostId === payload.postId);
  if (idx >= 0) {
    data.posts[idx].engagement = { ...payload, lastChecked: Date.now() };
    await chrome.storage.local.set({ posts: data.posts });

    // Sync to backend (fire-and-forget)
    syncToBackend("/api/posts/track-engagement", {
      postId: payload.postId,
      likes: payload.likes,
      retweets: payload.retweets,
      replies: payload.replies,
    });
  }
}

chrome.alarms.create("eng-check", { periodInMinutes: 30 });