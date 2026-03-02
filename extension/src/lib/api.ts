interface LLMConfig { apiKey: string; baseUrl: string; model: string; provider: 'openai' | 'anthropic' | 'openai-compatible'; }
export async function getStoredLLMConfig(): Promise<LLMConfig | null> {
  return new Promise(r => chrome.storage.local.get(['llmApiKey','llmBaseUrl','llmModel','llmProvider'], d => {
    if (!d.llmApiKey) return r(null);
    r({ apiKey: d.llmApiKey, baseUrl: d.llmBaseUrl || 'https://api.openai.com/v1', model: d.llmModel || 'gpt-4o', provider: d.llmProvider || 'openai' });
  }));
}
function sysPrompt(p: string, tone: string): string {
  const m: Record<string,string> = { professional: 'Professional, polished tone.', casual: 'Casual, like texting a friend.', provocative: 'Bold and provocative.', contrarian: 'Take the opposite view.' };
  return `You are a reply writer for X.\n${m[tone]||m.casual}\nInstructions: ${p}\nRules: Under 280 chars. Genuine. No hashtags. Like a real person.`;
}
export async function generateDraftDirect(postContent: string, postAuthor: string, prompt: string, tone: string): Promise<string> {
  const c = await getStoredLLMConfig();
  if (!c) throw new Error('No API key. Open extension popup to configure.');
  const sys = sysPrompt(prompt, tone);
  const user = `Reply to @${postAuthor}:\n"${postContent}"\nJust the reply, nothing else.`;
  if (c.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: c.model, max_tokens: 500, system: sys, messages: [{ role: 'user', content: user }], temperature: 0.8 }) });
    if (!r.ok) throw new Error(`Anthropic error: ${r.status}`);
    return ((await r.json()).content?.[0]?.text || '').trim();
  }
  const r = await fetch(`${c.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` }, body: JSON.stringify({ model: c.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: 500, temperature: 0.8 }) });
  if (!r.ok) throw new Error(`LLM error: ${r.status}`);
  return ((await r.json()).choices?.[0]?.message?.content || '').trim();
}
export async function fetchModelsDirect(apiKey: string, baseUrl: string, provider: string): Promise<string[]> {
  if (provider === 'anthropic') return ['claude-sonnet-4-20250514','claude-haiku-4-20250414','claude-3-5-sonnet-20241022'];
  try { const r = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }); if (!r.ok) return []; const d = await r.json(); return (d.data||d).map((m:any) => m.id||m.name).filter(Boolean).sort(); } catch { return []; }
}
