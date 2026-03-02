import React, { useState } from 'react';
import { ApiKeyInput } from '../../components/ApiKeyInput';
import { PromptManager } from '../../components/PromptManager';
import { PostLibrary } from '../../components/PostLibrary';
import { EngagementCharts } from '../../components/EngagementCharts';
type S = 'overview'|'prompts'|'library'|'settings';
export function DashboardApp() {
  const [s, setS] = useState<S>('overview');
  const nav:{id:S;l:string;i:string}[]=[{id:'overview',l:'Overview',i:'📊'},{id:'prompts',l:'Prompts',i:'📝'},{id:'library',l:'Library',i:'📚'},{id:'settings',l:'Settings',i:'⚙️'}];
  return (<div className="min-h-screen bg-[#15202b] flex">
    <aside className="w-56 bg-[#0d1117] border-r border-[#2f3336] p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-8"><span className="text-2xl">✍️</span><div><h1 className="font-bold">X Reply Drafter</h1><p className="text-xs text-[#71767b]">Dashboard</p></div></div>
      <nav className="space-y-1 flex-1">{nav.map(n=>(<button key={n.id} onClick={()=>setS(n.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${s===n.id?'bg-[#1d9bf0]/10 text-[#1d9bf0]':'text-[#71767b] hover:text-white hover:bg-[#1e2732]'}`}><span>{n.i}</span>{n.l}</button>))}</nav>
      <p className="text-xs text-[#71767b] mt-auto">v1.0.0</p></aside>
    <main className="flex-1 p-8 max-w-4xl">
      {s==='overview'&&<><h2 className="text-xl font-bold mb-6">Analytics</h2><EngagementCharts/></>}
      {s==='prompts'&&<><h2 className="text-xl font-bold mb-6">Prompts</h2><PromptManager/></>}
      {s==='library'&&<><h2 className="text-xl font-bold mb-6">Post Library</h2><PostLibrary/></>}
      {s==='settings'&&<div className="max-w-lg"><h2 className="text-xl font-bold mb-6">Settings</h2><ApiKeyInput/></div>}
    </main></div>);
}
