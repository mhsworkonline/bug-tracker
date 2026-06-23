"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowUpDown, Archive, RotateCcw, Settings } from "lucide-react";
import type { Project } from "@/lib/data";
import { useStore } from "@/lib/store";

interface Props {
  projects: Project[];
  isAdmin?: boolean;
}

function RowMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { updateProject } = useStore();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggleActive = async () => {
    setOpen(false);
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !project.is_active }),
    });
    const d = await r.json();
    if (d.project) updateProject(d.project);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.preventDefault(); setOpen(v => !v); }}
        className="text-[#6B6F76] text-sm px-1 hover:text-[#151B26] rounded hover:bg-[#F5F5F5] leading-none"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#E8E8E9] rounded-lg shadow-lg py-1 z-50">
          <Link
            href={`/projects/${project.id}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC]"
          >
            <Settings size={13} className="text-[#6B6F76]" /> Open settings
          </Link>
          <button
            onClick={toggleActive}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left"
          >
            {project.is_active
              ? <><Archive size={13} className="text-[#6B6F76]" /> Archive project</>
              : <><RotateCcw size={13} className="text-[#6B6F76]" /> Restore project</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsTable({ projects, isAdmin }: Props) {
  if (projects.length === 0) {
    return (
      <div className="border border-[#E8E8E9] rounded-[6px] px-6 py-12 text-center text-sm text-[#6B6F76]">
        No projects found.
      </div>
    );
  }

  return (
    <div className="border border-[#E8E8E9] rounded-[6px] overflow-hidden">
      <div className="flex items-center px-4 py-2.5 bg-[#FAFBFC] border-b border-[#E8E8E9]">
        <div className="flex-1 text-xs font-medium text-[#6B6F76]">Name</div>
        <div className="w-32 text-xs font-medium text-[#6B6F76]">Members</div>
        <div className="w-32 text-xs font-medium text-[#6B6F76]">Portfolios</div>
        <div className="w-44 flex items-center justify-end gap-1 text-xs font-medium text-[#6B6F76]">
          Last modified <ArrowUpDown size={12} />
        </div>
      </div>

      {projects.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center px-4 py-3 hover:bg-[#FAFBFC] transition-colors ${
            i < projects.length - 1 ? "border-b border-[#E8E8E9]" : ""
          } ${!p.is_active ? "opacity-60" : ""}`}
        >
          <div className="flex-1 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: p.icon_bg }}
            >
              {p.name[0]}
            </div>
            <div>
              <Link
                href={`/projects/${p.id}`}
                className="text-sm font-semibold text-[#151B26] hover:underline"
              >
                {p.name}
              </Link>
              <p className="text-xs font-medium" style={{ color: p.is_active ? "#14A454" : "#B0B3B8" }}>
                {p.is_active ? "Active" : "Archived"}
              </p>
            </div>
          </div>

          <div className="w-32 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">
              MH
            </div>
            {isAdmin && <RowMenu project={p} />}
          </div>

          <div className="w-32 text-sm text-[#6B6F76]">—</div>
          <div className="w-44 text-right text-sm text-[#6B6F76]">
            {new Date(p.updated_at ?? p.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
