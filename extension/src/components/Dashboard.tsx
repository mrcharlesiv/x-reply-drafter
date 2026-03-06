import React, { useEffect, useState } from 'react';
export default function Dashboard() {
  const [stats, setStats] = useState({ totalPosts: 0, totalEngagement: 0 });
  const [activePrompt, setActivePrompt] = useState(null);
  const [tone, setTone] = useState('viral-model');
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [byTone, setByTone] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const data = await chrome.storage.local.get({ apiKey: '', defaultTone: 'viral-model', activePromptId: '', prompts: [], posts: [] });
    setHasKey(!!data.apiKey); setTone(data.defaultTone);
    const posts = data.posts || [];
    const totalEng = posts.reduce((s, p) => s + (p.engagement?.likes || 0) + (p.engagement?.retweets || 0) + (p.engagement?.replies || 0), 0);
    setStats({ totalPosts: posts.length, totalEngagement: totalEng });
    const toneMap = {};
    for (const p of posts) { if (!toneMap[p.tone]) toneMap[p.tone] = { total: 0, count: 0 }; toneMap[p.tone].total += (p.engagement?.likes||0)+(p.engagement?.retweets||0)+(p.engagement?.replies||0); toneMap[p.tone].count++; }
    setByTone(Object.entries(toneMap).map(([t, d]) => ({ tone: t, avg: d.count ? d.total / d.count : 0, count: d.count })));
    const active = data.activePromptId ? (data.prompts || []).find((p) => p.id === data.activePromptId) : (data.prompts || [])[0];
    setActivePrompt(active || null); setLoading(false);
  }
  if (loading) return React.createElement('div', {className:'loading'}, 'Loading...');
  if (!hasKey) return React.createElement('div', {className:'empty-state'}, React.createElement('h3', null, 'Set Up API Key'), React.createElement('p', null, 'Go to Settings to configure your LLM API key.'));
  const tones = ['viral-model', 'professional', 'casual', 'provocative', 'contrarian'];
  const maxAvg = Math.max(...byTone.map(t => t.avg), 1);
  return React.createElement('div', {className:'dashboard'},
    React.createElement('div', {className:'stat-grid'},
      React.createElement('div', {className:'stat-card'}, React.createElement('div', {className:'stat-value'}, stats.totalPosts), React.createElement('div', {className:'stat-label'}, 'Replies Drafted')),
      React.createElement('div', {className:'stat-card'}, React.createElement('div', {className:'stat-value'}, stats.totalEngagement), React.createElement('div', {className:'stat-label'}, 'Total Engagement'))
    ),
    React.createElement('div', {className:'section'},
      React.createElement('h3', null, 'Active Prompt'),
      activePrompt ? React.createElement('div', {className:'active-prompt-card'}, React.createElement('p', {className:'prompt-preview'}, activePrompt.text?.slice(0,120)+'...')) : React.createElement('p', {className:'muted'}, 'No prompts yet.')
    ),
    React.createElement('div', {className:'section'},
      React.createElement('h3', null, 'Reply Tone'),
      React.createElement('div', {className:'tone-grid'}, tones.map(t => React.createElement('button', {key:t, className: tone===t?'tone-btn active':'tone-btn', onClick: async()=>{setTone(t);await chrome.storage.local.set({defaultTone:t});}}, t)))
    ),
    byTone.length > 0 && React.createElement('div', {className:'section'},
      React.createElement('h3', null, 'Tone Performance'),
      React.createElement('div', {className:'perf-list'}, byTone.map(item => React.createElement('div', {key:item.tone,className:'perf-item'},
        React.createElement('span', {className:'perf-label'}, item.tone),
        React.createElement('div', {className:'perf-bar-wrapper'}, React.createElement('div', {className:'perf-bar', style:{width:(item.avg/maxAvg*100)+'%'}})),
        React.createElement('span', {className:'perf-value'}, item.avg.toFixed(1))
      )))
    )
  );
}
