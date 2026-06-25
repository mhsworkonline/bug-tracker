"use client";

import { useRef, useEffect, useState } from "react";
import {
  Settings, Users, Palette, Link2, Copy, Bookmark, Plus,
  Upload, Download, Archive, ChevronRight, RotateCcw,
} from "lucide-react";
import type { Project, Section, Task } from "@/lib/data";

interface Props {
  project: Project;
  sections: Section[];
  tasks: Task[];
  canManage: boolean;
  position: { top: number; left: number };
  onExport: (type: "csv" | "excel" | "pdf" | "json") => void;
  onEditSettings: () => void;
  onManageMembers: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  onImport: () => void;
  onToggleActive: () => void;
  onClose: () => void;
}

export default function ProjectDropdownMenu({
  project, canManage, position,
  onExport, onEditSettings, onManageMembers, onCopyLink, onDuplicate, onSaveTemplate, onImport, onToggleActive, onClose,
}: Props) {
  const [showExport, setShowExport] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-60"
      style={{ top: position.top, left: position.left }}
    >
      {/* Group 1: Settings */}
      <button onClick={() => { onEditSettings(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Settings size={14} className="text-[#6B6F76]" /> Edit project settings
      </button>
      {canManage && (
        <button onClick={() => { onManageMembers(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
          <Users size={14} className="text-[#6B6F76]" /> Manage members
        </button>
      )}
      <button onClick={() => { onEditSettings(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Palette size={14} className="text-[#6B6F76]" /> Set color & icon
      </button>
      <button onClick={() => { onCopyLink(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Link2 size={14} className="text-[#6B6F76]" /> Copy project link
      </button>

      <div className="my-1 border-t border-[#E8E8E9]" />

      {/* Group 2: Actions */}
      <button onClick={() => { onDuplicate(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Copy size={14} className="text-[#6B6F76]" /> Duplicate
      </button>
      <button onClick={() => { onSaveTemplate(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Bookmark size={14} className="text-[#6B6F76]" /> Save as template
      </button>
      <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#B0B3B8] text-left cursor-not-allowed">
        <Plus size={14} className="text-[#D0D2D6]" /> Add to portfolio
      </button>

      <div className="my-1 border-t border-[#E8E8E9]" />

      {/* Group 3: Import / Export */}
      <button onClick={() => { onImport(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        <Upload size={14} className="text-[#6B6F76]" /> Import
      </button>
      <div className="relative"
        onMouseEnter={() => setShowExport(true)}
        onMouseLeave={() => setShowExport(false)}
      >
        <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
          <Download size={14} className="text-[#6B6F76]" />
          <span className="flex-1">Export or sync</span>
          <ChevronRight size={13} className="text-[#6B6F76]" />
        </button>
        {showExport && (
          <div className="absolute left-full top-0 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-52 z-[101]">
            <div className="px-4 py-1.5 text-[10px] font-semibold text-[#6B6F76] uppercase tracking-wider">Export</div>
            {[
              { label: "Excel (.xlsx)", badge: "X", badgeBg: "#16A34A", type: "excel" as const },
              { label: "CSV",           badge: "C", badgeBg: "#6B6F76", type: "csv"   as const },
              { label: "PDF",           badge: "P", badgeBg: "#DC2626", type: "pdf"   as const },
              { label: "JSON",          badge: "J", badgeBg: "#4573D9", type: "json"  as const },
            ].map(opt => (
              <button key={opt.label} onClick={() => { onExport(opt.type); onClose(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
                <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: opt.badgeBg }}>
                  {opt.badge}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-[#E8E8E9]" />

      {/* Group 4: Archive */}
      <button onClick={() => { onToggleActive(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
        {project.is_active
          ? <><Archive size={14} className="text-[#6B6F76]" /> Archive project</>
          : <><RotateCcw size={14} className="text-[#6B6F76]" /> Restore project</>}
      </button>
    </div>
  );
}
