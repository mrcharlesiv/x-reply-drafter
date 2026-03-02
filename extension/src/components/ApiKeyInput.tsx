import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../lib/storage';
import { fetchModelsDirect } from '../lib/api';
export function ApiKeyInput() {
  const [provider, setProvider] = useState<'openai'|'anthropic'|'openai-compatible'>('openai');
  const [apiKey, setApiKey] = useState(''); const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o'); const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); const [saved, setSaved] = useState(false); const [hasKey, setHasKey] = useState(false);
  useEffect(() => { getSettings().then(s => { setProvider(s.llmProvider); setBaseUrl(s.llmBaseUrl); setModel(s.llmModel); setHasKey(!!s.llmApiKey); if(s.llmApiKey) setApiKey(s.llmApiKey); }); }, []);
  useEffect(() => { if(provider==='openai') setBaseUrl('https://api.openai.com/v1'); else if(provider==='anthropic') setBaseUrl('https://api.anthropic.com'); }, [provider]);
  async function doFetch() { if(!apiKey) return; setLoading(true); setModels(await fetchModelsDirect(apiKey,baseUrl,provider)); setLoading(false); }
  async function doSave() { await saveSettings({llmApiKey:apiKey,llmBaseUrl:baseUrl,llmModel:model,llmProvider:provider}); setHasKey(true); setSaved(true); setTimeout(()=>setSaved(false),2000); }
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">LLM Configuration</h3>
      <div><label className="text-xs text-[#71767b] block mb-1">Provider</label>
        <div className="flex gap-1">{(['openai','anthropic','openai-compatible'] as const).map(p=>(<button key={p} onClick={()=>setProvider(p)} className={`px-3 py-1.5 rounded text-xs ${provider===p?'bg-[#1d9bf0] text-white':'bg-[#0d1117] text-[#71767b] border border-[#2f3336]'}`}>{p==='openai'?'OpenAI':p==='anthropic'?'Anthropic':'Compatible'}</button>))}</div></div>
      <div><label className="text-xs text-[#71767b] block mb-1">API Key {hasKey&&<span className="text-green-400">✓</span>}</label>
        <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={`${provider} key...`} className="w-full bg-[#0d1117] rounded p-2 text-sm border border-[#2f3336] focus:border-[#1d9bf0] outline-none"/></div>
      {provider==='openai-compatible'&&<div><label className="text-xs text-[#71767b] block mb-1">Base URL</label><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} className="w-full bg-[#0d1117] rounded p-2 text-sm border border-[#2f3336] outline-none"/></div>}
      <div><label className="text-xs text-[#71767b] block mb-1">Model</label>
        <div className="flex gap-2"><input value={model} onChange={e=>setModel(e.target.value)} list="ml" className="flex-1 bg-[#0d1117] rounded p-2 text-sm border border-[#2f3336] outline-none"/>
        <button onClick={doFetch} disabled={loading||!apiKey} className="px-3 py-2 bg-[#0d1117] border border-[#2f3336] rounded text-xs disabled:opacity-50">{loading?'...':'🔄'}</button></div>
        <datalist id="ml">{models.map(m=><option key={m} value={m}/>)}</datalist>
        {models.length>0&&<div className="mt-1 max-h-32 overflow-y-auto">{models.slice(0,20).map(m=>(<button key={m} onClick={()=>setModel(m)} className={`block w-full text-left text-xs px-2 py-1 hover:bg-[#1e2732] rounded ${model===m?'text-[#1d9bf0]':'text-[#71767b]'}`}>{m}</button>))}</div>}</div>
      <button onClick={doSave} className={`w-full py-2 rounded font-medium text-sm ${saved?'bg-green-600 text-white':'bg-[#1d9bf0] text-white hover:opacity-80'}`}>{saved?'✓ Saved!':'Save'}</button>
    </div>);
}
