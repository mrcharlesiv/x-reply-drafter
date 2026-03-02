import React, { useState, useEffect } from 'react';
import { getLocalPosts, type LocalPost } from '../lib/storage';
export function PostLibrary() {
  const [posts, setPosts] = useState<LocalPost[]>([]); const [search, setSearch] = useState(''); const [sortBy, setSortBy] = useState<'date'|'engagement'>('date');
  useEffect(()=>{getLocalPosts().then(setPosts);},[]);
  const filtered = posts.filter(p=>!search||[p.originalContent,p.replyContent,p.originalAuthor].some(s=>s.toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>sortBy==='engagement'?(b.likes+b.retweets*2+b.replies*3)-(a.likes+a.retweets*2+a.replies*3):new Date(b.postedAt).getTime()-new Date(a.postedAt).getTime());
  return (<div className="space-y-3">
    <div className="flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-[#0d1117] rounded p-2 text-sm border border-[#2f3336] outline-none"/>
    <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="bg-[#0d1117] rounded p-2 text-sm border border-[#2f3336]"><option value="date">Latest</option><option value="engagement">Top</option></select></div>
    {filtered.length===0?<p className="text-[#71767b] text-sm text-center py-8">{posts.length===0?'No posts yet.':'No matches.'}</p>
    :filtered.map(p=>(<div key={p.id} className="bg-[#0d1117] rounded-lg p-3 border border-[#2f3336]">
      <div className="flex gap-2 mb-2"><span className="text-[#1d9bf0] text-xs font-medium">@{p.originalAuthor}</span><span className="text-[#71767b] text-xs">{new Date(p.postedAt).toLocaleDateString()}</span></div>
      <p className="text-xs text-[#71767b] mb-2">{p.originalContent.slice(0,120)}</p><p className="text-sm mb-2">↳ {p.replyContent}</p>
      <div className="flex gap-4 text-xs text-[#71767b]"><span>❤️ {p.likes}</span><span>🔄 {p.retweets}</span><span>💬 {p.replies}</span></div></div>))}</div>);
}
