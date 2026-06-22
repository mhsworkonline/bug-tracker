"use client";

import { useRef, useEffect, useState } from "react";
import {
  Settings, Users, Palette, Link2, Copy, Bookmark, Plus,
  Upload, Download, Archive, Trash2, ChevronRight,
} from "lucide-react";
import type { Project, Section, Task } from "@/lib/data";

interface Props {
  project: Project;
  sections: Section[];
  tasks: Task[];
  position: { top: number; left: number };
  onExport: (type: "csv" | "excel" | "pdf" | "json") => void;
  onClose: () => void;
}

export default function ProjectDropdownMenu({ project, position, onExport, onClose }: Props) {
  const [showExport, setShowExport] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const noop = () => {};

  type MenuItem =
    | { icon: React.ElementType; label: string; hasArrow?: boolean; isDestructive?: boolean; onClick: () => void; isExport?: never }
    | { icon: React.ElementType; label: string; hasArrow: true; isExport: true; isDestructive?: never; onClick?: never };

  const sections: MenuItem[][] = [
    [
      { icon: Settings,  label: "Edit project settings",      onClick: noop },
      { icon: Users,     label: "Manage project permissions", onClick: noop },
      { icon: Palette,   label: "Set color & icon",           hasArrow: true, onClick: noop },
      { icon: Link2,     label: "Copy project link",          onClick: noop },
    ],
    [
      { icon: Copy,     label: "Duplicate",        onClick: noop },
      { icon: Bookmark, label: "Save as template", onClick: noop },
      { icon: Plus,     label: "Add to portfolio", onClick: noop },
    ],
    [
      { icon: Upload,   label: "Import",          hasArrow: true, onClick: noop },
      { icon: Download, label: "Export or sync",  hasArrow: true, isExport: true },
    ],
    [
      { icon: Archive, label: "Archive",        onClick: noop },
      { icon: Trash2,  label: "Delete project", isDestructive: true, onClick: noop },
    ],
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-60"
      style={{ top: position.top, left: position.left }}
    >
      {sections.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="my-1 border-t border-[#E8E8E9]" />}
          {group.map((item) => {
            const Icon = item.icon;
            if (item.isExport) {
              return (
                <div key={item.label} className="relative"
                  onMouseEnter={() => setShowExport(true)}
                  onMouseLeave={() => setShowExport(false)}
                >
                  <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
                    <Icon size={14} className="text-[#6B6F76]" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight size={13} className="text-[#6B6F76]" />
                  </button>
                  {showExport && (
                    <div className="absolute left-full top-0 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-52 z-[101]">
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-[#6B6F76] uppercase tracking-wider">Export</div>
                      {[
                        { label: "Project tasks CSV/XLSX", badge: "X", badgeBg: "#16A34A", type: "excel" as const },
                        { label: "CSV",                    badge: "C", badgeBg: "#6B6F76", type: "csv"   as const },
                        { label: "PDF",                    badge: "P", badgeBg: "#DC2626", type: "pdf"   as const },
                        { label: "JSON",                   badge: "J", badgeBg: "#4573D9", type: "json"  as const },
                      ].map((opt) => (
                        <button key={opt.label} onClick={() => { onExport(opt.type); onClose(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left"
                        >
                          <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: opt.badgeBg }}>
                            {opt.badge}
                          </span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button key={item.label} onClick={item.onClick}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[#FAFBFC] text-left ${item.isDestructive ? "text-red-500" : "text-[#151B26]"}`}
              >
                <Icon size={14} className={item.isDestructive ? "text-red-500" : "text-[#6B6F76]"} />
                <span className="flex-1">{item.label}</span>
                {item.hasArrow && <ChevronRight size={13} className="text-[#6B6F76]" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
