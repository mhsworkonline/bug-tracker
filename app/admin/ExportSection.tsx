"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/data";

const FORMAT_OPTIONS = [
  { value: "colon",   label: "Section: Task name" },
  { value: "bracket", label: "[Section] Task name" },
  { value: "slash",   label: "Section / Task name" },
];

function applyFormat(format: string, section: string, task: string) {
  if (format === "bracket") return `[${section}] ${task}`;
  if (format === "slash")   return `${section} / ${task}`;
  return `${section}: ${task}`;
}

export default function ExportSection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved]   = useState<string | null>(null);

  useEffect(() => {
    supabase.from("BT_projects").select("*").order("name").then(({ data }: { data: Project[] | null }) => {
      if (data) setProjects(data);
    });
  }, []);

  async function toggle(p: Project) {
    const next = { ...p, export_prefix: !p.export_prefix };
    setProjects(prev => prev.map(x => x.id === p.id ? next : x));
    setSaving(p.id);
    await supabase.from("BT_projects").update({ export_prefix: next.export_prefix }).eq("id", p.id);
    setSaving(null); setSaved(p.id);
    setTimeout(() => setSaved(null), 1500);
  }

  async function setFormat(p: Project, format: string) {
    const next = { ...p, export_prefix_format: format as Project["export_prefix_format"] };
    setProjects(prev => prev.map(x => x.id === p.id ? next : x));
    setSaving(p.id);
    await supabase.from("BT_projects").update({ export_prefix_format: format }).eq("id", p.id);
    setSaving(null); setSaved(p.id);
    setTimeout(() => setSaved(null), 1500);
  }

  return (
    <div className="bg-white border border-[#E8E8E9] rounded-xl p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-1">Export Settings</h2>
      <p className="text-sm text-[#6B6F76] mb-5">
        When enabled, task names in Excel/CSV exports are prefixed with their section name.
      </p>

      <div className="flex flex-col gap-3">
        {projects.length === 0 && (
          <p className="text-sm text-[#B0B3B8]">No projects found.</p>
        )}
        {projects.map(p => (
          <div key={p.id} className="flex flex-col gap-2 p-3 border border-[#F0F1F3] rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: p.icon_bg ?? "#6B6F76" }}
                >
                  {p.name[0]?.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-[#151B26]">{p.name}</span>
                {!p.is_active && <span className="text-[10px] text-[#B0B3B8] bg-[#F5F5F5] px-1.5 py-0.5 rounded">Archived</span>}
              </div>
              <div className="flex items-center gap-2">
                {saving === p.id && <Loader2 size={13} className="animate-spin text-[#B0B3B8]" />}
                {saved  === p.id && <Check size={13} className="text-[#14A454]" />}
                <button
                  onClick={() => toggle(p)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 overflow-hidden ${p.export_prefix ? "bg-[#4573D9]" : "bg-[#D0D2D6]"}`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${p.export_prefix ? "translate-x-[18px]" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            {p.export_prefix && (
              <div className="flex flex-col gap-2 pl-8">
                <div className="flex gap-2 flex-wrap">
                  {FORMAT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(p, opt.value)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        p.export_prefix_format === opt.value
                          ? "bg-[#4573D9] border-[#4573D9] text-white"
                          : "border-[#D0D2D6] text-[#6B6F76] hover:border-[#4573D9] hover:text-[#4573D9]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#B0B3B8]">
                  Preview: <span className="text-[#151B26] font-medium">
                    {applyFormat(p.export_prefix_format ?? "colon", "Home", "Fix login bug")}
                  </span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
