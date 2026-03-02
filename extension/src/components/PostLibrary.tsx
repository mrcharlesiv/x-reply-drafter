import React, { useEffect, useState } from "react";
interface Post { postId:string; postAuthor:string; postText:string; replyText:string; tone:string; timestamp:number; engagement:{likes:number;retweets:number;replies:number;impressions:number}; notes:string; notesUpdatedAt?:number; }
export default function PostLibrary() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [editingNotes, setEditingNotes] = useState<string|null>(null);
  const [notesText, setNotesText] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { load(); }, []);
  async function load(q?:string) { setLoading(true);
    const data = await chrome.storage.local.get({posts:[]});
    let list = (data.posts||[]).sort((a:any,b:any)=>b.timestamp-a.timestamp);
    if (q) { const ql=q.toLowerCase(); list=list.filter((p:any)=>p.notes?.toLowerCase().includes(ql)||p.replyText?.toLowerCase().includes(ql)||p.postText?.toLowerCase().includes(ql)||p.postAuthor?.toLowerCase().includes(ql)); }
    setPosts(list); setLoading(false);
  }
  async function handleSaveNotes(postId:string) {
    const data = await chrome.storage.local.get({posts:[]}); const idx=data.posts.findIndex((p:any)=>p.postId===postId);
    if(idx>=0){data.posts[idx].notes=notesText;data.posts[idx].notesUpdatedAt=Date.now();await chrome.storage.local.set({posts:data.posts});}
    setEditingNotes(null); await load(search||undefined);
  }
  function fmt(ts:number){const d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});}
  function totalEng(p:Post){return(p.engagement?.likes||0)+(p.engagement?.retweets||0)+(p.engagement?.replies||0);}
  return (
    <div className="post-library">
      <div className="search-bar"><input className="input search-input" placeholder="Search posts, replies, notes..." value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&load(search||undefined)}/><button className="btn btn-sm" onClick={()=>load(search||undefined)}>Search</button></div>
      {loading&&<div className="loading">Loading...</div>}
      {!loading&&posts.length===0&&<div className="empty-state-small"><p>{search?"No matches.":"No posts yet."}</p></div>}
      <div className="post-list">{posts.map((post)=>(
        <div key={post.postId} className={"post-card "+(expandedId===post.postId?"expanded":"")}>
          <div className="post-card-header" onClick={()=>setExpandedId(expandedId===post.postId?null:post.postId)}>
            <div className="post-info"><span className="post-author">@{post.postAuthor}</span><span className="post-time">{fmt(post.timestamp)}</span></div>
            <div className="post-engagement-mini"><span>L:{post.engagement?.likes||0}</span><span>RT:{post.engagement?.retweets||0}</span><span>R:{post.engagement?.replies||0}</span></div>
          </div>
          <p className="post-original-text">{post.postText?.slice(0,120)}...</p>
          {expandedId===post.postId&&(
            <div className="post-detail">
              <div className="detail-section"><h4>Original Post</h4><p className="detail-text">{post.postText}</p></div>
              <div className="detail-section"><h4>Your Reply</h4><p className="detail-text reply-text">{post.replyText}</p><span className="tag">{post.tone}</span></div>
              <div className="detail-section"><h4>Engagement</h4>
                <div className="engagement-grid"><div className="eng-item"><span className="eng-value">{post.engagement?.likes||0}</span><span className="eng-label">Likes</span></div><div className="eng-item"><span className="eng-value">{post.engagement?.retweets||0}</span><span className="eng-label">Retweets</span></div><div className="eng-item"><span className="eng-value">{post.engagement?.replies||0}</span><span className="eng-label">Replies</span></div><div className="eng-item"><span className="eng-value">{totalEng(post)}</span><span className="eng-label">Total</span></div></div>
              </div>
              <div className="detail-section notes-section">
                <div className="section-header"><h4>Notes</h4>{editingNotes!==post.postId&&<button className="btn btn-sm" onClick={()=>{setEditingNotes(post.postId);setNotesText(post.notes||"");}}>{post.notes?"Edit":"Add Notes"}</button>}</div>
                {editingNotes===post.postId?<div className="notes-editor"><textarea className="input textarea" placeholder="What worked? What didn't?" value={notesText} onChange={(e)=>setNotesText(e.target.value)} rows={3}/><div className="notes-actions"><button className="btn btn-primary btn-sm" onClick={()=>handleSaveNotes(post.postId)}>Save</button><button className="btn btn-sm" onClick={()=>setEditingNotes(null)}>Cancel</button></div></div>:post.notes?<p className="notes-text">{post.notes}</p>:<p className="muted">No notes yet.</p>}
              </div>
              <a className="btn btn-sm post-link" href={"https://x.com/"+post.postAuthor+"/status/"+post.postId} target="_blank" rel="noopener">View on X</a>
            </div>
          )}
        </div>
      ))}</div>
    </div>
  );
}