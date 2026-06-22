"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

const PRESET_COLORS = [
  "#F06A6A","#4ECBC4","#4573D9","#F7C325","#14A454",
  "#FF8C42","#6C63FF","#D9822B","#E879F9","#0EA5E9",
];

export default function NewProjectPage() {
  const router = useRouter();
  const { addProject } = useStore();

  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [iconBg, setIconBg]         = useState(PRESET_COLORS[0]);
  const [touched, setTouched]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const nameError = touched && !name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const project = await addProject({ name: name.trim(), description: description.trim() || undefined, icon_bg: iconBg });
    if (!project) { setError("Failed to create project. Please try again."); setSubmitting(false); return; }
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pt-20 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-light text-[#151B26] mb-8">New project</h1>
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

          <div className="flex items-center gap-3">
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
