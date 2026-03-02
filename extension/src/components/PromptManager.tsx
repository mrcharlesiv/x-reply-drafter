import React, { useState, useEffect } from 'react';
import { getLocalPrompts, addLocalPrompt, deleteLocalPrompt, type LocalPrompt } from '../lib/storage';
export function PromptManager({onSelect,selectedId}:{onSelect?:(p:LocalPrompt)=>void;selectedId?:string|null}) {
  const [prompts, setPrompts] = useState<LocalPrompt[]>([]); const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState(''); const [newTags, setNewTags] = useState(''); const [newTone, setNewTone] = useState('casual');
  useEffect(()=>{load();},[]);
  async function load() { const p = await getLocalPrompts(); p.sort((a,b)=>b.avgEngagement-a.avgEngagement); setPrompts(p); }
  async function add() { if(!newText.trim()) return; await addLocalPrompt(newText.trim(),newTags.split(',').map(t=>t.trim()).filter(Boolean),newTone); setNewText(''); setNewTags(''); setShowAdd(false); await load(); }
  async function del(id:string) { await deleteLocalPrompt(id); await load(); }
  return (<div className="space-y-3">
    <div className="flex justify-between items-center"><h3 className="font-semibold">Prompts</h3><button onClick={()=>setShowAdd(!showAdd)} className="text-[#1d9bf0] text-sm hover:underline">{showAdd?'Cancel':'+ Add'}</button></div>
    {showAdd&&<div className="bg-[#0d1117] rounded-lg p-3 space-y-2 border border-[#2f3336]">
      <textarea value={newText} onChange={e=>setNewText(e.target.value)} placeholder="Prompt..." className="w-full bg-[#15202b] rounded p-2 text-sm resize-none h-20 border border-[#2f3336] outline-none"/>
      <input value={newTags} onChange={e=>setNewTags(e.target.value)} placeholder="Tags (comma sep)" className="w-full bg-[#15202b] rounded p-2 text-sm border border-[#2f3336] outline-none"/>
      <div className="flex gap-2"><select value={newTone} onChange={e=>setNewTone(e.target.value)} className="bg-[#15202b] rounded p-2 text-sm border border-[#2f3336] flex-1"><option value="casual">Casual</option><option value="professional">Professional</option><option value="provocative">Provocative</option><option value="contrarian">Contrarian</option></select>
      <button onClick={add} className="bg-[#1d9bf0] text-white px-4 py-2 rounded text-sm font-medium">Save</button></div></div>}
    <div className="space-y-2">
      {prompts.length===0&&<p className="text-[#71767b] text-sm text-center py-4">No prompts yet.</p>}
      {prompts.map(p=>(<div key={p.id} onClick={()=>onSelect?.(p)} className={`rounded-lg p-3 border cursor-pointer ${selectedId===p.id?'border-[#1d9bf0] bg-[#1d9bf0]/10':'border-[#2f3336] bg-[#0d1117] hover:border-[#71767b]'}`}>
        <div className="flex justify-between items-start"><p className="text-sm flex-1">{p.text}</p><button onClick={e=>{e.stopPropagation();del(p.id);}} className="text-[#71767b] hover:text-red-400 ml-2 text-xs">✕</button></div>
        <div className="flex gap-2 mt-2 flex-wrap">{p.tags.map(t=><span key={t} className="bg-[#2f3336] text-xs px-2 py-0.5 rounded">{t}</span>)}<span className="text-xs text-[#71767b] ml-auto">{p.useCount>0?`📊 ${p.avgEngagement.toFixed(1)} (${p.useCount})`:'No data'}</span></div>
      </div>))}
    </div></div>);
}
