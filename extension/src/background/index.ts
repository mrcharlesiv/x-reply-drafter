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
- Sound like a real person, not AI. Write like you text a friend.
- Use contractions naturally (it's, don't, wouldn't)
- Be specific and substantive — no generic filler
- Match the tone of the conversation
- NEVER use these words: delve, tapestry, vibrant, crucial, comprehensive, meticulous, seamless, groundbreaking, leverage, synergy, transformative, paramount, multifaceted, myriad, cornerstone, reimagine, empower, catalyst, robust, landscape, navigate, utilize, furthermore, moreover, nevertheless, invaluable, profound, realm, plethora, foster, bolster, showcase, commence, facilitate, elucidate, augment, pivotal, underscore
- NEVER start with: "Great point", "Love this", "This is so true", "Absolutely", "I couldn't agree more", "This resonates", emoji
- NEVER use phrases: "at the end of the day", "game changer", "food for thought", "it's worth noting", "in today's world", "let's dive in", "the real story here"
- Just say the thing. Get to the point. Be direct.
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
  
  console.log("[XRD] Draft request:", { provider: s.apiProvider, model: s.selectedModel, hasKey: !!s.apiKey, keyPrefix: s.apiKey?.slice(0, 8) + "..." });
  
  let draft;
  
  if (s.apiProvider === "anthropic") {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": s.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
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
        console.error("Anthropic error response:", res.status, errText);
        if (res.status === 401) {
          throw new Error("Invalid Anthropic API key");
        }
        throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 200)}`);
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
        console.error("OpenAI error response:", res.status, errText);
        if (res.status === 401) {
          throw new Error("Invalid API key for selected provider");
        }
        if (res.status === 404) {
          throw new Error(`Model "${s.selectedModel}" not found. Check your selected model or endpoint.`);
        }
        throw new Error(`API error ${res.status}: ${errText.slice(0, 200)}`);
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
  
  // Strip AI-isms before returning
  draft = deAI(draft);
  
  return { draft, promptId: ap?.id || "", tone };
}

/**
 * Remove common AI writing patterns from draft text.
 * Runs after every LLM call — strips dead-giveaway words,
 * cliché openers, filler phrases, and over-enthusiastic patterns.
 */
function deAI(text: string): string {
  let t = text;

  // --- PHASE 1: Kill dead-giveaway AI words (replace with nothing or simpler alt) ---
  const wordSwaps: [RegExp, string][] = [
    // Tier 1: Absolute dead giveaways
    [/\bdelve(?:s|d)?\b/gi, "dig"],
    [/\btapestry\b/gi, "mix"],
    [/\bvibrant\b/gi, "lively"],
    [/\bcrucial\b/gi, "key"],
    [/\bcomprehensive\b/gi, "full"],
    [/\bmeticulous(?:ly)?\b/gi, "careful$1"],
    [/\bmeticulously\b/gi, "carefully"],
    [/\bseamless(?:ly)?\b/gi, "smooth$1"],
    [/\bseamlessly\b/gi, "smoothly"],
    [/\bgroundbreaking\b/gi, "new"],
    [/\bleverage(?:s|d)?\b/gi, "use"],
    [/\bsynergy\b/gi, "overlap"],
    [/\btransformative\b/gi, "big"],
    [/\bparamount\b/gi, "important"],
    [/\bmultifaceted\b/gi, "complex"],
    [/\bmyriad\b/gi, "many"],
    [/\bcornerstone\b/gi, "foundation"],
    [/\breimaginee?(?:s|d)?\b/gi, "rethink"],
    [/\bempower(?:s|ed|ing)?\b/gi, "help"],
    [/\bcatalyst\b/gi, "driver"],
    [/\bbolster(?:s|ed)?\b/gi, "boost"],
    [/\bfoster(?:s|ed|ing)?\b/gi, "build"],
    [/\brobust\b/gi, "strong"],
    [/\bpivotal\b/gi, "key"],
    [/\bunderscore(?:s|d)?\b/gi, "highlight"],
    [/\blandscape\b/gi, "space"],
    [/\bshowcase(?:s|d)?\b/gi, "show"],
    [/\bnavigat(?:e|es|ed|ing)\b/gi, "handle"],
    [/\bembark(?:s|ed)?\b/gi, "start"],
    [/\beverchanging\b/gi, "changing"],
    [/\bever-changing\b/gi, "changing"],
    [/\bintricate\b/gi, "complex"],
    [/\bcommenc(?:e|es|ed)\b/gi, "start"],
    [/\butiliz(?:e|es|ed|ing)\b/gi, "use"],
    [/\bfacilitat(?:e|es|ed|ing)\b/gi, "help"],
    [/\bencompass(?:es|ed|ing)?\b/gi, "include"],
    [/\baugment(?:s|ed|ing)?\b/gi, "add to"],
    [/\belucidat(?:e|es|ed|ing)\b/gi, "explain"],
    [/\bdemystif(?:y|ies|ied|ying)\b/gi, "clarify"],
    [/\bprofound(?:ly)?\b/gi, "deep"],
    [/\bprofoundly\b/gi, "deeply"],
    [/\binvaluable\b/gi, "useful"],
    [/\bundeniable?\b/gi, "clear"],
    [/\brealm\b/gi, "area"],
    [/\bplethora\b/gi, "lot"],

    // Tier 2: Softer giveaways
    [/\badditionally\b/gi, "also"],
    [/\bfurthermore\b/gi, "also"],
    [/\bmoreover\b/gi, "also"],
    [/\bnevertheless\b/gi, "still"],
    [/\bnonetheless\b/gi, "still"],
    [/\bconsequently\b/gi, "so"],
    [/\bsubsequently\b/gi, "then"],
    [/\bnotwithstanding\b/gi, "despite"],
    [/\bin\s+essence\b/gi, "basically"],
    [/\bIt'?s\s+worth\s+noting\s+that\b/gi, ""],
    [/\bIt\s+is\s+important\s+to\s+note\s+that\b/gi, ""],
    [/\bIt'?s\s+important\s+to\s+note\b/gi, ""],
  ];

  for (const [re, replacement] of wordSwaps) {
    t = t.replace(re, replacement);
  }

  // --- PHASE 2: Kill cliché AI phrases ---
  const phraseKills: [RegExp, string][] = [
    [/\bIn today'?s (?:world|landscape|digital age|era)\b/gi, ""],
    [/\bLet'?s (?:dive|delve|unpack)\b/gi, ""],
    [/\bAt the end of the day[,]?\s*/gi, ""],
    [/\bThe real (?:story|takeaway|question) here is\b/gi, ""],
    [/\bWhat'?s interesting is\b/gi, ""],
    [/\bHere'?s the thing[:\s]*/gi, ""],
    [/\bThe thing is[,]?\s*/gi, ""],
    [/\bI couldn'?t agree more\b/gi, "Agreed"],
    [/\bThis is (?:so |really |truly )?spot[- ]on\b/gi, "Good point"],
    [/\bAbsolutely[!.]?\s*(?=\w)/gi, ""],
    [/\bThis resonates (?:deeply |so much |with me)\b/gi, "I feel this"],
    [/\bserves as a testament to\b/gi, "shows"],
    [/\bin the realm of\b/gi, "in"],
    [/\bharness the power of\b/gi, "use"],
    [/\ba testament to\b/gi, "proof of"],
    [/\bshed(?:s)? light on\b/gi, "explain"],
    [/\bpave(?:s|d)? the way\b/gi, "lead"],
    [/\bgame[- ]changer\b/gi, "big deal"],
    [/\bfood for thought\b/gi, "worth thinking about"],
    [/\btip of the iceberg\b/gi, "just the start"],
    [/\bonly time will tell\b/gi, "we'll see"],
    [/\bat the forefront\b/gi, "leading"],
    [/\bthe bottom line is\b/gi, ""],
    [/\bkey takeaway\b/gi, "main point"],
  ];

  for (const [re, replacement] of phraseKills) {
    t = t.replace(re, replacement);
  }

  // --- PHASE 3: Kill emoji spam (AI loves starting with 🔥💡🚀) ---
  // Remove leading emojis
  t = t.replace(/^[\s]*(?:[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*)+/gu, "");

  // --- PHASE 4: Kill over-enthusiastic openers ---
  t = t.replace(/^(?:Great (?:point|take|insight)[!.]?\s*)/i, "");
  t = t.replace(/^(?:Love this[!.]?\s*)/i, "");
  t = t.replace(/^(?:This is (?:great|amazing|brilliant|fantastic)[!.]?\s*)/i, "");
  t = t.replace(/^(?:What a (?:great|brilliant|fantastic|insightful) (?:point|take|post|thread)[!.]?\s*)/i, "");

  // --- PHASE 5: Clean up artifacts ---
  // Fix double spaces from removals
  t = t.replace(/\s{2,}/g, " ");
  // Fix leading/trailing whitespace
  t = t.trim();
  // Fix sentences starting with lowercase after removal
  t = t.replace(/^\s*([a-z])/, (_, c) => c.toUpperCase());
  // Remove leading comma/period from phrase removals
  t = t.replace(/^[,.\s]+/, "").trim();
  // Capitalize first letter
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);

  return t;
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