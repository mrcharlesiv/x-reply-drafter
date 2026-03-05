import React, { useEffect, useState } from "react";

interface ApiProfile {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "custom";
  apiKey: string;
  model: string;
  baseUrl: string;
}

const ANTHROPIC_MODELS = [
  "claude-opus-4-6","claude-opus-4-20250514",
  "claude-sonnet-4-6","claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022","claude-3-5-haiku-20241022",
];
const OPENAI_FALLBACK = ["gpt-5.4","gpt-4.1","gpt-4.1-mini","gpt-4o","gpt-4o-mini","o3","o4-mini"];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");

  // Profiles
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<ApiProfile | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editProvider, setEditProvider] = useState<"openai"|"anthropic"|"custom">("openai");
  const [editKey, setEditKey] = useState("");
  const [editModel, setEditModel] = useState("gpt-4o-mini");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editModels, setEditModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // Other settings
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const data: any = await new Promise((r) => {
      chrome.storage.local.get({
        userId: "", apiProfiles: [], activeProfileId: "",
        // Legacy fields for migration
        apiKey: "", apiProvider: "openai", apiBaseUrl: "", selectedModel: "gpt-4o-mini",
        autoSubmit: false, backendUrl: "",
      }, r);
    });

    if (!data.userId) { data.userId = crypto.randomUUID(); await chrome.storage.local.set({ userId: data.userId }); }
    setUserId(data.userId);
    setAutoSubmit(data.autoSubmit);
    setBackendUrl(data.backendUrl);

    let profs: ApiProfile[] = data.apiProfiles || [];

    // Migrate legacy single-key config
    if (profs.length === 0 && data.apiKey) {
      const migrated: ApiProfile = {
        id: crypto.randomUUID(),
        label: data.apiProvider === "anthropic" ? "Anthropic" : data.apiProvider === "custom" ? "Custom" : "OpenAI",
        provider: data.apiProvider,
        apiKey: data.apiKey,
        model: data.selectedModel,
        baseUrl: data.apiBaseUrl || "",
      };
      profs = [migrated];
      await chrome.storage.local.set({ apiProfiles: profs, activeProfileId: migrated.id });
      data.activeProfileId = migrated.id;
    }

    setProfiles(profs);
    setActiveProfileId(data.activeProfileId || (profs[0]?.id || ""));
    setLoading(false);
  }

  function activeProfile() { return profiles.find(p => p.id === activeProfileId) || null; }

  async function switchProfile(id: string) {
    setActiveProfileId(id);
    const prof = profiles.find(p => p.id === id);
    if (prof) {
      // Sync active profile to legacy fields so background script can read them
      await chrome.storage.local.set({
        activeProfileId: id,
        apiKey: prof.apiKey,
        apiProvider: prof.provider,
        apiBaseUrl: prof.baseUrl,
        selectedModel: prof.model,
      });
      setStatus("Switched to " + prof.label);
      setTimeout(() => setStatus(""), 2000);
    }
  }

  function startNew() {
    setEditProfile(null);
    setEditLabel("");
    setEditProvider("openai");
    setEditKey("");
    setEditModel("gpt-4o-mini");
    setEditBaseUrl("");
    setEditModels([]);
    setEditing(true);
  }

  function startEdit(prof: ApiProfile) {
    setEditProfile(prof);
    setEditLabel(prof.label);
    setEditProvider(prof.provider);
    setEditKey(prof.apiKey);
    setEditModel(prof.model);
    setEditBaseUrl(prof.baseUrl);
    setEditModels(prof.provider === "anthropic" ? ANTHROPIC_MODELS : prof.provider === "openai" ? OPENAI_FALLBACK : []);
    setEditing(true);
  }

  async function saveProfile() {
    if (!editKey.trim()) { setStatus("API key required"); return; }
    const label = editLabel.trim() || (editProvider === "anthropic" ? "Anthropic" : editProvider === "custom" ? "Custom" : "OpenAI");

    let updated: ApiProfile[];
    let id: string;

    if (editProfile) {
      // Update existing
      id = editProfile.id;
      updated = profiles.map(p => p.id === id ? { ...p, label, provider: editProvider, apiKey: editKey, model: editModel, baseUrl: editBaseUrl } : p);
    } else {
      // New
      id = crypto.randomUUID();
      const newProf: ApiProfile = { id, label, provider: editProvider, apiKey: editKey, model: editModel, baseUrl: editBaseUrl };
      updated = [...profiles, newProf];
    }

    setProfiles(updated);
    await chrome.storage.local.set({ apiProfiles: updated });

    // Always sync legacy fields for the active/only profile
    if (updated.length === 1 || activeProfileId === id || !activeProfileId) {
      setActiveProfileId(id);
      await chrome.storage.local.set({
        activeProfileId: id,
        apiKey: editKey,
        apiProvider: editProvider,
        apiBaseUrl: editBaseUrl,
        selectedModel: editModel,
      });
    }

    setEditing(false);
    setStatus("Profile saved ✓");
    setTimeout(() => setStatus(""), 2000);
  }

  async function deleteProfile(id: string) {
    if (!confirm("Delete this API profile?")) return;
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    await chrome.storage.local.set({ apiProfiles: updated });
    if (activeProfileId === id && updated.length > 0) {
      await switchProfile(updated[0].id);
    } else if (updated.length === 0) {
      setActiveProfileId("");
      await chrome.storage.local.set({ activeProfileId: "", apiKey: "", apiProvider: "openai", selectedModel: "gpt-4o-mini" });
    }
    setStatus("Deleted");
    setTimeout(() => setStatus(""), 2000);
  }

  async function handleFetchModels() {
    if (!editKey) { setStatus("Enter API key first"); return; }
    setFetchingModels(true);
    setStatus("Fetching models...");

    try {
      if (editProvider === "anthropic") {
        setEditModels(ANTHROPIC_MODELS);
        setStatus("Found " + ANTHROPIC_MODELS.length + " Anthropic models");
      } else if (editProvider === "custom") {
        if (!editBaseUrl) { setStatus("Enter endpoint first"); setFetchingModels(false); return; }
        const res = await fetch(editBaseUrl + "/models", { headers: { Authorization: "Bearer " + editKey } });
        if (!res.ok) throw new Error("Status " + res.status);
        const d = await res.json() as any;
        const list = (d.data || []).map((m: any) => m.id).sort();
        setEditModels(list);
        setStatus("Found " + list.length + " models");
      } else {
        // OpenAI
        const base = editBaseUrl || "https://api.openai.com/v1";
        try {
          const res = await fetch(base + "/models", { headers: { Authorization: "Bearer " + editKey } });
          if (!res.ok) throw new Error("Status " + res.status);
          const d = await res.json() as any;
          const list = (d.data || []).map((m: any) => m.id).filter((id: string) => id.startsWith("gpt-") || id.startsWith("o") || id.startsWith("chatgpt")).sort();
          if (list.length > 0) { setEditModels(list); setStatus("Found " + list.length + " models"); }
          else throw new Error("No chat models");
        } catch {
          setEditModels(OPENAI_FALLBACK);
          setStatus("Using known OpenAI models");
        }
      }
    } catch (err: any) {
      setStatus("Error: " + err.message);
    }
    setFetchingModels(false);
  }

  async function handleSaveOther() {
    await chrome.storage.local.set({ autoSubmit, backendUrl });
    setStatus("Settings saved ✓");
    setTimeout(() => setStatus(""), 2000);
  }

  if (loading) return <div className="loading">Loading...</div>;

  const ap = activeProfile();

  return (
    <div className="settings">
      {/* API Profiles */}
      <div className="section">
        <div className="section-header">
          <h3>API Keys</h3>
          <button className="btn btn-primary btn-sm" onClick={startNew}>+ Add</button>
        </div>

        {profiles.length === 0 && !editing && (
          <div className="empty-state-small"><p>No API keys configured.</p></div>
        )}

        <div className="profile-list">
          {profiles.map(p => (
            <div key={p.id} className={"profile-card " + (activeProfileId === p.id ? "active" : "")} onClick={() => switchProfile(p.id)}>
              <div className="profile-card-main">
                <div className="profile-info">
                  <span className="profile-label">{p.label}</span>
                  <span className="profile-meta">{p.provider} · {p.model}</span>
                  <span className="profile-key">...{p.apiKey.slice(-6)}</span>
                </div>
                <div className="profile-actions" onClick={e => e.stopPropagation()}>
                  {activeProfileId === p.id && <span className="active-badge">Active</span>}
                  <button className="btn-icon" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn-icon" onClick={() => deleteProfile(p.id)}>Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit / New Profile Form */}
      {editing && (
        <div className="section profile-form">
          <h3>{editProfile ? "Edit Profile" : "New API Key"}</h3>

          <input className="input" placeholder="Label (e.g. OpenAI Main, Anthropic)" value={editLabel} onChange={e => setEditLabel(e.target.value)} />

          <select className="input select" value={editProvider} onChange={e => {
            const p = e.target.value as any;
            setEditProvider(p);
            setEditModels([]);
            if (p === "openai") setEditModel("gpt-4o-mini");
            if (p === "anthropic") { setEditModel("claude-sonnet-4-6"); setEditModels(ANTHROPIC_MODELS); }
          }}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom</option>
          </select>

          <input className="input" type="password" placeholder={"Enter " + editProvider + " API key"} value={editKey} onChange={e => setEditKey(e.target.value)} />

          {editProvider === "custom" && (
            <input className="input" type="url" placeholder="API Base URL" value={editBaseUrl} onChange={e => setEditBaseUrl(e.target.value)} />
          )}

          <div className="model-selector">
            {editModels.length > 0
              ? <select className="input select" value={editModel} onChange={e => setEditModel(e.target.value)}>
                  {editModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              : <input className="input" placeholder="Model name" value={editModel} onChange={e => setEditModel(e.target.value)} />
            }
            <button className="btn btn-sm" onClick={handleFetchModels} disabled={fetchingModels || !editKey}>
              {fetchingModels ? "..." : "Fetch"}
            </button>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={saveProfile}>Save Profile</button>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Active profile indicator */}
      {ap && !editing && (
        <div className="section">
          <p className="help-text">Active: <strong>{ap.label}</strong> ({ap.provider} · {ap.model})</p>
        </div>
      )}

      {/* Other Settings */}
      <div className="section">
        <h3>Auto-Submit</h3>
        <label className="toggle-label">
          <input type="checkbox" checked={autoSubmit} onChange={e => setAutoSubmit(e.target.checked)} />
          <span className="toggle-text">Auto-post replies</span>
        </label>
        {autoSubmit && <p className="warning-text">Replies posted immediately!</p>}
      </div>

      <div className="section">
        <h3>Backend URL (Optional)</h3>
        <input className="input" type="url" placeholder="https://your-backend.vercel.app" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} />
        <p className="help-text">For syncing drafts + engagement data.</p>
      </div>

      <button className="btn btn-primary btn-full" onClick={handleSaveOther}>Save Settings</button>
      {status && <p className="status-text">{status}</p>}

      <div className="section" style={{ marginTop: 16 }}>
        <p className="help-text">User ID: {userId?.slice(0, 8)}...</p>
        <p className="help-text">v2.1.0</p>
      </div>
    </div>
  );
}
