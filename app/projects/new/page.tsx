"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Loader2, LayoutTemplate, CheckCircle2 } from "lucide-react";

const PRESET_COLORS = [
  "#F06A6A","#4ECBC4","#4573D9","#F7C325","#14A454",
  "#FF8C42","#6C63FF","#D9822B","#E879F9","#0EA5E9",
];

interface Template {
  id: string;
  name: string;
  description: string | null;
  icon_bg: string;
  structure: { name: string; tasks: { name: string; status: string; priority: string | null; task_type: string | null }[] }[];
}

export default function NewProjectPage() {
  const router = useRouter();
  const { addProject } = useStore();

  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [iconBg, setIconBg]         = useState(PRESET_COLORS[0]);
  const [touched, setTouched]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    supabase.from("BT_templates").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setTemplates((data as Template[]) ?? []));
  }, []);

  const applyTemplate = (t: Template) => {
    setSelectedTemplate(t);
    if (!name) setName(t.name);
    setIconBg(t.icon_bg);
    setShowTemplates(false);
  };

  const nameError = touched && !name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const project = await addProject({ name: name.trim(), description: description.trim() || undefined, icon_bg: iconBg });
    if (!project) { setError("Failed to create project. Please try again."); setSubmitting(false); return; }

    // Apply template structure
    if (selectedTemplate?.structure?.length) {
      for (let si = 0; si < selectedTemplate.structure.length; si++) {
        const sec = selectedTemplate.structure[si];
        const { data: sData } = await supabase.from("BT_sections").insert({ project_id: project.id, name: sec.name, position: si }).select().single();
        if (sData && sec.tasks?.length) {
          await supabase.from("BT_tasks").insert(
            sec.tasks.map((t, ti) => ({ project_id: project.id, section_id: sData.id, name: t.name, status: t.status ?? "not_started", priority: t.priority ?? "high", task_type: t.task_type ?? "bug", position: ti }))
          );
        }
      }
    }

    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pt-12 sm:pt-20 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-light text-[#151B26] mb-8">New project</h1>

        {/* Template picker */}
        {templates.length > 0 && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowTemplates(v => !v)}
              className="flex items-center gap-2 text-sm text-[#4573D9] hover:underline mb-2"
            >
              <LayoutTemplate size={14} /> {selectedTemplate ? `Template: ${selectedTemplate.name}` : "Use a template"}
            </button>
            {showTemplates && (
              <div className="border border-[#E8E8E9] rounded-xl overflow-hidden mb-2">
                {templates.map(t => (
                  <button
                    key={t.id} type="button" onClick={() => applyTemplate(t)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F5F5] border-b border-[#E8E8E9] last:border-0 transition-colors ${selectedTemplate?.id === t.id ? "bg-[#EEF2FB]" : ""}`}
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: t.icon_bg }}>{t.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#151B26] truncate">{t.name}</div>
                      <div className="text-xs text-[#6B6F76]">{t.structure.length} sections · {t.structure.reduce((a, s) => a + s.tasks.length, 0)} tasks</div>
                    </div>
                    {selectedTemplate?.id === t.id && <CheckCircle2 size={16} className="text-[#4573D9] flex-shrink-0" />}
                  </button>
                ))}
                <button type="button" onClick={() => { setSelectedTemplate(null); setShowTemplates(false); }} className="w-full px-4 py-2 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] text-left border-t border-[#E8E8E9]">
                  Start blank
                </button>
              </div>
            )}
            {selectedTemplate && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FB] rounded-lg text-sm text-[#4573D9]">
                <CheckCircle2 size={14} /> Using template: <strong>{selectedTemplate.name}</strong>
                <button type="button" onClick={() => setSelectedTemplate(null)} className="ml-auto text-xs underline">Remove</button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#151B26] mb-1.5">Project name</label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Enter project name"
              className={`w-full px-3 py-2 border rounded text-sm text-[#151B26] placeholder-[#6B6F76] outline-none transition-colors ${
                nameError ? "border-red-500 bg-red-50" : "border-[#E8E8E9] focus:border-[#4573D9]"
              }`}
            />
            {nameError && <p className="mt-1 text-xs text-red-500">Project name is required.</p>}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[#151B26] mb-1.5">
              Description <span className="text-[#6B6F76] font-normal">(optional)</span>
            </label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)}
              placeholder="What is this project about?" rows={3}
              className="w-full px-3 py-2 border border-[#E8E8E9] rounded text-sm text-[#151B26] placeholder-[#6B6F76] outline-none focus:border-[#4573D9] resize-none"
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-[#151B26] mb-2">Icon color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setIconBg(color)}
                  className={`w-8 h-8 rounded-md transition-transform ${iconBg === color ? "scale-110 ring-2 ring-offset-2 ring-[#4573D9]" : "hover:scale-105"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: iconBg }}>
                {name.trim()[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-[#4573D9] text-white text-sm font-medium rounded-md hover:bg-[#3F65C4] disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Creating…" : "Create project"}
            </button>
            <Link href="/projects" className="px-5 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#FAFBFC]">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
