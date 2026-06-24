"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, Loader2, FlaskConical, XCircle } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import type { StorageConfig } from "@/lib/adminSettings";

function MaskedInput({ value, onChange, placeholder, isSecret = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; isSecret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={isSecret && !show ? "password" : "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="w-full px-3 py-2 text-sm border border-[#E8E8E9] rounded-lg outline-none focus:border-[#4573D9] text-[#151B26] placeholder-[#9EA3AA] pr-9"
      />
      {isSecret && (
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9EA3AA] hover:text-[#6B6F76]">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <div>
        <p className="text-sm text-[#6B6F76]">{label}</p>
        {hint && <p className="text-[10px] text-[#9EA3AA]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const PROVIDERS: { key: StorageConfig["provider"]; label: string; description: string }[] = [
  { key: "supabase",   label: "Supabase Storage",  description: "Uses your existing Supabase project. No extra credentials needed." },
  { key: "cloudflare", label: "Cloudflare R2",      description: "S3-compatible object storage with no egress fees." },
  { key: "cloudinary", label: "Cloudinary",         description: "Media-optimised CDN with image/video transformations." },
  { key: "local",      label: "Local",              description: "Saves to public/uploads/. Development use only." },
];

export default function StorageSection() {
  const { storageConfig, saveStorageConfig } = useAdminSettings();
  const [draft, setDraft]   = useState<StorageConfig>({ ...storageConfig });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync when storageConfig loads from Supabase (async after mount)
  useEffect(() => { setDraft({ ...storageConfig }); setLoaded(true); }, [storageConfig]);
  const [saved, setSaved]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; url?: string } | null>(null);

  const patchCF  = (key: keyof StorageConfig["cloudflare"],  v: string) =>
    setDraft(prev => ({ ...prev, cloudflare: { ...prev.cloudflare, [key]: v } }));
  const patchCDN = (key: keyof StorageConfig["cloudinary"], v: string) =>
    setDraft(prev => ({ ...prev, cloudinary: { ...prev.cloudinary, [key]: v } }));

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    await saveStorageConfig(draft);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/storage-test", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({ ok: false, error: "Invalid response" })) : { ok: false, error: "Network error" };
    setTestResult(data);
    setTesting(false);
  };

  return (
    <section className="bg-white border border-[#E8E8E9] rounded-lg p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-1">Storage</h2>
      <p className="text-xs text-[#6B6F76] mb-5">Choose where uploaded files are stored. Credentials are saved securely in the database.</p>

      <div className="flex flex-col gap-2 mb-6">
        {PROVIDERS.map(p => {
          const active = draft.provider === p.key;
          return (
            <div
              key={p.key}
              onClick={() => setDraft(prev => ({ ...prev, provider: p.key }))}
              className={`rounded-lg border cursor-pointer transition-all ${
                active ? "border-[#4573D9] bg-[#F5F8FF]" : "border-[#E8E8E9] hover:border-[#C5D3F0] bg-white"
              }`}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  active ? "border-[#4573D9]" : "border-[#D1D5DB]"
                }`}>
                  {active && <div className="w-2 h-2 rounded-full bg-[#4573D9]" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${active ? "text-[#4573D9]" : "text-[#151B26]"}`}>{p.label}</p>
                  <p className="text-xs text-[#9EA3AA] mt-0.5">{p.description}</p>
                </div>
              </div>

              {/* Credential fields — only shown when selected */}
              {active && p.key === "cloudflare" && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#E8E8E9] pt-3" onClick={e => e.stopPropagation()}>
                  <Field label="Account ID">
                    <MaskedInput value={draft.cloudflare.account_id} onChange={v => patchCF("account_id", v)} placeholder="abc123..." />
                  </Field>
                  <Field label="Access Key ID">
                    <MaskedInput value={draft.cloudflare.access_key_id} onChange={v => patchCF("access_key_id", v)} placeholder="Access key ID" />
                  </Field>
                  <Field label="Secret Key">
                    <MaskedInput value={draft.cloudflare.secret_access_key} onChange={v => patchCF("secret_access_key", v)} placeholder="Secret access key" isSecret />
                  </Field>
                  <Field label="Bucket">
                    <MaskedInput value={draft.cloudflare.bucket} onChange={v => patchCF("bucket", v)} placeholder="my-bucket" />
                  </Field>
                  <Field label="Public URL">
                    <MaskedInput value={draft.cloudflare.public_url} onChange={v => patchCF("public_url", v)} placeholder="https://pub-xxx.r2.dev" />
                  </Field>
                </div>
              )}

              {active && p.key === "cloudinary" && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#E8E8E9] pt-3" onClick={e => e.stopPropagation()}>
                  <Field label="Cloud Name">
                    <MaskedInput value={draft.cloudinary.cloud_name} onChange={v => patchCDN("cloud_name", v)} placeholder="my-cloud" />
                  </Field>
                  <Field label="API Key">
                    <MaskedInput value={draft.cloudinary.api_key} onChange={v => patchCDN("api_key", v)} placeholder="123456789012345" />
                  </Field>
                  <Field label="API Secret">
                    <MaskedInput value={draft.cloudinary.api_secret} onChange={v => patchCDN("api_secret", v)} placeholder="API secret" isSecret />
                  </Field>
                  <Field label="Upload Preset">
                    <MaskedInput value={draft.cloudinary.upload_preset} onChange={v => patchCDN("upload_preset", v)} placeholder="unsigned_preset" />
                  </Field>
                  <Field label="Folder" hint="optional">
                    <MaskedInput value={draft.cloudinary.folder} onChange={v => patchCDN("folder", v)} placeholder="bug-tracker/attachments" />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {testResult && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg mb-4 text-sm ${testResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {testResult.ok
            ? <Check size={15} className="flex-shrink-0 mt-0.5" />
            : <XCircle size={15} className="flex-shrink-0 mt-0.5" />}
          <div className="min-w-0">
            {testResult.ok
              ? <span>Connection successful. File uploaded and verified.</span>
              : <span>{testResult.error}</span>}
            {testResult.url && (
              <a href={testResult.url} target="_blank" rel="noopener noreferrer" className="block text-xs mt-0.5 underline opacity-70 truncate">{testResult.url}</a>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={test} disabled={testing || saving}
          className="flex items-center gap-2 px-4 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#FAFBFC] disabled:opacity-60"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button onClick={save} disabled={saving || testing || !loaded}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}
