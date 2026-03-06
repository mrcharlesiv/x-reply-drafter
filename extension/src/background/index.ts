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

// ═══════════════════════════════════════════════════════════════════════════
// SMART REPLY ENGINE v2 — Ported from reply-guy-research/smart-reply-engine
// ═══════════════════════════════════════════════════════════════════════════

function classifyTweet(text: string): string {
  const lower = text.toLowerCase().trim();
  const questionMarks = (text.match(/\?/g) || []).length;
  const startsWithQ = /^(what|how|why|when|where|who|which|is|are|do|does|can|could|would|should|have|has|will)/i.test(lower);
  if (questionMarks >= 1 && (startsWithQ || text.trim().endsWith('?'))) return 'question';
  if (/😂|💀|🤣|😅|lmao|lol|shitpost|meme/i.test(text) || (text.length < 30 && /[😂💀🤣🫠😭]/.test(text))) return 'meme';
  if (/\b(I (just|recently|finally)|my (wife|husband|kid|son|daughter|dog|mom|dad)|yesterday|last (week|night|month)|true story|confession)/i.test(text)) return 'personal-story';
  if (/\b(announcing|launched|launching|releasing|just shipped|introducing|we're (excited|thrilled)|breaking|new feature|now available|just dropped)\b/i.test(text) || /🚀|🎉|📢/.test(text)) return 'announcement';
  if (/\b(unpopular opinion|hot take|controversial|hear me out|i think|the truth is|nobody talks about|everyone is wrong)\b/i.test(text) || (text.length < 200 && /\b(is (dead|dying|overrated|underrated|broken|the future))\b/i.test(text))) return 'hot-take';
  if (/\b(1\.|1\)|1\/|step 1|rule 1|thread|🧵)\b/i.test(text) || (text.match(/\d+[\.\)\/]/g) || []).length >= 3) return 'list-thread';
  return 'statement';
}

const STRATEGY_MAP = {
  'question':       { primary: ['personal-story','yes-and','humor'], avoid: ['question','reframe'], note: "Answer the question directly. Do NOT ask another question back.", lengthHint: 'short-or-substantive' },
  'statement':      { primary: ['question','yes-and','humor'], avoid: ['reframe','generic-agreement'], note: "Add a new angle the author didn't consider.", lengthHint: 'any-bimodal' },
  'hot-take':       { primary: ['question','contrarian','yes-and'], avoid: ['reframe','generic-agreement'], note: "Either challenge it sharply or add surprising agreement with a twist.", lengthHint: 'short-preferred' },
  'personal-story': { primary: ['quick-react','personal-story','yes-and'], avoid: ['humor','contrarian','reframe'], note: "Show genuine empathy. NEVER be funny about vulnerability.", lengthHint: 'short-or-medium' },
  'announcement':   { primary: ['question','yes-and','humor','quick-react'], avoid: ['contrarian','reframe'], note: "React genuinely or ask about implications.", lengthHint: 'any-bimodal' },
  'meme':           { primary: ['humor','quick-react'], avoid: ['framework','contrarian','question','reframe','personal-story'], note: "Be funny or don't reply. Under 50 chars ONLY. Never write a serious reply to a joke.", lengthHint: 'ultra-short' },
  'list-thread':    { primary: ['question','yes-and','contrarian'], avoid: ['framework','reframe'], note: "Reference a specific point. Don't restate the whole list.", lengthHint: 'any-bimodal' },
};

function selectStrategies(tweetType: string) {
  return STRATEGY_MAP[tweetType] || STRATEGY_MAP['statement'];
}

