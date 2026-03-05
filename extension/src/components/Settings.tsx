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
    if(!apiKey){setStatus("Enter API key first");return;}
    setFetchingModels(true);
    setStatus("Fetching models...");
    
    try{
      if(provider==="anthropic"){
        // Anthropic models are static
        const list=["claude-opus-4-6-20250627","claude-opus-4-20250514","claude-sonnet-4-6-20250627","claude-sonnet-4-20250514","claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022"];
        setModels(list);
        await chrome.storage.local.set({availableModels:list});
        setStatus("Found "+list.length+" Anthropic models");
      }
      else if(provider==="custom"){
        if(!baseUrl){setStatus("Enter custom endpoint first");setFetchingModels(false);return;}
        if(!baseUrl.match(/^https?:\/\/.+/i)){setStatus("Invalid URL format (must start with http/https)");setFetchingModels(false);return;}
        const res=await fetch(baseUrl+"/models",{headers:{Authorization:"Bearer "+apiKey}});
        if(!res.ok){if(res.status===401)throw new Error("Unauthorized - check API key");throw new Error("Status "+res.status);}
        const d=await res.json() as any;
        const list=(d.data||[]).map((m:any)=>m.id).sort();
        if(list.length===0)throw new Error("No models returned from endpoint");
        setModels(list);
        await chrome.storage.local.set({availableModels:list});
        setStatus("Found "+list.length+" models");
        if(!list.includes(model))setModel(list[0]);
      }
      else{
        // OpenAI
        const base=baseUrl||"https://api.openai.com/v1";
        try{
          const res=await fetch(base+"/models",{headers:{Authorization:"Bearer "+apiKey}});
          if(!res.ok){if(res.status===401)throw new Error("Unauthorized - check API key");throw new Error("Status "+res.status);}
          const d=await res.json() as any;
          const list=(d.data||[]).map((m:any)=>m.id).filter((id:string)=>id.startsWith("gpt-")||id.startsWith("o")||id.startsWith("chatgpt")).sort();
          if(list.length===0)throw new Error("No chat models found");
          setModels(list);
          await chrome.storage.local.set({availableModels:list});
          setStatus("Found "+list.length+" models");
          if(list.length>0&&!list.includes(model))setModel(list[0]);
        }catch(fetchErr:any){
          // Fallback: static list of common OpenAI models
          const fallback=["gpt-5.4","gpt-4.1","gpt-4.1-mini","gpt-4o","gpt-4o-mini","o3","o4-mini"];
          setModels(fallback);
          await chrome.storage.local.set({availableModels:fallback});
          setStatus("Could not fetch models ("+fetchErr.message+"). Using known models.");
        }
      }
    }catch(err:any){
      console.error("Fetch models error:",err);
      setStatus("Error: "+err.message);
    }
    setFetchingModels(false);
  }
  async function handleSave(){setSaving(true);try{await chrome.storage.local.set({apiKey,apiProvider:provider,apiBaseUrl:baseUrl,selectedModel:model,autoSubmit,backendUrl});const verify:any=await new Promise(r=>chrome.storage.local.get({apiKey:""},r));if(verify.apiKey===apiKey){setStatus("Saved ✓");}else{setStatus("Save may have failed - try again");}}catch(e:any){setStatus("Error: "+e.message);}setSaving(false);setTimeout(()=>setStatus(""),3000);}
  if(loading)return<div className="loading">Loading...</div>;
  return(
    <div className="settings">
      <div className="section"><h3>LLM Provider</h3>
        <select className="input select" value={provider} onChange={(e)=>{const p=e.target.value as any;setProvider(p);setModels([]);if(p==="openai")setModel("gpt-4o-mini");if(p==="anthropic")setModel("claude-sonnet-4-6-20250627");}}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="custom">Custom</option></select>
        {provider==="custom"&&<input className="input" type="url" placeholder="API Base URL" value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)}/>}
      </div>
      <div className="section"><h3>API Key</h3><input className="input" type="password" placeholder={"Enter "+provider+" API key"} value={apiKey} onChange={(e)=>setApiKey(e.target.value)}/></div>
      <div className="section"><h3>Model</h3><div className="model-selector">
        {models.length>0?<select className="input select" value={model} onChange={(e)=>setModel(e.target.value)}>{models.map((m)=><option key={m} value={m}>{m}</option>)}</select>:<input className="input" placeholder="Model name" value={model} onChange={(e)=>setModel(e.target.value)}/>}
        <button className="btn btn-sm" onClick={handleFetchModels} disabled={fetchingModels||!apiKey}>{fetchingModels?"...":"Fetch"}</button>
      </div></div>
      <div className="section"><h3>Auto-Submit</h3><label className="toggle-label"><input type="checkbox" checked={autoSubmit} onChange={(e)=>setAutoSubmit(e.target.checked)}/><span className="toggle-text">Auto-post replies</span></label>{autoSubmit&&<p className="warning-text">Replies posted immediately!</p>}</div>
      <div className="section"><h3>Custom Endpoint (Optional)</h3><input className="input" type="url" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)}/><p className="help-text">For OpenAI-compatible endpoints. Example: https://api.together.ai/v1 or https://your-proxy.vercel.app/v1</p></div>
      <div className="section"><h3>Backend URL (Optional)</h3><input className="input" type="url" placeholder="https://your-backend.vercel.app" value={backendUrl} onChange={(e)=>setBackendUrl(e.target.value)}/><p className="help-text">For future use. Leave empty for direct LLM calls.</p></div>
      <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>{saving?"Saving...":"Save Settings"}</button>
      {status&&<p className="status-text">{status}</p>}
      <div className="section" style={{marginTop:20}}>
        <h3>📊 Engagement Tracking</h3>
        <p className="help-text">Engagement metrics (likes, retweets, replies) are tracked while the extension is active. For best results, keep the extension popup or background page open. Tracking is checked every 30 seconds for visible posts.</p>
      </div>
      <div className="section" style={{marginTop:16}}><p className="help-text">User ID: {userId?.slice(0,8)}...</p><p className="help-text">v2.0.0</p></div>
    </div>
  );
}