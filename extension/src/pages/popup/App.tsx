import React, { useState } from "react";
import Dashboard from "../../components/Dashboard";
import PromptManager from "../../components/PromptManager";
import PostLibrary from "../../components/PostLibrary";
import Settings from "../../components/Settings";
import Analytics from "../../components/Analytics";
type Tab = "dashboard"|"prompts"|"posts"|"analytics"|"settings";
const TABS:{id:Tab;label:string}[] = [{id:"dashboard",label:"Home"},{id:"prompts",label:"Prompts"},{id:"posts",label:"Library"},{id:"analytics",label:"Analytics"},{id:"settings",label:"Settings"}];
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  return (
    <div className="app">
      <header className="app-header"><h1>X Reply Drafter</h1><span className="version">v2.0</span></header>
      <nav className="tab-nav">{TABS.map((tab)=>(<button key={tab.id} className={"tab-btn "+(activeTab===tab.id?"active":"")} onClick={()=>setActiveTab(tab.id)}><span className="tab-label">{tab.label}</span></button>))}</nav>
      <main className="app-content">
        {activeTab==="dashboard"&&<Dashboard/>}
        {activeTab==="prompts"&&<PromptManager/>}
        {activeTab==="posts"&&<PostLibrary/>}
        {activeTab==="analytics"&&<Analytics/>}
        {activeTab==="settings"&&<Settings/>}
      </main>
    </div>
  );
}