"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Check, Loader2 } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import type { PriorityOption } from "@/lib/adminSettings";

export default function PrioritySection() {
  const { priorities, savePriorities } = useAdminSettings();
  const [draft, setDraft]   = useState<PriorityOption[]>(() => [...priorities].sort((a, b) => a.order - b.order));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const update = (idx: number, patch: Partial<PriorityOption>) =>
    setDraft(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDraft(next.map((p, i) => ({ ...p, order: i })));
  };

  const add = () => {
    const key = `custom_${Date.now()}`;
    setDraft(prev => [...prev, { key, label: "New Priority", bg: "#F3F4F6", text: "#6B6F76", dot: "#9CA3AF", order: prev.length }]);
  };

  const remove = (idx: number) =>
    setDraft(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })));

  const save = async () => {
    setSaving(true);
    await savePriorities(draft.map((p, i) => ({ ...p, order: i })));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="bg-white border border-[#E8E8E9] rounded-lg p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-4">Priority Labels</h2>

      <div className="flex flex-col gap-2 mb-4">
        {draft.map((p, i) => (
          <div key={p.key} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-[#6B6F76] hover:text-[#151B26] disabled:opacity-20"><ChevronUp size={13} /></button>
              <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="p-0.5 text-[#6B6F76] hover:text-[#151B26] disabled:opacity-20"><ChevronDown size={13} /></button>
            </div>

            {/* Preview badge */}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-32 flex-shrink-0" style={{ backgroundColor: p.bg, color: p.text }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.dot }} />
              {p.label || "…"}
            </span>

            {/* Label */}
            <input
              value={p.label}
              onChange={e => update(i, { label: e.target.value })}
              placeholder="Label"
              className="flex-1 min-w-0 px-2 py-1 text-sm border border-[#E8E8E9] rounded outline-none focus:border-[#4573D9] text-[#151B26]"
            />

            {/* BG color */}
            <label className="flex items-center gap-1 text-xs text-[#6B6F76] cursor-pointer flex-shrink-0">
              <span>BG</span>
              <span className="w-6 h-6 rounded border border-[#E8E8E9] overflow-hidden">
                <input type="color" value={p.bg} onChange={e => update(i, { bg: e.target.value })} className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0" />
              </span>
            </label>

            {/* Text color */}
            <label className="flex items-center gap-1 text-xs text-[#6B6F76] cursor-pointer flex-shrink-0">
              <span>Text</span>
              <span className="w-6 h-6 rounded border border-[#E8E8E9] overflow-hidden">
                <input type="color" value={p.text} onChange={e => update(i, { text: e.target.value })} className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0" />
              </span>
            </label>

            {/* Dot color */}
            <label className="flex items-center gap-1 text-xs text-[#6B6F76] cursor-pointer flex-shrink-0">
              <span>Dot</span>
              <span className="w-6 h-6 rounded border border-[#E8E8E9] overflow-hidden">
                <input type="color" value={p.dot} onChange={e => update(i, { dot: e.target.value })} className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0" />
              </span>
            </label>

            <button onClick={() => remove(i)} className="p-1.5 text-[#6B6F76] hover:text-red-500 rounded hover:bg-red-50 flex-shrink-0"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={add} className="flex items-center gap-1.5 text-sm text-[#4573D9] hover:underline">
          <Plus size={14} /> Add priority
        </button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