function buildSmartPrompt(tweetType: string, strategies: any, customInstructions?: string) {
  const stratDescs = {
    'question': 'Ask a pointed follow-up question that adds a new angle. The question should imply insight.',
    'yes-and': "Agree briefly, then add a genuinely novel observation the author didn't mention.",
    'humor': 'Be genuinely funny. Clever wordplay, unexpected observation, or deadpan wit.',
    'quick-react': 'Ultra-short reaction. Under 20 chars. Emoji, one word, or a punchy fragment.',
    'personal-story': 'Share a brief, specific personal experience (1-2 sentences max).',
    'contrarian': 'Challenge one specific point with a sharp, brief objection.',
    'framework': 'Add a structured insight or relevant quote with attribution.',
  };
  const stratInstructions = strategies.primary.map((s, i) => `Draft ${i + 1}: Use "${s}" strategy. ${stratDescs[s] || ''}`).join('\n');
  const avoidList = strategies.avoid.map(s => `"${s}"`).join(', ');
  const custom = customInstructions ? `\n\nAdditional user instructions: ${customInstructions}` : "";

  return `You are writing replies for X (Twitter). Your goal: maximum engagement through authenticity and wit.

TWEET TYPE DETECTED: ${tweetType}
${strategies.note}

GENERATE ${strategies.primary.length} DRAFTS using these specific strategies:
${stratInstructions}

Then generate 2 BONUS drafts using any strategy you think fits best.

HARD RULES:
- At least one draft MUST be under 50 characters
- NO draft should be between 50-100 characters (dead zone - go shorter or longer)
- At most one draft over 200 characters
- NEVER open with: "Great point", "Love this", "So true", "This!", "Absolutely", "Well said", "Nailed it", "Spot on"
- NEVER use hedging: "I think", "maybe", "perhaps", "it could be argued"
- NEVER use: delve, landscape, leverage, navigate, tapestry, robust, utilize, paramount, multifaceted, synergy, transformative, crucial, comprehensive, meticulous, seamless, groundbreaking, myriad, cornerstone, reimagine, empower, catalyst, foster, bolster, showcase, realm, plethora, furthermore, moreover, nevertheless, invaluable, profound
- NEVER use em dashes, semicolons, or bullet points
- NEVER wrap the reply in quotation marks
- DO NOT use strategies: ${avoidList}
- Write like a real person texting a smart friend, not like an AI writing an essay
- Use contractions naturally (it's, don't, wouldn't)${custom}

Return ONLY valid JSON:
{"drafts":[{"text":"reply text","strategy":"strategy-name"},{"text":"...","strategy":"..."}]}`;
}

// ─── Reply Scoring ───────────────────────────────────────────────────────────

const BANNED_OPENERS = [/^great (point|take|post|thread)/i,/^so true/i,/^this[.!]*$/i,/^love this/i,/^absolutely/i,/^i couldn't agree more/i,/^this resonates/i,/^well said/i,/^spot on/i,/^nailed it/i,/^couldn't have said it better/i];
const BANNED_PHRASES = ["it's worth noting","at the end of the day","game changer","food for thought","in today's world","let's dive in","the real story here","the real question is","what nobody is asking","what's interesting is","i think it's important","it could be argued","on one hand","on the other hand"];
const BANNED_WORDS = ['delve','tapestry','vibrant','crucial','comprehensive','meticulous','seamless','groundbreaking','leverage','synergy','transformative','paramount','multifaceted','myriad','cornerstone','reimagine','empower','catalyst','robust','landscape','navigate','utilize','furthermore','moreover','nevertheless','invaluable','profound','realm','plethora','foster','bolster','showcase','commence','facilitate','elucidate','augment','pivotal','underscore'];
const HEDGING = [/\bi think\b/i,/\bmaybe\b/i,/\bperhaps\b/i,/\bit could be\b/i,/\bpossibly\b/i,/\bmight be\b/i,/\bin my humble opinion\b/i];

