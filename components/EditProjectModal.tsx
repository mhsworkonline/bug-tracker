"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Project } from "@/lib/data";

const COLORS = [
  "#F06A6A","#4ECBC4","#4573D9","#F7C325","#14A454",
  "#FF8C42","#6C63FF","#D9822B","#E879F9","#0EA5E9",
];

interface Props {
  project: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}

export default function EditProjectModal({ project, onClose, onSaved }: Props) {
  const [name, setName]         = useState(project.name);
  const [desc, setDesc]         = useState(project.description ?? "");
  const [color, setColor]       = useState(project.icon_bg);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, icon_bg: color }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.error) { setError(d.error); return; }
    onSaved(d.project);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#151B26]">Edit project settings</h2>
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-[#6B6F76] mb-1 block">Project name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B6F76] mb-1 block">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9] resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B6F76] mb-2 block">Color & icon</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-md transition-transform ${color === c ? "scale-110 ring-2 ring-offset-1 ring-[#4573D9]" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }} />
              ))}
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: color }}>
                {name.trim()[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-[#6B6F76] border border-[#E8E8E9] rounded-lg hover:bg-[#F5F5F5]">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="px-4 py-1.5 text-sm bg-[#4573D9] text-white rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
            {saving && <Loader2 size={12} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
