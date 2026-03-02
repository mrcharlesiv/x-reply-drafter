export interface LocalPrompt { id: string; text: string; tags: string[]; tone: string; useCount: number; totalEngagement: number; avgEngagement: number; createdAt: string; }
export interface LocalPost { id: string; tweetId: string; replyTweetId: string; originalAuthor: string; originalContent: string; replyContent: string; promptId: string; tone: string; likes: number; retweets: number; replies: number; impressions: number; postedAt: string; lastTrackedAt: string; }
export interface LocalSettings { llmApiKey: string; llmBaseUrl: string; llmModel: string; llmProvider: 'openai' | 'anthropic' | 'openai-compatible'; autoSubmit: boolean; defaultTone: string; defaultPromptId: string | null; }
const DEFAULTS: LocalSettings = { llmApiKey: '', llmBaseUrl: 'https://api.openai.com/v1', llmModel: 'gpt-4o', llmProvider: 'openai', autoSubmit: false, defaultTone: 'casual', defaultPromptId: null };
export function getSettings(): Promise<LocalSettings> { return new Promise(r => chrome.storage.local.get(null, a => r({ ...DEFAULTS, ...a } as LocalSettings))); }
export function saveSettings(p: Partial<LocalSettings>): Promise<void> { return new Promise(r => chrome.storage.local.set(p, r)); }
export function getLocalPrompts(): Promise<LocalPrompt[]> { return new Promise(r => chrome.storage.local.get('prompts', d => r(d.prompts || []))); }
function savePrompts(p: LocalPrompt[]): Promise<void> { return new Promise(r => chrome.storage.local.set({ prompts: p }, r)); }
export async function addLocalPrompt(text: string, tags: string[], tone: string): Promise<LocalPrompt> { const ps = await getLocalPrompts(); const p: LocalPrompt = { id: crypto.randomUUID().slice(0,12), text, tags, tone, useCount: 0, totalEngagement: 0, avgEngagement: 0, createdAt: new Date().toISOString() }; ps.push(p); await savePrompts(ps); return p; }
export async function deleteLocalPrompt(id: string): Promise<void> { await savePrompts((await getLocalPrompts()).filter(p => p.id !== id)); }
export function getLocalPosts(): Promise<LocalPost[]> { return new Promise(r => chrome.storage.local.get('posts', d => r(d.posts || []))); }
function savePosts(p: LocalPost[]): Promise<void> { return new Promise(r => chrome.storage.local.set({ posts: p }, r)); }
export async function addLocalPost(data: Omit<LocalPost, 'id'>): Promise<LocalPost> { const ps = await getLocalPosts(); const p: LocalPost = { id: crypto.randomUUID().slice(0,12), ...data }; ps.unshift(p); if (ps.length > 500) ps.length = 500; await savePosts(ps); return p; }