function scoreReply(text: string, tweetType: string): { score: number; issues: string[] } {
  let score = 100; const issues: string[] = []; const len = text.length; const lower = text.toLowerCase(); const firstLine = text.split('\n')[0].trim();
  if (len >= 50 && len <= 100) { score -= 20; issues.push('dead-zone-length'); }
  if (len > 400) { score -= 25; issues.push('too-long'); }
  if (tweetType === 'meme' && len > 50) { score -= 30; issues.push('meme-too-long'); }
  for (const p of BANNED_OPENERS) { if (p.test(firstLine)) { score -= 40; issues.push('sycophantic-opener'); break; } }
  for (const phrase of BANNED_PHRASES) { if (lower.includes(phrase)) { score -= 15; issues.push('banned-phrase'); } }
  for (const word of BANNED_WORDS) { if (lower.includes(word)) { score -= 10; issues.push(`ai-word:${word}`); } }
  for (const p of HEDGING) { if (p.test(text)) { score -= 15; issues.push('hedging'); break; } }
  if (/—/.test(text)) { score -= 5; issues.push('em-dash'); }
  if (/;/.test(text) && len < 200) { score -= 5; issues.push('semicolon'); }
  if (/^"[^"]*"$/.test(text.trim())) { score -= 10; issues.push('wrapped-in-quotes'); }
  if (tweetType === 'question' && text.trim().endsWith('?') && !text.includes('\n')) { score -= 25; issues.push('re-questioning'); }
  if (tweetType === 'meme' && len > 100 && !/😂|💀|🤣|😅|lol|lmao|haha/i.test(text)) { score -= 30; issues.push('serious-meme-reply'); }
  return { score: Math.max(0, score), issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DRAFT HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleDraftReply(payload) {
  const s = await getS();
  if (!s.apiKey) return { error: "No API key configured. Open extension settings and add your API key." };

  const tweetType = classifyTweet(payload.text);
  const strategies = selectStrategies(tweetType);
  const ap = s.activePromptId ? s.prompts.find(p => p.id === s.activePromptId) : s.prompts[0];
  const sys = buildSmartPrompt(tweetType, strategies, ap?.text);
  const usr = `Reply to this tweet by @${payload.author}:\n\n"${payload.text}"\n\nGenerate your drafts now. Write like a human, not an AI. Be specific, not generic.`;

  console.log("[XRD] Draft request:", { provider: s.apiProvider, model: s.selectedModel, tweetType, strategies: strategies.primary });

  let rawResponse: string;

  if (s.apiProvider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": s.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: s.selectedModel || "claude-sonnet-4-6", max_tokens: 1200, system: sys, messages: [{ role: "user", content: usr }], temperature: 0.9 }),
    });
    if (!res.ok) { const e = await res.text(); console.error("Anthropic error:", res.status, e); throw new Error(`Anthropic error ${res.status}: ${e.slice(0, 200)}`); }
    const d = await res.json();
    rawResponse = d.content?.[0]?.text?.trim() || "";
  } else {
    const base = s.apiBaseUrl || "https://api.openai.com/v1";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` },
      body: JSON.stringify({ model: s.selectedModel || "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 1200, temperature: 0.9 }),
    });
    if (!res.ok) { const e = await res.text(); console.error("OpenAI error:", res.status, e); throw new Error(`API error ${res.status}: ${e.slice(0, 200)}`); }
    const d = await res.json();
    rawResponse = d.choices?.[0]?.message?.content?.trim() || "";
  }

  // Parse JSON drafts
  let drafts: { text: string; strategy: string }[] = [];
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*"drafts"[\s\S]*\}/);
    if (jsonMatch) { const parsed = JSON.parse(jsonMatch[0]); drafts = (parsed.drafts || []).filter(d => d.text?.length > 0); }
  } catch { console.warn("[XRD] JSON parse failed, using raw"); }

  if (drafts.length === 0) {
    let fb = rawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    try { const p = JSON.parse(fb); if (p.drafts) drafts = p.drafts; else drafts = [{ text: fb, strategy: 'fallback' }]; }
    catch { drafts = [{ text: fb, strategy: 'fallback' }]; }
  }

  // Score + deAI + pick best
  const scored = drafts.map(d => {
    const cleaned = deAI(d.text);
    const { score, issues } = scoreReply(cleaned, tweetType);
    return { text: cleaned, strategy: d.strategy, score, issues, chars: cleaned.length };
  }).filter(d => d.score >= 40).sort((a, b) => b.score - a.score);

  console.log("[XRD] Scored:", scored.map(d => ({ score: d.score, chars: d.chars, strategy: d.strategy, issues: d.issues })));

  if (scored.length === 0) {
    const allScored = drafts.map(d => { const c = deAI(d.text); const { score, issues } = scoreReply(c, tweetType); return { text: c, strategy: d.strategy, score, issues }; }).sort((a, b) => b.score - a.score);
    if (allScored.length > 0) return { draft: allScored[0].text, promptId: ap?.id || "", tone: tweetType, tweetType, score: allScored[0].score };
    return { error: "All drafts scored too low. Try a different model." };
  }

  const best = scored[0];
  return { draft: best.text, promptId: ap?.id || "", tone: tweetType, tweetType, score: best.score, strategy: best.strategy, alternates: scored.slice(1, 3).map(d => d.text) };
}

// ═══════════════════════════════════════════════════════════════════════════
// deAI POST-PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════

function deAI(text: string): string {
  let t = text;
  if (/^".*"$/.test(t.trim())) t = t.trim().slice(1, -1);

  const swaps: [RegExp, string][] = [
    [/\bdelve(?:s|d)?\b/gi,"dig"],[/\btapestry\b/gi,"mix"],[/\bvibrant\b/gi,"lively"],[/\bcrucial\b/gi,"key"],
    [/\bcomprehensive\b/gi,"full"],[/\bmeticulously\b/gi,"carefully"],[/\bseamlessly\b/gi,"smoothly"],
    [/\bgroundbreaking\b/gi,"new"],[/\bleverage(?:s|d)?\b/gi,"use"],[/\bsynergy\b/gi,"overlap"],
    [/\btransformative\b/gi,"big"],[/\bparamount\b/gi,"important"],[/\bmultifaceted\b/gi,"complex"],
    [/\bmyriad\b/gi,"many"],[/\bcornerstone\b/gi,"foundation"],[/\breimaginee?(?:s|d)?\b/gi,"rethink"],
    [/\bempower(?:s|ed|ing)?\b/gi,"help"],[/\bcatalyst\b/gi,"driver"],[/\bbolster(?:s|ed)?\b/gi,"boost"],
    [/\bfoster(?:s|ed|ing)?\b/gi,"build"],[/\brobust\b/gi,"strong"],[/\bpivotal\b/gi,"key"],
    [/\bunderscore(?:s|d)?\b/gi,"highlight"],[/\blandscape\b/gi,"space"],[/\bshowcase(?:s|d)?\b/gi,"show"],
    [/\bnavigat(?:e|es|ed|ing)\b/gi,"handle"],[/\bembark(?:s|ed)?\b/gi,"start"],[/\butiliz(?:e|es|ed|ing)\b/gi,"use"],
    [/\bfacilitat(?:e|es|ed|ing)\b/gi,"help"],[/\belucidat(?:e|es|ed|ing)\b/gi,"explain"],
    [/\bprofoundly\b/gi,"deeply"],[/\binvaluable\b/gi,"useful"],[/\brealm\b/gi,"area"],[/\bplethora\b/gi,"lot"],
    [/\badditionally\b/gi,"also"],[/\bfurthermore\b/gi,"also"],[/\bmoreover\b/gi,"also"],
    [/\bnevertheless\b/gi,"still"],[/\bnonetheless\b/gi,"still"],[/\bconsequently\b/gi,"so"],
    [/\bnotwithstanding\b/gi,"despite"],
  ];
  for (const [re, rep] of swaps) t = t.replace(re, rep);

  const phrases: [RegExp, string][] = [
    [/\bIn today'?s (?:world|landscape|digital age|era)\b/gi,""],[/\bAt the end of the day[,]?\s*/gi,""],
    [/\bI couldn'?t agree more\b/gi,"Agreed"],[/\bThis resonates (?:deeply |so much |with me)\b/gi,"I feel this"],
    [/\bserves as a testament to\b/gi,"shows"],[/\bin the realm of\b/gi,"in"],
    [/\bharness the power of\b/gi,"use"],[/\bgame[- ]changer\b/gi,"big deal"],[/\bkey takeaway\b/gi,"main point"],
  ];
  for (const [re, rep] of phrases) t = t.replace(re, rep);

  t = t.replace(/\s*—\s*/g, " - ");
  t = t.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/;\s*/g, ". ");
  t = t.replace(/^\s*[\u2022•●]\s*/gm, "").replace(/^\s*\d+[.)]\s*/gm, "");
  t = t.replace(/^[\s]*(?:[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*)+/gu, "");
  t = t.replace(/^(?:Great (?:point|take|insight)[!.]?\s*)/i, "");
  t = t.replace(/^(?:Love this[!.]?\s*)/i, "");
  t = t.replace(/^(?:This is (?:great|amazing|brilliant|fantastic)[!.]?\s*)/i, "");
  t = t.replace(/\s{2,}/g, " ").trim().replace(/^[,.\s]+/, "").trim();
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC & STORAGE
// ═══════════════════════════════════════════════════════════════════════════

async function syncToBackend(path: string, body: object) {
  try { const s = await getS(); if (!s.backendUrl || !s.userId) return;
    await fetch(`${s.backendUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": s.userId }, body: JSON.stringify(body) });
  } catch (err) { console.warn("Backend sync failed:", err); }
}

async function handleSavePost(payload) {
  const s = await getS();
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const post = { ...payload, timestamp: Date.now(), engagement: { likes: 0, retweets: 0, replies: 0, impressions: 0, lastChecked: 0 }, notes: "" };
  data.posts.unshift(post);
  if (data.posts.length > 500) data.posts = data.posts.slice(0, 500);
  await chrome.storage.local.set({ posts: data.posts });

  try { await fetch("http://127.0.0.1:9847/draft", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.postId, postAuthor: post.postAuthor, postText: post.postText, replyText: post.replyText, promptId: post.promptId, tone: post.tone, model: s.selectedModel || "unknown", tweetType: payload.tweetType || "", score: payload.score || 0, strategy: payload.strategy || "" }),
  }); } catch (err) { console.warn("Draft receiver not running:", err.message); }

  syncToBackend("/api/posts", { postId: post.postId, postAuthor: post.postAuthor, postText: post.postText, replyText: post.replyText, promptId: post.promptId, tone: post.tone });
}

async function handleTrackEngagement(payload) {
  const data = await new Promise(r => chrome.storage.local.get({ posts: [] }, r));
  const idx = data.posts.findIndex(p => p.postId === payload.postId || p.replyPostId === payload.postId);
  if (idx >= 0) { data.posts[idx].engagement = { ...payload, lastChecked: Date.now() }; await chrome.storage.local.set({ posts: data.posts });
    syncToBackend("/api/posts/track-engagement", { postId: payload.postId, likes: payload.likes, retweets: payload.retweets, replies: payload.replies });
  }
}

chrome.alarms.create("eng-check", { periodInMinutes: 30 });
