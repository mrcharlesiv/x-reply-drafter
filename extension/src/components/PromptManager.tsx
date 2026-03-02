import React, { useEffect, useState } from "react";
interface Prompt { id: string; text: string; tags: string[]; tone: string; avgEngagement: number; useCount: number; createdAt: number; }
export default function PromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<Prompt|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [tone, setTone] = useState("casual");
  const [activeId, setActiveId] = useState("");
  useEffect(() => { load(); }, []);
  async function load() {
    const data = await chrome.storage.local.get({ prompts: [], activePromptId: "" });
    const sorted = (data.prompts||[]).sort((a:any,b:any)=>(b.avgEngagement||0)-(a.avgEngagement||0));
    setPrompts(sorted); setActiveId(data.activePromptId || sorted[0]?.id || "");
  }
  async function handleSave() {
    if (!text.trim()) return;
    const data = await chrome.storage.local.get({ prompts: [] }); const list = data.prompts || [];
    if (editing) { const idx = list.findIndex((p:any)=>p.id===editing.id); if (idx>=0) list[idx]={...list[idx],text:text.trim(),tags:tags.split(",").map((t:string)=>t.trim()).filter(Boolean),tone}; }
    else { list.push({id:crypto.randomUUID(),text:text.trim(),tags:tags.split(",").map((t:string)=>t.trim()).filter(Boolean),tone,createdAt:Date.now(),totalEngagement:0,useCount:0,avgEngagement:0}); }
    await chrome.storage.local.set({prompts:list}); setText("");setTags("");setTone("casual");setEditing(null);setShowForm(false); await load();
  }
  async function handleDelete(id:string) { if(!confirm("Delete?"))return; const data=await chrome.storage.local.get({prompts:[]}); await chrome.storage.local.set({prompts:data.prompts.filter((p:any)=>p.id!==id)}); await load(); }
  async function handleSetActive(id:string) { setActiveId(id); await chrome.storage.local.set({activePromptId:id}); }
  return (
    <div className="prompt-manager">
      <div className="section-header"><h3>Prompts</h3><button className="btn btn-primary btn-sm" onClick={()=>{setEditing(null);setText("");setTags("");setTone("casual");setShowForm(!showForm);}}>{showForm?"Cancel":"+ New"}</button></div>
      {showForm && <div className="prompt-form">
        <textarea className="input textarea" placeholder="Write prompt instructions..." value={text} onChange={(e)=>setText(e.target.value)} rows={4}/>
        <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={(e)=>setTags(e.target.value)}/>
        <select className="input select" value={tone} onChange={(e)=>setTone(e.target.value)}><option value="casual">Casual</option><option value="professional">Professional</option><option value="provocative">Provocative</option><option value="contrarian">Contrarian</option></select>
        <button className="btn btn-primary" onClick={handleSave}>{editing?"Update":"Save"} Prompt</button>
      </div>}
      {prompts.length===0&&!showForm&&<div className="empty-state-small"><p>No prompts yet.</p></div>}
      <div className="prompt-list">{prompts.map((p)=>(
        <div key={p.id} className={"prompt-card "+(activeId===p.id?"active":"")}>
          <div className="prompt-card-header">
            <div className="prompt-rank">{activeId===p.id&&<span className="active-badge">Active</span>}<span className="prompt-tone-badge">{p.tone}</span></div>
            <div className="prompt-actions">
              <button className="btn-icon" onClick={()=>handleSetActive(p.id)}>{activeId===p.id?"[x]":"[ ]"}</button>
              <button className="btn-icon" onClick={()=>{setEditing(p);setText(p.text);setTags(p.tags.join(", "));setTone(p.tone);setShowForm(true);}}>Edit</button>
              <button className="btn-icon" onClick={()=>handleDelete(p.id)}>Del</button>
            </div>
          </div>
          <p className="prompt-text">{p.text}</p>
          <div className="prompt-meta">{p.tags.map((t)=><span key={t} className="tag">{t}</span>)}<span className="stat-small">Used {p.useCount||0}x</span><span className="stat-small">Avg: {(p.avgEngagement||0).toFixed(1)}</span></div>
        </div>
      ))}</div>
    </div>
  );
}