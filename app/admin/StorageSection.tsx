"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import type { StorageConfig } from "@/lib/adminSettings";

function MaskedInput({
  value, onChange, placeholder, isSecret = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isSecret?: boolean;
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
        className="w-full px-3 py-1.5 text-sm border border-[#E8E8E9] rounded outline-none focus:border-[#4573D9] text-[#151B26] placeholder-[#9EA3AA] pr-9"
      />
      {isSecret && (
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6F76] hover:text-[#151B26]">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 flex-shrink-0">
        <p className="text-sm text-[#6B6F76]">{label}</p>
        {hint && <p className="text-[10px] text-[#9EA3AA]">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const PROVIDERS = [
  { key: "supabase",   label: "Supabase Storage" },
  { key: "cloudflare", label: "Cloudflare R2" },
  { key: "cloudinary", label: "Cloudinary" },
  { key: "local",      label: "Local (dev only)" },
] as const;

export default function StorageSection() {
  const { storageConfig, saveStorageConfig } = useAdminSettings();
  const [draft, setDraft]   = useState<StorageConfig>({ ...storageConfig });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const patch = <K extends keyof StorageConfig>(key: K, value: StorageConfig[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const patchCF = (key: keyof StorageConfig["cloudflare"], value: string) =>
    setDraft(prev => ({ ...prev, cloudflare: { ...prev.cloudflare, [key]: value } }));

  const patchCDN = (key: keyof StorageConfig["cloudinary"], value: string) =>
    setDraft(prev => ({ ...prev, cloudinary: { ...prev.cloudinary, [key]: value } }));

  const save = async () => {
    setSaving(true);
    await saveStorageConfig(draft);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="bg-white border border-[#E8E8E9] rounded-lg p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-1">Storage</h2>
      <p className="text-xs text-[#6B6F76] mb-5">Settings saved here override <code className="bg-[#F3F4F6] px-1 rounded">.env</code> values.</p>

      {/* Provider selector */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {PROVIDERS.map(p => (
          <button
            key={p.key}
            onClick={() => patch("provider", p.key)}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              draft.provider === p.key
                ? "border-[#4573D9] bg-[#EEF2FB] text-[#4573D9]"
                : "border-[#E8E8E9] text-[#6B6F76] hover:bg-[#FAFBFC]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {draft.provider === "supabase" && (
        <p className="text-sm text-[#6B6F76] mb-4">Uses <code className="bg-[#F3F4F6] px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-[#F3F4F6] px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> from <code className="bg-[#F3F4F6] px-1 rounded">.env</code>. No extra config needed.</p>
      )}

      {draft.provider === "local" && (
        <p className="text-sm text-[#6B6F76] mb-4">Files saved to <code className="bg-[#F3F4F6] px-1 rounded">public/uploads/</code>. Use only for local development.</p>
      )}

      {draft.provider === "cloudflare" && (
        <div className="flex flex-col gap-3 mb-4">
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

      {draft.provider === "cloudinary" && (
        <div className="flex flex-col gap-3 mb-4">
          <Field label="Cloud Name">
            <MaskedInput value={draft.cloudinary.cloud_name} onChange={v => patchCDN("cloud_name", v)} placeholder="drrgdk0hm" />
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

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Saved" : "Save storage settings"}
        </button>
      </div>
    </section>
  );
}
