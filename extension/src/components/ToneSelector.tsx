import React from 'react';
const TONES = [{id:'professional',label:'Professional',icon:'👔'},{id:'casual',label:'Casual',icon:'😎'},{id:'provocative',label:'Provocative',icon:'🔥'},{id:'contrarian',label:'Contrarian',icon:'🤔'}];
export function ToneSelector({value,onChange}:{value:string;onChange:(t:string)=>void}) {
  return (<div className="grid grid-cols-2 gap-2">{TONES.map(t=>(<button key={t.id} onClick={()=>onChange(t.id)} className={`p-3 rounded-lg text-left border ${value===t.id?'border-[#1d9bf0] bg-[#1d9bf0]/10':'border-[#2f3336] bg-[#0d1117] hover:border-[#71767b]'}`}><div className="text-lg mb-1">{t.icon}</div><div className="font-medium text-sm">{t.label}</div></button>))}</div>);
}
