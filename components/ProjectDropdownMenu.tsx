"use client";

import { useRef, useEffect, useState } from "react";
import {
  Settings, Users, Palette, Link2, Copy, Bookmark, Plus,
  Upload, Download, Archive, ChevronRight, RotateCcw, Trash2,
} from "lucide-react";
import type { Project, Section, Task } from "@/lib/data";

export type ExportType = "csv" | "excel" | "excel-delta" | "excel-attachments-only" | "excel-attachments-only-delta" | "pdf" | "json";

// null means "no filter" (every section, plus any unsectioned tasks) — the default, and
// what's sent when the picker is left untouched so nothing extra runs for the common case.
export interface SectionExportFilter {
  ids: string[];
  includeUnsectioned: boolean;
}

const EXPORT_LABELS: Record<ExportType, string> = {
  csv: "CSV",
  excel: "Excel — Full report",
  "excel-delta": "Excel — Since last report",
  "excel-attachments-only": "Excel — Attachments only (Full report)",
  "excel-attachments-only-delta": "Excel — Attachments only (Since last report)",
  pdf: "PDF",
  json: "JSON",
};

interface Props {
  project: Project;
  sections: Section[];
  tasks: Task[];
  canManage: boolean;
  canExport: boolean;
  position: { top: number; left: number };
  onExport: (type: ExportType, includeCompleted: boolean, sectionFilter: SectionExportFilter | null) => void;
  onEditSettings: () => void;
  onManageMembers: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  onImport: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ProjectDropdownMenu({
  project, sections, tasks, canManage, canExport, position,
  onExport, onEditSettings, onManageMembers, onCopyLink, onDuplicate, onSaveTemplate, onImport, onToggleActive, onDelete, onClose,
}: Props) {
  const [showExport, setShowExport] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Menu is positioned from the trigger button's rect, which can push a fixed 240px-wide
  // menu off the right edge on a narrow phone screen — clamp it back on screen after mount.
  const [pos, setPos] = useState(position);

  // "Advanced options" step shown before an export actually runs — which sections (and
  // whether to include unsectioned tasks) go into the file. Starts with everything checked
  // so an untouched picker reproduces today's "export everything" behavior exactly.
  const [pendingExport, setPendingExport] = useState<{ type: ExportType; includeCompleted: boolean } | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [includeUnsectioned, setIncludeUnsectioned] = useState(true);
  const hasUnsectionedTasks = tasks.some(t => !t.section_id);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      // The section picker manages its own backdrop-click-to-cancel — don't also treat
      // clicks inside it as "outside the menu" and tear down the whole component.
      if (pendingExport) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, pendingExport]);

  useEffect(() => {
    const margin = 8;
    const width = ref.current?.offsetWidth ?? 240;
    const maxLeft = window.innerWidth - width - margin;
    setPos({ top: position.top, left: Math.max(margin, Math.min(position.left, maxLeft)) });
  }, [position]);

  const openExportOptions = (type: ExportType) => {
    setSelectedSectionIds(new Set(sections.map(s => s.id)));
    setIncludeUnsectioned(true);
    setPendingExport({ type, includeCompleted });
    setShowExport(false);
  };

  const totalOptions = sections.length + (hasUnsectionedTasks ? 1 : 0);
  const checkedCount = selectedSectionIds.size + (hasUnsectionedTasks && includeUnsectioned ? 1 : 0);
  const allChecked = totalOptions > 0 && checkedCount === totalOptions;

  const toggleSection = (id: string) => {
    setSelectedSectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setSelectedSectionIds(new Set());
      setIncludeUnsectioned(false);
    } else {
      setSelectedSectionIds(new Set(sections.map(s => s.id)));
      setIncludeUnsectioned(true);
    }
  };

  const confirmExport = () => {
    if (!pendingExport) return;
    const filter: SectionExportFilter | null = allChecked
      ? null
      : { ids: Array.from(selectedSectionIds), includeUnsectioned };
    onExport(pendingExport.type, pendingExport.includeCompleted, filter);
    setPendingExport(null);
    onClose();
  };

  return (
    <>
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
            <button onClick={() => openExportOptions("excel")}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              Excel — Full report
            </button>
            <button onClick={() => openExportOptions("excel-delta")}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              <span className="flex-1">
                Excel — Since last report
                {project.last_excel_export_at && (
                  <span className="block text-[11px] text-[#9EA3AA]">Last sent {new Date(project.last_excel_export_at).toLocaleDateString()}</span>
                )}
              </span>
            </button>
            <div className="my-1 border-t border-[#F0F1F3]" />
            <button onClick={() => openExportOptions("excel-attachments-only")}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              Excel — Attachments only (Full report)
            </button>
            <button onClick={() => openExportOptions("excel-attachments-only-delta")}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
              <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#16A34A" }}>X</span>
              <span className="flex-1">
                Excel — Attachments only (Since last report)
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
              <button key={opt.label} onClick={() => openExportOptions(opt.type)}
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

      {canManage && (
        <>
          <div className="my-1 border-t border-[#E8E8E9]" />
          <button
            disabled={tasks.length > 0}
            title={tasks.length > 0 ? "Only projects with no tasks can be deleted" : undefined}
            onClick={() => { if (tasks.length > 0) return; onDelete(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left ${
              tasks.length > 0 ? "text-[#C8C9CC] cursor-not-allowed" : "text-[#E5534B] hover:bg-[#FFF5F5]"
            }`}
          >
            <Trash2 size={14} className={tasks.length > 0 ? "text-[#D0D2D6]" : "text-[#E5534B]"} /> Delete project
          </button>
        </>
      )}
    </div>

    {/* Advanced options — which sections go into this export. Its own modal (not another
        flyout level) since the section list can run long and needs room/scroll. */}
    {pendingExport && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40" onClick={() => setPendingExport(null)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
          <h2 className="text-base font-semibold text-[#151B26] mb-1">Export options</h2>
          <p className="text-xs text-[#6B6F76] mb-4">{EXPORT_LABELS[pendingExport.type]}</p>

          <label className="flex items-center justify-between gap-2 text-xs font-medium text-[#6B6F76] mb-2 cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <input type="checkbox" className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer" checked={allChecked} onChange={toggleAll} />
              Sections to include
            </span>
            <span>{checkedCount} / {totalOptions}</span>
          </label>

          <div className="max-h-48 overflow-y-auto border border-[#E8E8E9] rounded-lg divide-y divide-[#F0F1F3] mb-1">
            {sections.length === 0 && !hasUnsectionedTasks && (
              <p className="px-3 py-4 text-xs text-[#9EA3AA] text-center">No sections yet</p>
            )}
            {sections.map(s => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm text-[#151B26] cursor-pointer select-none hover:bg-[#FAFBFC]">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer"
                  checked={selectedSectionIds.has(s.id)}
                  onChange={() => toggleSection(s.id)}
                />
                {s.name}
              </label>
            ))}
            {hasUnsectionedTasks && (
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-[#151B26] cursor-pointer select-none hover:bg-[#FAFBFC]">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer"
                  checked={includeUnsectioned}
                  onChange={() => setIncludeUnsectioned(v => !v)}
                />
                No section
              </label>
            )}
          </div>
          {checkedCount === 0 && (
            <p className="text-[11px] text-[#E5534B] mb-3">Select at least one section.</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setPendingExport(null)} className="px-4 py-2 text-sm text-[#6B6F76] border border-[#E8E8E9] rounded-lg hover:bg-[#F5F5F5]">
              Cancel
            </button>
            <button
              onClick={confirmExport}
              disabled={checkedCount === 0}
              className="px-4 py-2 text-sm text-white bg-[#4573D9] rounded-lg hover:bg-[#3F65C4] disabled:opacity-50"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
