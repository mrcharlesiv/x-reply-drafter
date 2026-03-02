import React, { useEffect, useState } from "react";
export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { load(); }, []);
  async function load() {
    const stored = await chrome.storage.local.get({posts:[],prompts:[]});
    const posts = stored.posts||[];
    const prompts=(stored.prompts||[]).sort((a:any,b:any)=>(b.avgEngagement||0)-(a.avgEngagement||0));
    const byTone:Record<string,{total:number;count:number}>={};
    const byHour:Record<number,{total:number;count:number}>={};
    for(const p of posts){
      const eng=(p.engagement?.likes||0)+(p.engagement?.retweets||0)+(p.engagement?.replies||0);
      if(!byTone[p.tone])byTone[p.tone]={total:0,count:0};
      byTone[p.tone].total+=eng;byTone[p.tone].count++;
      const hour=new Date(p.timestamp).getHours();
      if(!byHour[hour])byHour[hour]={total:0,count:0};
      byHour[hour].total+=eng;byHour[hour].count++;
    }
    setData({
      totalPosts:posts.length,
      totalEngagement:posts.reduce((s:number,p:any)=>s+(p.engagement?.likes||0)+(p.engagement?.retweets||0)+(p.engagement?.replies||0),0),
      byTone:Object.entries(byTone).map(([tone,d])=>({tone,avgEngagement:d.count?d.total/d.count:0,count:d.count})),
      byHour:Object.entries(byHour).map(([hour,d])=>({hour:Number(hour),avgEngagement:d.count?d.total/d.count:0,count:d.count})).sort((a,b)=>a.hour-b.hour),
      topPrompts:prompts.slice(0,10),
    });
    setLoading(false);
  }
  if(loading) return <div className="loading">Loading...</div>;
  if(!data) return <div className="empty-state-small"><p>No data.</p></div>;
  const maxTone=Math.max(...(data.byTone?.map((t:any)=>t.avgEngagement)||[1]),1);
  const maxHour=Math.max(...(data.byHour?.map((h:any)=>h.avgEngagement)||[1]),1);
  return(
    <div className="analytics">
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value">{data.totalPosts}</div><div className="stat-label">Total Replies</div></div>
        <div className="stat-card"><div className="stat-value">{data.totalEngagement}</div><div className="stat-label">Total Engagement</div></div>
        <div className="stat-card"><div className="stat-value">{data.totalPosts>0?(data.totalEngagement/data.totalPosts).toFixed(1):"0"}</div><div className="stat-label">Avg per Reply</div></div>
      </div>
      {data.byTone?.length>0&&<div className="section"><h3>Engagement by Tone</h3><div className="chart bar-chart">{data.byTone.map((item:any)=><div key={item.tone} className="bar-row"><div className="bar-label">{item.tone}</div><div className="bar-track"><div className="bar-fill" style={{width:(item.avgEngagement/maxTone*100)+"%"}}><span className="bar-value">{item.avgEngagement.toFixed(1)}</span></div></div><span className="bar-count">{item.count} posts</span></div>)}</div></div>}
      {data.byHour?.length>0&&<div className="section"><h3>Best Posting Times</h3><div className="chart hour-chart"><div className="hour-grid">{Array.from({length:24},(_,h)=>{const hd=data.byHour.find((d:any)=>d.hour===h);const intensity=hd?hd.avgEngagement/maxHour:0;return <div key={h} className="hour-cell" style={{backgroundColor:intensity>0?"rgba(29,155,240,"+(0.1+intensity*0.8)+")":"var(--bg-secondary)"}} title={h+":00"}><span className="hour-label">{h}</span></div>;})}</div><p className="chart-note">Darker = higher engagement</p></div></div>}
      {data.topPrompts?.length>0&&<div className="section"><h3>Top Prompts</h3><div className="top-prompts">{data.topPrompts.map((p:any,i:number)=><div key={p.id} className="top-prompt-item"><span className="rank">#{i+1}</span><div className="top-prompt-info"><p className="top-prompt-text">{p.text?.slice(0,100)}</p><div className="top-prompt-meta"><span>Avg:{(p.avgEngagement||0).toFixed(1)}</span><span>Used:{p.useCount||0}x</span></div></div></div>)}</div></div>}
      {data.totalPosts===0&&<div className="empty-state-small"><p>Start drafting to see analytics!</p></div>}
    </div>
  );
}