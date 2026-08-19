"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";

export default function TrashRetentionSection() {
  const { taskTrashRetentionDays, saveTaskTrashRetentionDays } = useAdminSettings();
  const [draft, setDraft]   = useState(String(taskTrashRetentionDays));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const save = async () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n < 1) { setDraft(String(taskTrashRetentionDays)); return; }
    setSaving(true);
    await saveTaskTrashRetentionDays(n);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="bg-white rounded-xl border border-[#E8E8E9] p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-1">Deleted Tasks</h2>
      <p className="text-sm text-[#6B6F76] mb-4">
        Deleted tasks go to each project&apos;s Trash instead of disappearing right away, so they can be restored.
        They&apos;re permanently removed after this many days.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-24 text-sm text-[#151B26] border border-[#E8E8E9] rounded-lg px-3 py-1.5 outline-none focus:border-[#4573D9]"
        />
        <span className="text-sm text-[#6B6F76]">days before a deleted task is gone for good</span>
        {saving && <Loader2 size={14} className="animate-spin text-[#B0B3B8]" />}
        {saved && <Check size={14} className="text-green-600" />}
      </div>
    </section>
  );
}
