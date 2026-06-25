"use client";

import { useRef, useState, useEffect } from "react";
import {
  X, Check, ThumbsUp, Link2, Maximize2, MoreHorizontal,
  User, Calendar, ChevronDown, ChevronRight, ChevronUp, Plus, Share2,
  Paperclip, FileText, Image as ImageIcon, Film, Trash2, Loader2, Copy,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import TaskTypeBadge from "@/components/TaskTypeBadge";
import type { Task, Section, Attachment } from "@/lib/data";
import type { ProjectData } from "@/hooks/useProject";
import { useAdminSettings } from "@/lib/adminSettingsContext";

interface Props {
  task: Task;
  tasks: Task[];
  projectId: string;
  projectName: string;
  projectColor: string;
  sections: Section[];
  onClose: () => void;
  updateTask: ProjectData["updateTask"];
  toggleTask: ProjectData["toggleTask"];
  duplicateTask: ProjectData["duplicateTask"];
  deleteTask: ProjectData["deleteTask"];
  addTask: ProjectData["addTask"];
  onOpenTask: (taskId: string) => void;
  addAttachment: ProjectData["addAttachment"];
  removeAttachment: ProjectData["removeAttachment"];
  userEmail?: string;
  isAdmin?: boolean;
}

function formatActivityLog(log: { action: string; meta: Record<string, string> }): string {
  const m = log.meta;
  switch (log.action) {
    case "task_status_changed":      return `changed status from "${m.from}" to "${m.to}"`;
    case "task_assignee_changed":    return `changed assignee to ${m.to || "unassigned"}`;
    case "task_priority_changed":    return `changed priority from "${m.from}" to "${m.to}"`;
    case "task_name_changed":        return `renamed task to "${m.to}"`;
    case "task_due_date_changed":    return `changed due date from ${m.from || "none"} to ${m.to || "none"}`;
    case "task_type_changed":        return `changed type from "${m.from}" to "${m.to}"`;
    case "task_description_changed": return `updated the description`;
    default:                         return log.action.replace(/_/g, " ");
  }
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon size={16} className="text-blue-500" />;
  if (type.startsWith("video/")) return <Film size={16} className="text-purple-500" />;
  return <FileText size={16} className="text-[#6B6F76]" />;
}

export default function TaskDetailPanel({
  task, tasks, projectId, projectName, projectColor, sections, onClose,
  updateTask, toggleTask, duplicateTask, deleteTask, addTask, onOpenTask,
  addAttachment, removeAttachment, userEmail, isAdmin = false,
}: Props) {
  const { lockPriorities, requireAssigneeApproval } = useAdminSettings();
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  const prevTask  = taskIndex > 0 ? tasks[taskIndex - 1] : null;
  const nextTask  = taskIndex < tasks.length - 1 ? tasks[taskIndex + 1] : null;
  const [editingTitle, setEditingTitle]   = useState(true);
  const [titleDraft, setTitleDraft]       = useState(task.name);
  const [uploading, setUploading]         = useState(false);
  const [members, setMembers]             = useState<{ id: string; email: string; name?: string | null }[]>([]);
  const [assigneePending, setAssigneePending] = useState(false);
  const [fullscreen, setFullscreen]       = useState(false);
  const [showMenu, setShowMenu]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<"activity" | "comments">("activity");
  const [activityLogs, setActivityLogs]   = useState<{ id: string; action: string; meta: Record<string, string>; user_email: string | null; created_at: string }[]>([]);
  const [activityOrder, setActivityOrder] = useState<"asc" | "desc">("asc");
  const menuRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dueDateRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("BT_activity_logs").select("*").eq("task_id", task.id).order("created_at", { ascending: true })
        .then(({ data }) => setActivityLogs((data as typeof activityLogs) ?? []));
    });
  }, [task.id]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`).then(r => r.json()).then(d => setMembers(d.members ?? []));
  }, [projectId]);

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);


  const saveTitle = () => {
    const v = titleDraft.trim();
    if (v && v !== task.name) updateTask(task.id, { name: v });
    setEditingTitle(false);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const presignRes = await fetch("/api/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content_type: file.type }),
        });
        if (!presignRes.ok) throw new Error("Could not get upload config");
        const cfg = await presignRes.json();

        let url: string;

        if (cfg.provider === "cloudinary") {
          // Direct browser → Cloudinary (unsigned preset)
          const fd = new FormData();
          fd.append("file", file);
          fd.append("upload_preset", cfg.upload_preset);
          if (cfg.folder) fd.append("folder", cfg.folder);
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud_name}/auto/upload`, { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message ?? "Cloudinary upload failed");
          url = data.secure_url;

        } else if (cfg.provider === "cloudflare") {
          // Direct browser → R2 via presigned PUT
          const res = await fetch(cfg.upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (!res.ok) throw new Error("R2 upload failed");
          url = cfg.public_url;

        } else if (cfg.provider === "supabase") {
          // Direct browser → Supabase Storage
          const { supabase } = await import("@/lib/supabase");
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
          const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;
          const { error } = await supabase.storage.from("bt-attachments").upload(key, file, { contentType: file.type });
          if (error) throw new Error(error.message);
          const { data: { publicUrl } } = supabase.storage.from("bt-attachments").getPublicUrl(key);
          url = publicUrl;

        } else {
          // local dev — still use the old server route
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "Upload failed"); }
          const data = await res.json();
          url = data.url;
        }

        await addAttachment(task.id, { name: file.name, url, file_type: file.type, size: file.size });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploadFilesRef = useRef(uploadFiles);
  useEffect(() => { uploadFilesRef.current = uploadFiles; });

  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []).filter(i => i.type.startsWith("image/"));
      if (!items.length) return;
      e.preventDefault();
      const files = items.flatMap(item => {
        const blob = item.getAsFile();
        if (!blob) return [];
        return [new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type })];
      });
      if (files.length) await uploadFilesRef.current(files);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(Array.from(e.target.files ?? []));
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/tasks/${task.id}`).catch(() => {});
  };

  const handleDuplicate = async () => { setShowMenu(false); await duplicateTask(task.id); };
  const handleDelete    = async () => { await deleteTask(task.id); onClose(); };

  const section     = sections.find((s) => s.id === task.section_id);
  const attachments = task.BT_attachments ?? [];

  // Commit saves unsaved title; deletes task if truly empty. Used on every exit path.
  const commitOrDelete = () => {
    const name = titleDraft.trim();
    if (name && name !== task.name) updateTask(task.id, { name });
    if (!name && !task.description?.trim() && attachments.length === 0) deleteTask(task.id);
  };

  const handleClose    = () => { commitOrDelete(); onClose(); };
  const handleNavigate = (targetId: string) => { commitOrDelete(); onOpenTask(targetId); };

  // Capture-phase ESC listener — fires before TaskList's bubble-phase window handler.
  // Stops propagation so TaskList never sees the event.
  const escRef = useRef<(e: KeyboardEvent) => void>(() => {});
  escRef.current = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    commitOrDelete();
    onClose();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => escRef.current(e);
    document.addEventListener("keydown", h, true);
    return () => document.removeEventListener("keydown", h, true);
  }, []);

  const panelClass = fullscreen
    ? "fixed inset-0 bg-white z-50 flex flex-col overflow-hidden"
    : "fixed right-0 top-0 h-full w-full sm:w-[45%] bg-white z-50 shadow-xl flex flex-col overflow-hidden";

  return (
    <>
      {!fullscreen && <div className="fixed inset-0 bg-black/20 z-40" onClick={handleClose} />}
      <div className={panelClass}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E9] flex-shrink-0">
          <button
            onClick={() => toggleTask(task.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
              task.completed
                ? "bg-[#14A454] border-[#14A454] text-white"
                : "border-[#E8E8E9] text-[#6B6F76] hover:border-[#4573D9] hover:text-[#4573D9]"
            }`}
          >
            <Check size={14} />
            {task.completed ? "Completed" : "Mark complete"}
          </button>

          <div className="flex items-center gap-1.5">
            {/* Prev / Next navigation */}
            <div className="flex items-center border border-[#E8E8E9] rounded-md overflow-hidden">
              <button
                title="Previous task"
                disabled={!prevTask}
                onClick={() => prevTask && handleNavigate(prevTask.id)}
                className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#E8E8E9]"
              >
                <ChevronUp size={15} />
              </button>
              <button
                title="Next task"
                disabled={!nextTask}
                onClick={() => nextTask && handleNavigate(nextTask.id)}
                className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown size={15} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">MH</div>
              <button
                title="Add collaborator"
                onClick={async () => {
                  const newTask = await addTask(task.section_id, "");
                  if (newTask) onOpenTask(newTask.id);
                }}
                className="w-6 h-6 rounded-full border border-[#E8E8E9] bg-white flex items-center justify-center text-[#6B6F76] hover:bg-[#F5F5F5]"
              >
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
              <Share2 size={13} /> Share
            </button>
            <button title="Like" className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><ThumbsUp size={15} /></button>
            <button title="Copy link" onClick={copyLink} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Link2 size={15} /></button>
            <button title={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => setFullscreen(v => !v)} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Maximize2 size={15} /></button>
            <div ref={menuRef} className="relative">
              <button onClick={() => setShowMenu(v => !v)} className={`p-1.5 rounded ${showMenu ? "bg-[#F5F5F5]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
                <MoreHorizontal size={15} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-52 z-[60]">
                  <button onClick={handleDuplicate} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
                    <Copy size={14} className="text-[#6B6F76]" /> Duplicate task
                  </button>
                  <div className="my-1 border-t border-[#E8E8E9]" />
                  <button onClick={() => { setShowMenu(false); setConfirmDelete(true); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 text-left">
                    <Trash2 size={14} /> Delete task
                  </button>
                </div>
              )}
            </div>
            <button title="Close" onClick={handleClose} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={15} /></button>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center" onClick={() => setConfirmDelete(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-[#151B26] mb-2">Delete task?</h3>
              <p className="text-sm text-[#6B6F76] mb-5">This will permanently delete <span className="font-medium text-[#151B26]">"{task.name}"</span> and all its attachments.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDelete(false)} className="px-4 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#FAFBFC]">Cancel</button>
                <button onClick={handleDelete} className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div
          className={`flex-1 overflow-y-auto p-6 relative ${fullscreen ? "max-w-4xl mx-auto w-full" : ""}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-[#4573D9]/10 border-2 border-dashed border-[#4573D9] rounded-lg flex items-center justify-center pointer-events-none">
              <p className="text-[#4573D9] font-medium text-sm">Drop files to attach</p>
            </div>
          )}

          {editingTitle ? (
            <textarea
              autoFocus
              value={titleDraft}
              rows={1}
              onChange={e => {
                setTitleDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onFocus={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveTitle(); } }}
              className="w-full text-2xl font-bold text-[#151B26] outline-none border-b-2 border-[#4573D9] mb-4 bg-transparent resize-none overflow-hidden leading-tight"
            />
          ) : (
            <h1
              onClick={() => { setTitleDraft(task.name); setEditingTitle(true); }}
              className={`text-2xl font-bold mb-4 cursor-text hover:bg-[#FAFBFC] rounded px-1 -mx-1 break-words whitespace-pre-wrap ${task.completed ? "line-through text-[#6B6F76]" : task.name ? "text-[#151B26]" : "text-[#9EA3AA] font-normal italic"}`}
            >
              {task.name || "Click to add task name…"}
            </h1>
          )}


          <div className="flex items-center gap-4 mb-4">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Section</span>
            <select
              value={task.section_id ?? ""}
              onChange={e => updateTask(task.id, { section_id: e.target.value || null })}
              className="text-sm text-[#151B26] border border-[#E8E8E9] rounded px-2 py-1 outline-none hover:border-[#4573D9] focus:border-[#4573D9] bg-white"
            >
              <option value="">— No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Status</span>
            <StatusBadge value={task.status} onChange={v => updateTask(task.id, { status: v })} />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Priority</span>
            <PriorityBadge
              value={task.priority ?? "high"}
              onChange={v => updateTask(task.id, { priority: v })}
              disabled={lockPriorities && !isAdmin}
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Task Type</span>
            <TaskTypeBadge value={task.task_type ?? "bug"} onChange={v => updateTask(task.id, { task_type: v })} />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Assignee</span>
            <div className="flex items-center gap-2">
            <select
              value={task.assignee ?? ""}
              onChange={async e => {
                const email = e.target.value || null;
                if (!isAdmin && requireAssigneeApproval && email) {
                  setAssigneePending(true);
                  await fetch("/api/assignment-requests", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ task_id: task.id, project_id: task.project_id, task_name: task.name, assignee_email: email }) });
                  setAssigneePending(false);
                } else {
                  updateTask(task.id, { assignee: email });
                }
              }}
              className="text-sm text-[#151B26] border-0 outline-none bg-transparent cursor-pointer hover:bg-[#FAFBFC] px-2 py-1 rounded"
            >
              <option value="">No assignee</option>
              {members.map(m => <option key={m.id} value={m.email}>{m.name ?? m.email}</option>)}
            </select>
            {assigneePending && <span className="text-xs text-amber-500 italic">Pending admin approval…</span>}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <span className="w-24 text-sm text-[#6B6F76] font-medium flex-shrink-0">Due date</span>
            <button
              onClick={() => { dueDateRef.current?.showPicker?.(); dueDateRef.current?.click(); }}
              className="flex items-center gap-2 text-sm text-[#6B6F76] hover:bg-[#FAFBFC] px-2 py-1 rounded"
            >
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-[#6B6F76] flex items-center justify-center"><Calendar size={10} /></div>
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : "No due date"}
            </button>
            <input
              ref={dueDateRef}
              type="date"
              className="sr-only"
              value={task.due_date ?? ""}
              onChange={e => updateTask(task.id, { due_date: e.target.value || null })}
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#151B26]">Projects</span>
                <span className="text-xs bg-[#E8E8E9] text-[#6B6F76] rounded-full px-1.5 py-0.5">1</span>
                <button className="text-[#6B6F76] hover:text-[#151B26]"><Plus size={14} /></button>
              </div>
              <button className="text-sm text-[#4573D9] hover:underline">Send feedback</button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFBFC] rounded border border-[#E8E8E9]">
              <ChevronRight size={13} className="text-[#6B6F76]" />
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: projectColor }} />
              <span className="text-sm font-medium text-[#151B26]">{projectName}</span>
              <span className="text-[#6B6F76] text-sm">:</span>
              <button className="flex items-center gap-1 text-sm text-[#6B6F76] hover:text-[#151B26]">
                {section?.name ?? "Untitled section"} <ChevronDown size={12} />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#151B26] mb-2">Description</h3>
            <textarea
              value={task.description ?? ""}
              onChange={e => updateTask(task.id, { description: e.target.value })}
              placeholder="What is this task about?"
              className="w-full min-h-[100px] text-sm text-[#151B26] placeholder-[#6B6F76] border border-transparent hover:border-[#E8E8E9] focus:border-[#4573D9] outline-none rounded p-2 resize-none bg-transparent"
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#151B26]">
                Attachments
                {attachments.length > 0 && <span className="ml-2 text-xs bg-[#E8E8E9] text-[#6B6F76] rounded-full px-1.5 py-0.5">{attachments.length}</span>}
              </h3>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded disabled:opacity-50">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" className="sr-only" onChange={handleFileSelect} />
            {uploadError && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="flex-shrink-0 text-red-400 hover:text-red-600"><X size={12} /></button>
              </div>
            )}
            {attachments.length === 0 && !uploading ? (
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#E8E8E9] rounded text-sm text-[#6B6F76] hover:border-[#4573D9] hover:text-[#4573D9] transition-colors">
                <Paperclip size={14} /> Click, drag & drop, or paste (Ctrl+V)
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-2 border border-[#E8E8E9] rounded hover:bg-[#FAFBFC] group">
                    {att.file_type.startsWith("image/")
                      ? <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                      : <div className="w-10 h-10 bg-[#F5F5F5] rounded flex items-center justify-center flex-shrink-0">{fileIcon(att.file_type)}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#151B26] hover:underline truncate block">{att.name}</a>
                      <p className="text-xs text-[#6B6F76]">{fmtBytes(att.size)}</p>
                    </div>
                    <button onClick={() => removeAttachment(att.id, task.id, att.url)} className="p-1 text-[#6B6F76] hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                  </div>
                ))}
                {uploading && (
                  <div className="flex items-center gap-2 p-2 border border-dashed border-[#E8E8E9] rounded text-sm text-[#6B6F76]">
                    <Loader2 size={14} className="animate-spin" /> Uploading…
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#151B26]">Subtasks</h3>
              <div className="flex items-center gap-1">
                <button className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Link2 size={14} /></button>
                <button className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Plus size={14} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border border-[#E8E8E9] rounded">
              <input placeholder="Type to add a subtask..." className="flex-1 text-sm outline-none placeholder-[#6B6F76] text-[#151B26]" />
              <button className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Calendar size={13} /></button>
              <button className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><User size={13} /></button>
            </div>
          </div>

          <div className="border-t border-[#E8E8E9] pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                {(["activity", "comments"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-sm pb-1 capitalize ${activeTab === tab ? "font-medium text-[#151B26] border-b-2 border-[#4573D9]" : "text-[#6B6F76] hover:text-[#151B26]"}`}
                  >
                    {tab === "activity" ? "All activity" : "Comments"}
                  </button>
                ))}
              </div>
              {activeTab === "activity" && activityLogs.length > 0 && (
                <button
                  onClick={() => setActivityOrder(o => o === "asc" ? "desc" : "asc")}
                  className="text-xs text-[#6B6F76] hover:text-[#151B26]"
                >
                  ↑↓ {activityOrder === "asc" ? "Oldest" : "Newest"}
                </button>
              )}
            </div>

            {activeTab === "activity" && (
              <div className="flex flex-col gap-3">
                {/* Task created entry */}
                {(() => {
                  const initials = (task as { created_by?: string }).created_by?.slice(0, 2).toUpperCase() ?? userEmail?.slice(0, 2).toUpperCase() ?? "??";
                  const createdEntry = { id: "__created__", user_email: userEmail ?? null, created_at: task.created_at, label: "created this task" };
                  const logs = [...activityLogs];
                  if (activityOrder === "desc") logs.reverse();
                  const allEntries = activityOrder === "asc"
                    ? [createdEntry, ...logs.map(l => ({ ...l, label: formatActivityLog(l) }))]
                    : [...logs.map(l => ({ ...l, label: formatActivityLog(l) })), createdEntry];
                  return allEntries.map(entry => {
                    const ini = entry.user_email?.slice(0, 2).toUpperCase() ?? initials;
                    return (
                      <div key={entry.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mt-0.5">{ini}</div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-[#6B6F76]">
                            <span className="font-medium text-[#151B26]">{entry.user_email?.split("@")[0] ?? "Unknown"}</span>
                            {" "}{entry.label}
                          </span>
                          <div className="text-xs text-[#B0B3B8] mt-0.5">{new Date(entry.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  });
                })()}
                {activityLogs.length === 0 && (
                  <p className="text-sm text-[#6B6F76]">No activity yet.</p>
                )}
              </div>
            )}

            {activeTab === "comments" && (
              <p className="text-sm text-[#6B6F76]">Comments coming soon.</p>
            )}
          </div>
        </div>

        <div className="border-t border-[#E8E8E9] p-4 flex items-center gap-2 bg-white flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {userEmail?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <input placeholder="Add a comment" className="flex-1 text-sm border border-[#E8E8E9] rounded-md px-3 py-2 outline-none focus:border-[#4573D9] placeholder-[#6B6F76] text-[#151B26]" />
        </div>
      </div>
    </>
  );
}
