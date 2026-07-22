"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Check, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface JiraConfig {
  domain: string;
  email: string;
  api_token: string;
  project_key: string;
}

function Field({ label, value, onChange, secret, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  secret?: boolean; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-3">
      <label className="text-sm text-[#6B6F76] font-medium">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 text-sm border border-[#E8E8E9] rounded-lg outline-none focus:border-[#4573D9] pr-9"
        />
        {secret && (
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9EA3AA] hover:text-[#6B6F76]">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function JiraSection() {
  const [config, setConfig] = useState<JiraConfig>({ domain: "", email: "", api_token: "", project_key: "" });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    supabase.from("BT_settings").select("value").eq("key", "jira_config").single()
      .then(({ data }) => { if (data?.value) setConfig(data.value as JiraConfig); });
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false); setTestResult(null);
    await supabase.from("BT_settings").upsert({ key: "jira_config", value: config, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    const res = await fetch("/api/jira/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const json = await res.json();
    setTestResult({ ok: res.ok, message: json.message ?? (res.ok ? "Connection successful!" : "Connection failed.") });
    setTesting(false);
  };

  const set = (k: keyof JiraConfig) => (v: string) => setConfig(prev => ({ ...prev, [k]: v }));

  return (
    <div className="bg-white border border-[#E8E8E9] rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-[#151B26]">Jira Integration</h2>
        <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#4573D9] hover:underline">
          Get API token <ExternalLink size={11} />
        </a>
      </div>
      <p className="text-sm text-[#6B6F76] mb-5">Export tasks directly to Jira as issues.</p>

      <div className="flex flex-col gap-3">
        <Field label="Jira Domain" value={config.domain} onChange={set("domain")} placeholder="https://yourcompany.atlassian.net" />
        <Field label="Email" value={config.email} onChange={set("email")} placeholder="you@yourcompany.com" />
        <Field label="API Token" value={config.api_token} onChange={set("api_token")} secret placeholder="Paste your API token" />
        <Field label="Default Key" value={config.project_key} onChange={set("project_key")} placeholder="e.g. BUG" />
        <p className="sm:pl-[152px] -mt-1 text-xs text-[#9EA3AA]">
          Suggested prefill only. Each project must have its own Jira space initials set before it can export.
        </p>
      </div>

      {testResult && (
        <div className={`mt-4 px-3 py-2 rounded-lg text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {testResult.message}
        </div>
      )}

      <div className="flex items-center gap-2 mt-5">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
          {saved ? "Saved!" : "Save"}
        </button>
        <button onClick={test} disabled={testing || !config.domain || !config.api_token} className="flex items-center gap-1.5 px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-lg hover:bg-[#F5F5F5] disabled:opacity-40">
          {testing ? <Loader2 size={13} className="animate-spin" /> : null}
          Test connection
        </button>
      </div>

      <ForceResend />
    </div>
  );
}

// Recovery tool: re-sends every linked task even when nothing changed locally. Kept out of
// the project menu because it is slow and only needed when Jira has drifted.
function ForceResend() {
  const [projects, setProjects] = useState<{ id: string; name: string; jira_project_key: string | null }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy]   = useState<string | null>(null);
  const [done, setDone]   = useState<string | null>(null);

  useEffect(() => {
    supabase.from("BT_projects").select("id, name, jira_project_key").order("name")
      .then(({ data }) => setProjects((data ?? []) as typeof projects));
  }, []);

  const selected = projects.find(p => p.id === projectId);

  const run = async () => {
    if (!selected) return;
    if (!confirm(`Re-send every linked task in "${selected.name}" to Jira (${selected.jira_project_key})? This overwrites the Jira issues with the values from this app.`)) return;
    setBusy("Starting…"); setDone(null);
    // `since` = start of this run, so each re-sent task drops out and the loop terminates.
    const since = new Date().toISOString();
    let pushed = 0, failed = 0, guard = 0;
    try {
      while (guard++ < 500) {
        const res = await fetch("/api/jira/export", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, force: true, since }),
        });
        const json = await res.json();
        if (json.error) { setDone(json.error); setBusy(null); return; }
        const rows = (json.results ?? []) as { created?: boolean; updated?: boolean; unlinked?: boolean; error?: string }[];
        const progressed = rows.filter(r => r.created || r.updated || r.unlinked).length;
        pushed += progressed;
        failed += rows.filter(r => r.error && !r.unlinked).length;
        setBusy(`Re-sent ${pushed} of ${pushed + (json.remaining ?? 0)}…`);
        if (!json.remaining) break;
        if (progressed === 0) break; // no progress — stop rather than loop on failures
      }
      setDone(`Re-sent ${pushed} issue${pushed !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}.`);
    } finally { setBusy(null); }
  };

  return (
    <div className="mt-6 pt-5 border-t border-[#E8E8E9]">
      <h3 className="text-sm font-semibold text-[#151B26]">Re-send all tasks (repair)</h3>
      <p className="text-sm text-[#6B6F76] mt-1 mb-3">
        Pushes every linked task again, including unchanged ones. Use when Jira issues are missing
        details. Normal exports only send what changed, so you rarely need this.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={projectId}
          onChange={e => { setProjectId(e.target.value); setDone(null); }}
          className="px-3 py-2 text-sm border border-[#E8E8E9] rounded-lg outline-none focus:border-[#4573D9] bg-white"
        >
          <option value="">Select a project…</option>
          {projects.map(p => (
            <option key={p.id} value={p.id} disabled={!p.jira_project_key}>
              {p.name}{p.jira_project_key ? ` (${p.jira_project_key})` : " — no Jira key"}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!selected?.jira_project_key || !!busy}
          className="flex items-center gap-1.5 px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-lg hover:bg-[#F5F5F5] disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
          {busy ?? "Re-send"}
        </button>
      </div>
      {done && <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-[#EEF2FB] text-[#151B26] border border-[#C5D3F0]">{done}</div>}
    </div>
  );
}
