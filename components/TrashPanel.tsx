"use client";
import { useEffect, useState, useCallback } from "react";
import { X, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { Task, Section } from "@/lib/data";
import type { ProjectData } from "@/hooks/useProject";
import { useAdminSettings } from "@/lib/adminSettingsContext";

interface Props {
  sections: Section[];
  onClose: () => void;
  fetchDeletedTasks: ProjectData["fetchDeletedTasks"];
  restoreTask: ProjectData["restoreTask"];
  permanentlyDeleteTask: ProjectData["permanentlyDeleteTask"];
  purgeExpiredTasks: ProjectData["purgeExpiredTasks"];
}

function daysLeft(deletedAt: string, retentionDays: number): number {
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const remaining = retentionDays - elapsedMs / 86400000;
  return Math.max(0, Math.ceil(remaining));
}

export default function TrashPanel({ sections, onClose, fetchDeletedTasks, restoreTask, permanentlyDeleteTask, purgeExpiredTasks }: Props) {
  const { taskTrashRetentionDays } = useAdminSettings();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Lazily sweep anything past retention before showing the list, rather than
    // relying on a scheduled job.
    await purgeExpiredTasks(taskTrashRetentionDays);
    setTasks(await fetchDeletedTasks());
    setLoading(false);
  }, [purgeExpiredTasks, fetchDeletedTasks, taskTrashRetentionDays]);

  useEffect(() => { load(); }, [load]);

  const doRestore = async (id: string) => {
    setActing(id);
    await restoreTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setActing(null);
  };

  const doDeleteForever = async (id: string) => {
    setActing(id);
    await permanentlyDeleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setActing(null);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[560px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E9]">
          <div>
            <h2 className="text-base font-semibold text-[#151B26]">Trash</h2>
            <p className="text-xs text-[#B0B3B8] mt-0.5">Deleted tasks are kept for {taskTrashRetentionDays} days before being removed for good.</p>
          </div>
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-[#6B6F76] text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center">
              <Trash2 size={24} className="text-[#E8E8E9] mx-auto mb-2" />
              <p className="text-sm text-[#6B6F76]">Trash is empty</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#F5F5F5]">
              {tasks.map(task => {
                const section = sections.find(s => s.id === task.section_id);
                const left = task.deleted_at ? daysLeft(task.deleted_at, taskTrashRetentionDays) : taskTrashRetentionDays;
                return (
                  <div key={task.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#151B26] truncate">{task.name || "Untitled"}</p>
                      <p className="text-xs text-[#B0B3B8] mt-0.5">
                        {section?.name ?? "No section"} · deleted {task.deleted_at ? new Date(task.deleted_at).toLocaleDateString() : ""}
                        {task.deleted_by ? ` by ${task.deleted_by}` : ""} · {left === 0 ? "removed soon" : `${left}d left`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => doRestore(task.id)}
                        disabled={acting === task.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#EEF2FB] text-[#4573D9] text-xs rounded-lg hover:bg-[#E1E9FA] disabled:opacity-50"
                      >
                        {acting === task.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Restore
                      </button>
                      <button
                        onClick={() => { if (confirm(`Permanently delete "${task.name || "Untitled"}"? This cannot be undone.`)) doDeleteForever(task.id); }}
                        disabled={acting === task.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={11} /> Delete forever
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
