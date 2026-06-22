"use client";

import { useState } from "react";
import { Check, Loader2, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import type { TaskTypeOption } from "@/lib/adminSettings";

export default function TaskTypeSection() {
  const { taskTypes, saveTaskTypes } = useAdminSettings();
  const [draft, setDraft]   = useState<TaskTypeOption[]>(() => [...taskTypes]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const update = (i: number, patch: Partial<TaskTypeOption>) =>
    setDraft(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next.map((t, idx) => ({ ...t, order: idx })));
  };

  const add = () => setDraft(prev => [...prev, { key: `type_${Date.now()}`, label: "New Type", bg: "#F3F4F6", text: "#6B6F76", order: prev.length }]);
  const remove = (i: number) => setDraft(prev => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, order: idx })));

  const save = async () => {
    setSaving(true);
    await saveTaskTypes(draft);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="bg-white border border-[#E8E8E9] rounded-lg p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-1">Task Types</h2>
      <p className="text-xs text-[#6B6F76] mb-5">Configurable task type labels shown in the task list.</p>

      <div className="flex flex-col gap-2 mb-4">
        {draft.map((t, i) => (
          <div key={t.key} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-[#6B6F76] hover:text-[#151B26] disabled:opacity-30"><ChevronUp size={12} /></button>
              <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="p-0.5 text-[#6B6F76] hover:text-[#151B26] disabled:opacity-30"><ChevronDown size={12} /></button>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium w-24 text-center flex-shrink-0" style={{ backgroundColor: t.bg, color: t.text }}>{t.label || "Preview"}</span>
            <input value={t.label} onChange={e => update(i, { label: e.target.value })} className="flex-1 px-2 py-1 text-sm border border-[#E8E8E9] rounded outline-none focus:border-[#4573D9]" placeholder="Label" />
            <label className="flex items-center gap-1 text-xs text-[#6B6F76]">
              BG <input type="color" value={t.bg} onChange={e => update(i, { bg: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
            </label>
            <label className="flex items-center gap-1 text-xs text-[#6B6F76]">
              Text <input type="color" value={t.text} onChange={e => update(i, { text: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
            </label>
            <button onClick={() => remove(i)} className="p-1 text-[#6B6F76] hover:text-red-500 rounded"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={add} className="flex items-center gap-1 text-sm text-[#4573D9] hover:underline"><Plus size={13} /> Add type</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Saved" : "Save task types"}
        </button>
      </div>
    </section>
  );
}
