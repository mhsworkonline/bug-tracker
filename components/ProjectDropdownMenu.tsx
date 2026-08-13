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
  canExport: boolean;
  position: { top: number; left: number };
  onExport: (type: "csv" | "excel" | "excel-delta" | "pdf" | "json", includeCompleted: boolean) => void;
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
  project, canManage, canExport, position,
  onExport, onEditSettings, onManageMembers, onCopyLink, onDuplicate, onSaveTemplate, onImport, onToggleActive, onClose,
}: Props) {
  const [showExport, setShowExport] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Menu is positioned from the trigger button's rect, which can push a fixed 240px-wide
  // menu off the right edge on a narrow phone screen — clamp it back on screen after mount.
  const [pos, setPos] = useState(position);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  useEffect(() => {
    const margin = 8;
    const width = ref.current?.offsetWidth ?? 240;
    const maxLeft = window.innerWidth - width - margin;
    setPos({ top: position.top, left: Math.max(margin, Math.min(position.left, maxLeft)) });
  }, [position]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-60"
      style={{ top: pos.top, left: pos.left }}
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
      {canExport && (
      <div className="relative"
        onMouseEnter={() => setShowExport(true)}
        onMouseLeave={() => setShowExport(false)}
      >
        <button
          onClick={() => setShowExport(v => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left"
        >
          <Download size={14} className="text-[#6B6F76]" />
          <span className="flex-1">Export or sync</span>
          <ChevronRight size={13} className="text-[#6B6F76]" />
        </button>
        {showExport && (
          <div className="absolute left-0 top-full mt-1 sm:left-full sm:top-0 sm:mt-0 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-52 z-[101]">
            <div className="px-4 py-1.5 text-[10px] font-semibold text-[#6B6F76] uppercase tracking-wider">Export</div>
            <label
              className="flex items-center gap-2 px-4 py-1.5 text-xs text-[#151B26] cursor-pointer select-none"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={e => setIncludeCompleted(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer"
              />
              Include completed tasks
            </label>
            <div className="my-1 border-t border-[#F0F1F3]" />
            <button onClick={() => { onExport("excel", includeCompleted); onClose(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              Excel — Full report
            </button>
            <button onClick={() => { onExport("excel-delta", includeCompleted); onClose(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              <span className="flex-1">
                Excel — Since last report
                {project.last_excel_export_at && (
                  <span className="block text-[11px] text-[#9EA3AA]">Last sent {new Date(project.last_excel_export_at).toLocaleDateString()}</span>
                )}
              </span>
            </button>
            {[
              { label: "CSV",  badge: "C", badgeBg: "#6B6F76", type: "csv"  as const },
              { label: "PDF",  badge: "P", badgeBg: "#DC2626", type: "pdf"  as const },
              { label: "JSON", badge: "J", badgeBg: "#4573D9", type: "json" as const },
            ].map(opt => (
              <button key={opt.label} onClick={() => { onExport(opt.type, includeCompleted); onClose(); }}
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
      )}

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
