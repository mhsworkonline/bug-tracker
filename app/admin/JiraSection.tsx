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
        <Field label="Project Key" value={config.project_key} onChange={set("project_key")} placeholder="e.g. BUG" />
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
    </div>
  );
}
