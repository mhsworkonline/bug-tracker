"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown, Archive, RotateCcw, Settings, Trash2 } from "lucide-react";
import type { Project } from "@/lib/data";
import { useStore } from "@/lib/store";

// Members isn't a real column yet (no such field on BT_projects — the table currently
// just shows a placeholder avatar), so it's the only non-sortable column.
// Incomplete tasks and Sections are computed counts, passed in via `counts` (keyed by
// project id) rather than being fields on Project itself — sorting by them is handled
// by the parent, which has the counts in scope.
export type SortableColumn = "name" | "updated_at" | "sections" | "incompleteTasks";
export interface ProjectSort {
  column: SortableColumn;
  direction: "asc" | "desc";
}

export interface ProjectCounts {
  incompleteTasks: number;
  totalTasks: number;
  sections: number;
}

interface Props {
  projects: Project[];
  isAdmin?: boolean;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  sort?: ProjectSort | null;
  onSort?: (column: SortableColumn) => void;
  counts?: Record<string, ProjectCounts>;
}

function formatModified(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function SortHeader({ label, column, sort, onSort, className }: {
  label: string; column: SortableColumn; sort?: ProjectSort | null; onSort?: (c: SortableColumn) => void; className: string;
}) {
  const active = sort?.column === column;
  const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort?.(column)}
      className={`${className} gap-1 text-xs font-medium hover:text-[#151B26] transition-colors ${active ? "text-[#151B26]" : "text-[#6B6F76]"}`}
    >
      {label} <Icon size={12} />
    </button>
  );
}

function RowMenu({ project, taskCount }: { project: Project; taskCount?: number }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { updateProject, deleteProject } = useStore();

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

  // Only safe to offer once we know the project's task count, and only when it's empty —
  // deleting a project takes its sections/attachments/comments etc. with it, so this stays
  // off the table for anything with tasks still in it.
  const canDelete = taskCount === 0;

  const confirmAndDelete = async () => {
    setDeleting(true);
    const result = await deleteProject(project.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (!result.ok) alert(result.error ?? "Failed to delete project");
  };

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
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
          <div className="my-1 border-t border-[#E8E8E9]" />
          <button
            disabled={!canDelete}
            title={canDelete ? undefined : "Only projects with no tasks can be deleted"}
            onClick={() => { if (!canDelete) return; setOpen(false); setConfirmDelete(true); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left ${
              canDelete ? "text-[#E5534B] hover:bg-[#FFF5F5]" : "text-[#C8C9CC] cursor-not-allowed"
            }`}
          >
            <Trash2 size={13} className={canDelete ? "text-[#E5534B]" : "text-[#D0D2D6]"} /> Delete project
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#151B26] mb-3">Delete &quot;{project.name}&quot;?</h2>
            <p className="text-sm text-[#6B6F76] leading-relaxed mb-6">
              This project has no tasks in it. Deleting it removes the project and its sections permanently — this can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="px-4 py-2 text-sm text-[#6B6F76] border border-[#E8E8E9] rounded-lg hover:bg-[#F5F5F5] disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={confirmAndDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-[#E5534B] rounded-lg hover:bg-[#c9463f] disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsTable({ projects, isAdmin, selectMode, selected, onToggleSelect, sort, onSort, counts }: Props) {
  const router = useRouter();

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
        {selectMode && (
          <input
            type="checkbox"
            aria-label="Select all projects"
            className="w-4 h-4 mr-3 flex-shrink-0 accent-[#4573D9]"
            checked={projects.length > 0 && projects.every(p => selected?.has(p.id))}
            onChange={() => {
              const allSelected = projects.every(p => selected?.has(p.id));
              projects.forEach(p => {
                const isSel = selected?.has(p.id) ?? false;
                if (allSelected && isSel) onToggleSelect?.(p.id);
                if (!allSelected && !isSel) onToggleSelect?.(p.id);
              });
            }}
          />
        )}
        <SortHeader label="Name" column="name" sort={sort} onSort={onSort} className="flex-1 flex items-center justify-start" />
        <div className="hidden sm:block w-32 text-xs font-medium text-[#6B6F76]" title="Not tracked yet">Members</div>
        <SortHeader label="Sections" column="sections" sort={sort} onSort={onSort} className="hidden sm:flex w-20 items-center justify-center" />
        <SortHeader label="Incomplete" column="incompleteTasks" sort={sort} onSort={onSort} className="hidden sm:flex w-24 items-center justify-center" />
        <SortHeader label="Last modified" column="updated_at" sort={sort} onSort={onSort} className="hidden sm:flex w-52 items-center justify-end" />
        <div className="w-8" />
      </div>

      {projects.map((p, i) => (
        <div
          key={p.id}
          onClick={() => { if (selectMode) onToggleSelect?.(p.id); else router.push(`/projects/${p.id}`); }}
          className={`flex items-center px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer ${
            i < projects.length - 1 ? "border-b border-[#E8E8E9]" : ""
          }`}
        >
          {selectMode && (
            <input
              type="checkbox"
              aria-label={`Select ${p.name}`}
              className="w-4 h-4 mr-3 flex-shrink-0 accent-[#4573D9]"
              checked={selected?.has(p.id) ?? false}
              onChange={() => onToggleSelect?.(p.id)}
              onClick={e => e.stopPropagation()}
            />
          )}
          {/* Archived dimming lives on this wrapper, not the row itself — opacity applies to
              the whole subtree it's set on, and the row menu (dropdown + confirm dialog)
              sits outside it so it stays fully opaque when the project is archived. */}
          <div className={`flex-1 flex items-center min-w-0 ${!p.is_active ? "opacity-60" : ""}`}>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: p.icon_bg }}
              >
                {p.name[0]}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  onClick={e => { e.stopPropagation(); if (selectMode) { e.preventDefault(); onToggleSelect?.(p.id); } }}
                  className="text-sm font-semibold text-[#151B26] hover:underline truncate block"
                >
                  {p.name}
                </Link>
                <p className="text-xs font-medium" style={{ color: p.is_active ? "#14A454" : "#B0B3B8" }}>
                  {p.is_active ? "Active" : "Archived"}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex w-32 items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">
                MH
              </div>
            </div>

            <div className="hidden sm:block w-20 text-sm text-[#6B6F76] text-center">
              {counts?.[p.id]?.sections ?? "—"}
            </div>
            <div className="hidden sm:block w-24 text-sm text-[#6B6F76] text-center">
              {counts?.[p.id]?.incompleteTasks ?? "—"}
            </div>
            <div className="hidden sm:block w-52 text-right text-sm text-[#6B6F76]">
              {formatModified(p.updated_at ?? p.created_at)}
            </div>
          </div>
          <div className="w-8 flex justify-end">
            {isAdmin && <RowMenu project={p} taskCount={counts?.[p.id]?.totalTasks} />}
          </div>
        </div>
      ))}
    </div>
  );
}
