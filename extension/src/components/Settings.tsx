import React, { useEffect, useState } from "react";
export default function Settings() {
  const [loading, setLoading] = useState(true);const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai"|"anthropic"|"custom">("openai");
  const [baseUrl, setBaseUrl] = useState("");const [model, setModel] = useState("gpt-4o-mini");
  const [autoSubmit, setAutoSubmit] = useState(false);const [backendUrl, setBackendUrl] = useState("");
  const [models, setModels] = useState<string[]>([]);
  useEffect(()=>{load();}, []);
  async function load() {
    const data:any = await new Promise((resolve)=>{chrome.storage.local.get({userId:"",apiKey:"",apiProvider:"openai",apiBaseUrl:"",selectedModel:"gpt-4o-mini",autoSubmit:false,backendUrl:"",availableModels:[]},resolve);});
    if(!data.userId){data.userId=crypto.randomUUID();await chrome.storage.local.set({userId:data.userId});}
    setUserId(data.userId);setApiKey(data.apiKey);setProvider(data.apiProvider);setBaseUrl(data.apiBaseUrl);setModel(data.selectedModel);setAutoSubmit(data.autoSubmit);setBackendUrl(data.backendUrl);setModels(data.availableModels);setLoading(false);
  }
  async function handleFetchModels() {
    if(!apiKey){setStatus("Enter API key first");return;}setFetchingModels(true);setStatus("Fetching...");
    try{
      if(provider==="anthropic"){const list=["claude-sonnet-4-20250514","claude-3-5-haiku-20241022","claude-3-5-sonnet-20241022"];setModels(list);await chrome.storage.local.set({availableModels:list});setStatus("Found "+list.length);}
      else{const base=baseUrl||"https://api.openai.com/v1";const res=await fetch(base+"/models",{headers:{Authorization:"Bearer "+apiKey}});if(!res.ok)throw new Error(""+res.status);const d=await res.json() as any;const list=(d.data||[]).map((m:any)=>m.id).sort();setModels(list);await chrome.storage.local.set({availableModels:list});setStatus("Found "+list.length);if(list.length>0&&!list.includes(model))setModel(list[0]);}
    }catch(err:any){setStatus("Error: "+err.message);}setFetchingModels(false);
  }
  async function handleSave(){setSaving(true);await chrome.storage.local.set({apiKey,apiProvider:provider,apiBaseUrl:baseUrl,selectedModel:model,autoSubmit,backendUrl});setStatus("Saved");setSaving(false);setTimeout(()=>setStatus(""),2000);}
  if(loading)return<div className="loading">Loading...</div>;
  return(
    <div className="settings">
      <div className="section"><h3>LLM Provider</h3>
        <select className="input select" value={provider} onChange={(e)=>{const p=e.target.value as any;setProvider(p);setModels([]);if(p==="openai")setModel("gpt-4o-mini");if(p==="anthropic")setModel("claude-sonnet-4-20250514");}}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="custom">Custom</option></select>
        {provider==="custom"&&<input className="input" type="url" placeholder="API Base URL" value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)}/>}
      </div>
      <div className="section"><h3>API Key</h3><input className="input" type="password" placeholder={"Enter "+provider+" API key"} value={apiKey} onChange={(e)=>setApiKey(e.target.value)}/></div>
      <div className="section"><h3>Model</h3><div className="model-selector">
        {models.length>0?<select className="input select" value={model} onChange={(e)=>setModel(e.target.value)}>{models.map((m)=><option key={m} value={m}>{m}</option>)}</select>:<input className="input" placeholder="Model name" value={model} onChange={(e)=>setModel(e.target.value)}/>}
        <button className="btn btn-sm" onClick={handleFetchModels} disabled={fetchingModels||!apiKey}>{fetchingModels?"...":"Fetch"}</button>
      </div></div>
      <div className="section"><h3>Auto-Submit</h3><label className="toggle-label"><input type="checkbox" checked={autoSubmit} onChange={(e)=>setAutoSubmit(e.target.checked)}/><span className="toggle-text">Auto-post replies</span></label>{autoSubmit&&<p className="warning-text">Replies posted immediately!</p>}</div>
      <div className="section"><h3>Backend URL (Optional)</h3><input className="input" type="url" placeholder="https://your-backend.vercel.app" value={backendUrl} onChange={(e)=>setBackendUrl(e.target.value)}/><p className="help-text">Leave empty for direct LLM calls.</p></div>
      <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>{saving?"Saving...":"Save Settings"}</button>
      {status&&<p className="status-text">{status}</p>}
      <div className="section" style={{marginTop:16}}><p className="help-text">User ID: {userId?.slice(0,8)}...</p><p className="help-text">v2.0.0</p></div>
    </div>
  );
}