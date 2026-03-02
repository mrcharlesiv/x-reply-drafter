import React, { useState, useEffect } from 'react';
import { ApiKeyInput } from '../../components/ApiKeyInput';
import { PromptManager } from '../../components/PromptManager';
import { ToneSelector } from '../../components/ToneSelector';
import { PostLibrary } from '../../components/PostLibrary';
import { EngagementCharts } from '../../components/EngagementCharts';
import { getSettings, saveSettings } from '../../lib/storage';
type Tab = 'prompts'|'library'|'analytics'|'settings';
export function PopupApp() {
  const [tab, setTab] = useState<Tab>('prompts'); const [tone, setTone] = useState('casual'); const [auto, setAuto] = useState(false);
  useEffect(()=>{getSettings().then(s=>{setTone(s.defaultTone);setAuto(s.autoSubmit);});},[]);
  const tabs:{id:Tab;l:string;i:string}[]=[{id:'prompts',l:'Prompts',i:'📝'},{id:'library',l:'Library',i:'📚'},{id:'analytics',l:'Analytics',i:'📊'},{id:'settings',l:'Settings',i:'⚙️'}];
  return (<div className="w-[420px] min-h-[500px] max-h-[600px] overflow-y-auto bg-[#15202b]">
    <div className="sticky top-0 z-10 bg-[#15202b] border-b border-[#2f3336]">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-lg">✍️</span><h1 className="font-bold text-base">X Reply Drafter</h1></div>
        <button onClick={()=>{const n=!auto;setAuto(n);saveSettings({autoSubmit:n});}} className={`text-xs px-2 py-1 rounded ${auto?'bg-orange-500/20 text-orange-400 border border-orange-500/50':'bg-[#0d1117] text-[#71767b] border border-[#2f3336]'}`}>{auto?'⚡ Auto':'✋ Manual'}</button>
      </div>
      <div className="flex px-2">{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className={`flex-1 py-2 text-xs font-medium border-b-2 ${tab===t.id?'border-[#1d9bf0] text-[#1d9bf0]':'border-transparent text-[#71767b] hover:text-white'}`}>{t.i} {t.l}</button>))}</div>
    </div>
    <div className="p-4">
      {tab==='prompts'&&<div className="space-y-4"><div><label className="text-xs text-[#71767b] block mb-2">Default Tone</label><ToneSelector value={tone} onChange={t=>{setTone(t);saveSettings({defaultTone:t});}}/></div><PromptManager/></div>}
      {tab==='library'&&<PostLibrary/>}
      {tab==='analytics'&&<EngagementCharts/>}
      {tab==='settings'&&<div className="space-y-4"><ApiKeyInput/>
        <div className="border-t border-[#2f3336] pt-4"><label className="flex items-center gap-3 cursor-pointer">
          <div onClick={()=>{const n=!auto;setAuto(n);saveSettings({autoSubmit:n});}} className={`w-10 h-5 rounded-full relative cursor-pointer ${auto?'bg-[#1d9bf0]':'bg-[#2f3336]'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 ${auto?'left-5':'left-0.5'}`}/></div>
          <div><span className="text-sm">Auto-submit</span><p className="text-xs text-[#71767b]">Post without clicking submit</p></div></label></div>
        <div className="border-t border-[#2f3336] pt-4 text-xs text-[#71767b]"><p>v1.0.0</p><button onClick={()=>chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')})} className="mt-2 text-[#1d9bf0] hover:underline">Open Dashboard →</button></div></div>}
    </div></div>);
}
