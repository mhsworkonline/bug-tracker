"use client";

import { useRef, useState, useEffect } from "react";
import {
  X, Check, ThumbsUp, Link2, Maximize2, MoreHorizontal,
  User, Calendar, ChevronDown, ChevronRight, ChevronUp, Plus, Share2,
  Paperclip, FileText, Image as ImageIcon, Film, Trash2, Loader2, Copy,
  CheckCircle2, Circle,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import TaskTypeBadge from "@/components/TaskTypeBadge";
import type { Task, Section, Attachment } from "@/lib/data";
import type { ProjectData } from "@/hooks/useProject";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import CustomFieldsPanel from "@/components/CustomFieldsPanel";
import ShareTaskModal from "@/components/ShareTaskModal";

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
  standalone?: boolean;
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
  addAttachment, removeAttachment, userEmail, isAdmin = false, standalone = false,
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
  const [linkCopied, setLinkCopied]       = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [liked, setLiked]                 = useState(false);
  const [jiraExporting, setJiraExporting] = useState(false);
  const [jiraResult, setJiraResult]       = useState<{ key: string; url: string } | null>(null);
  const [moveProjects, setMoveProjects]   = useState<{ id: string; name: string }[]>([]);
  const [moveSections, setMoveSections]   = useState<{ id: string; project_id: string; name: string }[]>([]);
  const [moveProjectId, setMoveProjectId] = useState("");
  const [moveSectionId, setMoveSectionId] = useState("");
  const [moveConfirm, setMoveConfirm]     = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<"activity" | "comments">("activity");
  const [activityLogs, setActivityLogs]   = useState<{ id: string; action: string; meta: Record<string, string>; user_email: string | null; created_at: string }[]>([]);
  const [activityOrder, setActivityOrder] = useState<"asc" | "desc">("asc");
  const [comments, setComments]           = useState<{ id: string; user_email: string | null; content: string; created_at: string; parent_comment_id?: string | null }[]>([]);
  const [replyingTo, setReplyingTo]       = useState<string | null>(null);
  const [replyDraft, setReplyDraft]       = useState("");
  const [commentDraft, setCommentDraft]   = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers]   = useState<string[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [subtasks, setSubtasks]           = useState<{ id: string; name: string; completed: boolean; status: string }[]>([]);
  const [subtaskDraft, setSubtaskDraft]   = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [deps, setDeps]                   = useState<{ id: string; depends_on_id: string; dep_name: string; dep_status: string; dep_completed: boolean }[]>([]);
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch]         = useState("");
  const [isFollowing, setIsFollowing]     = useState(false);
  const [isMilestone, setIsMilestone]     = useState(task.is_milestone ?? false);
  const menuRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dueDateRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("BT_activity_logs").select("*").eq("task_id", task.id).order("created_at", { ascending: true })
        .then(({ data }) => setActivityLogs((data as typeof activityLogs) ?? []));
      supabase.from("BT_comments").select("*").eq("task_id", task.id).order("created_at", { ascending: true })
        .then(({ data }) => setComments((data as typeof comments) ?? []));
      supabase.from("BT_tasks").select("id, name, completed, status").eq("parent_task_id", task.id).order("created_at", { ascending: true })
        .then(({ data }) => setSubtasks((data as typeof subtasks) ?? []));
      if (userEmail) {
        supabase.from("BT_task_followers").select("id").eq("task_id", task.id).eq("user_email", userEmail).single()
          .then(({ data }) => setIsFollowing(!!data));
      }
      // Load projects user can move this task to
      if (userEmail) {
        fetch(`/api/projects/user-projects?email=${encodeURIComponent(userEmail)}`)
          .then(r => r.json())
          .then(d => {
            setMoveProjects((d.projects ?? []).filter((p: { id: string }) => p.id !== task.project_id));
            setMoveSections(d.sections ?? []);
          });
      }
      // Clear Jira update indicator on open
      if (task.jira_has_updates) {
        supabase.from("BT_tasks").update({ jira_has_updates: false }).eq("id", task.id).then(() => {});
        updateTask(task.id, { jira_has_updates: false } as Parameters<typeof updateTask>[1]);
      }
      // Load dependencies
      supabase.from("BT_task_dependencies").select("id, depends_on_id, BT_tasks!depends_on_id(name, status, completed)").eq("task_id", task.id)
        .then(({ data }) => {
          setDeps((data ?? []).map((d: Record<string, unknown>) => {
            const t = d["BT_tasks"] as { name: string; status: string; completed: boolean } | null;
            return { id: d.id as string, depends_on_id: d.depends_on_id as string, dep_name: t?.name ?? "Unknown", dep_status: t?.status ?? "not_started", dep_completed: t?.completed ?? false };
          }));
        });
    });
  }, [task.id]);

  const addDependency = async (dependsOnId: string, depName: string) => {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("BT_task_dependencies").insert({ task_id: task.id, depends_on_id: dependsOnId, project_id: task.project_id }).select("id, depends_on_id").single();
    if (data) setDeps(prev => [...prev, { id: data.id, depends_on_id: data.depends_on_id, dep_name: depName, dep_status: "not_started", dep_completed: false }]);
    setShowDepPicker(false); setDepSearch("");
  };

  const removeDependency = async (depId: string) => {
    setDeps(prev => prev.filter(d => d.id !== depId));
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("BT_task_dependencies").delete().eq("id", depId);
  };

  const toggleFollow = async () => {
    if (!userEmail) return;
    const next = !isFollowing;
    setIsFollowing(next);
    const { supabase } = await import("@/lib/supabase");
    if (next) await supabase.from("BT_task_followers").insert({ task_id: task.id, user_email: userEmail });
    else await supabase.from("BT_task_followers").delete().eq("task_id", task.id).eq("user_email", userEmail);
  };

  const toggleMilestone = async () => {
    const next = !isMilestone;
    setIsMilestone(next);
    updateTask(task.id, { is_milestone: next });
  };

  const addSubtask = async () => {
    const name = subtaskDraft.trim();
    if (!name) { setAddingSubtask(false); return; }
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("BT_tasks").insert({
      name, project_id: task.project_id, section_id: task.section_id,
      parent_task_id: task.id, status: "not_started", priority: "high", task_type: "bug", position: subtasks.length,
    }).select("id, name, completed, status").single();
    if (data) setSubtasks(prev => [...prev, data as typeof subtasks[0]]);
    setSubtaskDraft(""); setAddingSubtask(false);
  };

  const toggleSubtask = async (sub: typeof subtasks[0]) => {
    const completed = !sub.completed;
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed, status: completed ? "done" : "not_started" } : s));
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("BT_tasks").update({ completed, status: completed ? "done" : "not_started" }).eq("id", sub.id);
  };

  const submitComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    setSubmittingComment(true);
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("BT_comments").insert({
      task_id: task.id, project_id: task.project_id, user_email: userEmail ?? null, content,
    }).select().single();
    if (data) {
      setComments(prev => [...prev, data as typeof comments[0]]);
      if (task.assignee && task.assignee !== userEmail)
        import("@/lib/notify").then(({ notify }) => notify(task.assignee!, "comment", `New comment on "${task.name}"`, content, task.project_id, task.id));
      // Notify @mentioned users
      const mentions = [...content.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map(m => m[1]);
      const unique = [...new Set(mentions)].filter(e => e !== userEmail && e !== task.assignee);
      if (unique.length) {
        import("@/lib/notify").then(({ notify }) => unique.forEach(e => notify(e, "mention", `You were mentioned in "${task.name}"`, content, task.project_id, task.id)));
      }
    }
    setCommentDraft("");
    setSubmittingComment(false);
  };

  const submitReply = async (parentId: string) => {
    const content = replyDraft.trim();
    if (!content) return;
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("BT_comments").insert({
      task_id: task.id, project_id: task.project_id, user_email: userEmail ?? null, content, parent_comment_id: parentId,
    }).select().single();
    if (data) setComments(prev => [...prev, data as typeof comments[0]]);
    setReplyDraft(""); setReplyingTo(null);
  };

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

  const exportToJira = async () => {
    setShowMenu(false); setJiraExporting(true); setJiraResult(null);
    const res = await fetch("/api/jira/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_ids: [task.id] }) });
    const json = await res.json();
    const result = json.results?.[0];
    if (result?.jiraKey) {
      setJiraResult({ key: result.jiraKey, url: result.jiraUrl });
      updateTask(task.id, { jira_issue_key: result.jiraKey } as Parameters<typeof updateTask>[1]);
    } else alert(result?.error ?? json.error ?? "Export failed.");
    setJiraExporting(false);
  };

  const syncFromJira = async () => {
    setShowMenu(false); setJiraExporting(true);
    const res = await fetch("/api/jira/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_ids: [task.id] }) });
    const json = await res.json();
    const result = json.results?.[0];
    if (result?.error) alert(`Sync failed: ${result.error}`);
    else alert(`Synced from Jira (${result?.jiraKey}). Refresh to see latest values.`);
    setJiraExporting(false);
  };

  const pushToJira = async () => {
    setShowMenu(false); setJiraExporting(true);
    const res = await fetch("/api/jira/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_ids: [task.id] }) });
    const json = await res.json();
    const result = json.results?.[0];
    if (result?.error) alert(`Push failed: ${result.error}`);
    else alert(`Pushed to Jira (${result?.jiraKey}) successfully.`);
    setJiraExporting(false);
  };

  const removeFromJira = async () => {
    if (!confirm(`Delete ${task.jira_issue_key} from Jira? This cannot be undone.`)) return;
    setShowMenu(false); setJiraExporting(true);
    const res = await fetch("/api/jira/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: task.id }) });
    const json = await res.json();
    if (json.error) alert(json.error);
    else {
      if (json.warning) alert(json.warning);
      updateTask(task.id, { jira_issue_key: null } as Parameters<typeof updateTask>[1]);
      setJiraResult(null);
    }
    setJiraExporting(false);
  };

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

  const panelClass = standalone
    ? "flex flex-col h-full overflow-hidden"
    : fullscreen
      ? "fixed inset-0 bg-white z-50 flex flex-col overflow-hidden"
      : "fixed right-0 top-0 h-full w-full sm:w-[45%] bg-white z-50 shadow-xl flex flex-col overflow-hidden";

  return (
    <>
      {!standalone && !fullscreen && <div className="fixed inset-0 bg-black/20 z-40" onClick={handleClose} />}
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
            {/* Milestone toggle */}
            <button
              onClick={toggleMilestone}
              title={isMilestone ? "Remove milestone" : "Mark as milestone"}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${isMilestone ? "bg-amber-50 border-amber-300 text-amber-600" : "border-[#E8E8E9] text-[#6B6F76] hover:border-amber-300 hover:text-amber-600"}`}
            >
              ◆ {isMilestone ? "Milestone" : "Set milestone"}
            </button>
            {/* Follow toggle */}
            <button
              onClick={toggleFollow}
              title={isFollowing ? "Unfollow task" : "Follow task"}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${isFollowing ? "bg-[#EEF2FB] border-[#4573D9] text-[#4573D9]" : "border-[#E8E8E9] text-[#6B6F76] hover:border-[#4573D9] hover:text-[#4573D9]"}`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
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
            <button
              onClick={() => setShowShareModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]"
            >
              <Share2 size={13} /> Share
            </button>
            <button title="Like" onClick={() => setLiked(v => !v)} className={`hidden sm:flex items-center gap-1 p-1.5 rounded transition-colors ${liked ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}><ThumbsUp size={15} /></button>
            <button title="Copy link" onClick={copyLink} className="hidden sm:flex p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Link2 size={15} /></button>
            <button title={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => setFullscreen(v => !v)} className="hidden sm:flex p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Maximize2 size={15} /></button>
            <div ref={menuRef} className="relative">
              <button onClick={() => setShowMenu(v => !v)} className={`p-1.5 rounded ${showMenu ? "bg-[#F5F5F5]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
                <MoreHorizontal size={15} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg py-1 w-52 z-[60]">
                  <button onClick={handleDuplicate} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left">
                    <Copy size={14} className="text-[#6B6F76]" /> Duplicate task
                  </button>
                  {task.jira_issue_key ? (
                    <>
                      <button onClick={pushToJira} disabled={jiraExporting} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
                        {jiraExporting ? "Updating…" : `Update Jira (${task.jira_issue_key})`}
                      </button>
                      <button onClick={syncFromJira} disabled={jiraExporting} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
                        {jiraExporting ? "Syncing…" : `Sync from Jira (${task.jira_issue_key})`}
                      </button>
                      <button onClick={removeFromJira} disabled={jiraExporting} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 text-left disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#EF4444"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#EF4444" opacity=".5"/></svg>
                        Remove from Jira
                      </button>
                    </>
                  ) : (
                    <button onClick={exportToJira} disabled={jiraExporting} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
                      {jiraExporting ? "Exporting…" : "Export to Jira"}
                    </button>
                  )}
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
          {jiraResult && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
              <span className="text-blue-700">Exported as</span>
              <a href={jiraResult.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#2684FF] hover:underline">{jiraResult.key}</a>
              <button onClick={() => setJiraResult(null)} className="ml-auto text-blue-400 hover:text-blue-700">×</button>
            </div>
          )}
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


          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-4">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Section</span>
            <select
              value={task.section_id ?? ""}
              onChange={e => updateTask(task.id, { section_id: e.target.value || null })}
              className="text-sm text-[#151B26] border border-[#E8E8E9] rounded px-2 py-1.5 outline-none hover:border-[#4573D9] focus:border-[#4573D9] bg-white w-full sm:w-auto"
            >
              <option value="">— No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {moveProjects.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 mb-4">
              <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0 pt-1.5">Move to</span>
              <div className="flex flex-col gap-2 flex-1">
                <select
                  value={moveProjectId}
                  onChange={e => { setMoveProjectId(e.target.value); setMoveSectionId(""); setMoveConfirm(false); }}
                  className="text-sm text-[#151B26] border border-[#E8E8E9] rounded px-2 py-1.5 outline-none hover:border-[#4573D9] focus:border-[#4573D9] bg-white w-full sm:w-auto"
                >
                  <option value="">— Select project</option>
                  {moveProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {moveProjectId && (
                  <select
                    value={moveSectionId}
                    onChange={e => setMoveSectionId(e.target.value)}
                    className="text-sm text-[#151B26] border border-[#E8E8E9] rounded px-2 py-1.5 outline-none hover:border-[#4573D9] focus:border-[#4573D9] bg-white w-full sm:w-auto"
                  >
                    <option value="">— No section</option>
                    {moveSections.filter(s => s.project_id === moveProjectId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                {moveProjectId && !moveConfirm && (
                  <button
                    onClick={() => setMoveConfirm(true)}
                    className="self-start px-3 py-1.5 text-sm bg-[#4573D9] text-white rounded-lg hover:bg-[#3F65C4]"
                  >
                    Move task
                  </button>
                )}
                {moveProjectId && moveConfirm && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-sm text-amber-800 flex-1">Move to <strong>{moveProjects.find(p => p.id === moveProjectId)?.name}</strong>? This task will leave the current project.</span>
                    <button onClick={() => setMoveConfirm(false)} className="text-xs text-[#6B6F76] hover:text-[#151B26]">Cancel</button>
                    <button
                      onClick={async () => {
                        await updateTask(task.id, { project_id: moveProjectId, section_id: moveSectionId || null } as Parameters<typeof updateTask>[1]);
                        onClose();
                      }}
                      className="px-3 py-1 text-xs bg-[#4573D9] text-white rounded-lg hover:bg-[#3F65C4]"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-4">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Status</span>
            <StatusBadge value={task.status} onChange={v => updateTask(task.id, { status: v })} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-4">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Priority</span>
            <PriorityBadge
              value={task.priority ?? "high"}
              onChange={v => updateTask(task.id, { priority: v })}
              disabled={lockPriorities && !isAdmin}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-4">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Task Type</span>
            <TaskTypeBadge value={task.task_type ?? "bug"} onChange={v => updateTask(task.id, { task_type: v })} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-4">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Assignee</span>
            <div className="flex items-center gap-2 flex-wrap">
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
              className="text-sm text-[#151B26] border border-[#E8E8E9] rounded px-2 py-1.5 outline-none bg-white cursor-pointer hover:border-[#4573D9] w-full sm:w-auto"
            >
              <option value="">No assignee</option>
              {members.map(m => <option key={m.id} value={m.email}>{m.name ?? m.email}</option>)}
            </select>
            {assigneePending && <span className="text-xs text-amber-500 italic">Pending admin approval…</span>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-3">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Start date</span>
            <input
              type="date"
              value={task.start_date ?? ""}
              onChange={e => updateTask(task.id, { start_date: e.target.value || null })}
              className="text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9] text-[#151B26]"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-6">
            <span className="w-24 text-xs sm:text-sm text-[#6B6F76] font-medium flex-shrink-0">Due date</span>
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

          {/* Subtasks */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-[#151B26]">Subtasks</span>
              {subtasks.length > 0 && <span className="text-xs bg-[#E8E8E9] text-[#6B6F76] rounded-full px-1.5 py-0.5">{subtasks.filter(s => s.completed).length}/{subtasks.length}</span>}
              <button onClick={() => setAddingSubtask(true)} className="text-[#6B6F76] hover:text-[#4573D9]"><Plus size={14} /></button>
            </div>
            <div className="flex flex-col gap-1">
              {subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#FAFBFC] group">
                  <button onClick={() => toggleSubtask(sub)} className="flex-shrink-0">
                    {sub.completed
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <Circle size={15} className="text-[#C8C9CC] hover:text-[#4573D9]" />}
                  </button>
                  <span className={`text-sm flex-1 ${sub.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}>{sub.name}</span>
                </div>
              ))}
              {addingSubtask ? (
                <div className="flex items-center gap-2 px-2 py-1 border border-[#4573D9] rounded">
                  <Circle size={15} className="text-[#C8C9CC] flex-shrink-0" />
                  <input
                    autoFocus value={subtaskDraft} onChange={e => setSubtaskDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addSubtask(); if (e.key === "Escape") { setAddingSubtask(false); setSubtaskDraft(""); } }}
                    onBlur={addSubtask}
                    placeholder="Subtask name"
                    className="flex-1 text-sm outline-none"
                  />
                </div>
              ) : (
                <button onClick={() => setAddingSubtask(true)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#9EA3AA] hover:text-[#6B6F76]">
                  <Plus size={13} /> Add subtask
                </button>
              )}
            </div>
          </div>

          {/* Dependencies */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-[#151B26]">Blocking / waiting on</span>
              {deps.length > 0 && <span className="text-xs bg-[#E8E8E9] text-[#6B6F76] rounded-full px-1.5 py-0.5">{deps.length}</span>}
              <button onClick={() => setShowDepPicker(v => !v)} className="text-[#6B6F76] hover:text-[#4573D9]"><Plus size={14} /></button>
            </div>
            {showDepPicker && (
              <div className="mb-2 border border-[#E8E8E9] rounded-lg overflow-hidden">
                <input
                  autoFocus value={depSearch} onChange={e => setDepSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full px-3 py-2 text-sm outline-none border-b border-[#E8E8E9]"
                />
                <div className="max-h-40 overflow-y-auto">
                  {tasks
                    .filter(t => t.id !== task.id && !deps.find(d => d.depends_on_id === t.id) && t.name.toLowerCase().includes(depSearch.toLowerCase()))
                    .slice(0, 10)
                    .map(t => (
                      <button key={t.id} onClick={() => addDependency(t.id, t.name)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5] text-left">
                        {t.completed ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" /> : <Circle size={13} className="text-[#C8C9CC] flex-shrink-0" />}
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                  {tasks.filter(t => t.id !== task.id && !deps.find(d => d.depends_on_id === t.id) && t.name.toLowerCase().includes(depSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-[#6B6F76] text-center py-3">No tasks found</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {deps.map(d => (
                <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#FAFBFC] group">
                  {d.dep_completed ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" /> : <Circle size={14} className="text-[#C8C9CC] flex-shrink-0" />}
                  <span className={`text-sm flex-1 truncate ${d.dep_completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}>{d.dep_name}</span>
                  {!d.dep_completed && <span className="text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Waiting</span>}
                  <button onClick={() => removeDependency(d.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-[#B0B3B8] hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              ))}
              {deps.length === 0 && !showDepPicker && (
                <button onClick={() => setShowDepPicker(true)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#9EA3AA] hover:text-[#6B6F76]">
                  <Plus size={13} /> Add dependency
                </button>
              )}
            </div>
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

          <CustomFieldsPanel projectId={projectId} taskId={task.id} isAdmin={isAdmin} />

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
              <div className="flex flex-col gap-3">
                {comments.length === 0 && (
                  <p className="text-sm text-[#6B6F76]">No comments yet. Be the first!</p>
                )}
                {comments.filter(c => !c.parent_comment_id).map(c => (
                  <div key={c.id}>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#4573D9] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mt-0.5">
                        {c.user_email?.slice(0, 2).toUpperCase() ?? "??"}
                      </div>
                      <div className="flex-1 min-w-0 bg-[#FAFBFC] rounded-lg px-3 py-2 border border-[#E8E8E9]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-[#151B26]">{c.user_email?.split("@")[0] ?? "Unknown"}</span>
                          <span className="text-xs text-[#B0B3B8]">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-[#151B26] whitespace-pre-wrap break-words">{c.content}</p>
                        <button onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyDraft(""); }} className="mt-1.5 text-xs text-[#6B6F76] hover:text-[#4573D9]">
                          Reply
                        </button>
                      </div>
                    </div>
                    {/* Replies */}
                    <div className="ml-8 mt-2 flex flex-col gap-2">
                      {comments.filter(r => r.parent_comment_id === c.id).map(r => (
                        <div key={r.id} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0 mt-0.5">
                            {r.user_email?.slice(0, 2).toUpperCase() ?? "??"}
                          </div>
                          <div className="flex-1 min-w-0 bg-white rounded-lg px-3 py-2 border border-[#E8E8E9]">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-[#151B26]">{r.user_email?.split("@")[0] ?? "Unknown"}</span>
                              <span className="text-xs text-[#B0B3B8]">{new Date(r.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-[#151B26] whitespace-pre-wrap break-words">{r.content}</p>
                          </div>
                        </div>
                      ))}
                      {replyingTo === c.id && (
                        <div className="flex items-center gap-2 mt-1">
                          <input autoFocus value={replyDraft} onChange={e => setReplyDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(c.id); } if (e.key === "Escape") setReplyingTo(null); }}
                            placeholder="Write a reply…" className="flex-1 text-sm border border-[#E8E8E9] rounded-md px-3 py-1.5 outline-none focus:border-[#4573D9]" />
                          <button onClick={() => submitReply(c.id)} disabled={!replyDraft.trim()} className="px-2.5 py-1.5 bg-[#4573D9] text-white text-xs rounded-md hover:bg-[#3F65C4] disabled:opacity-40">Reply</button>
                          <button onClick={() => setReplyingTo(null)} className="text-xs text-[#6B6F76] hover:text-[#151B26]">Cancel</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#E8E8E9] p-4 flex items-center gap-2 bg-white flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {userEmail?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div className="relative flex-1">
            <input
              ref={commentInputRef}
              placeholder="Add a comment… (type @ to mention)"
              value={commentDraft}
              onChange={e => {
                const val = e.target.value;
                setCommentDraft(val);
                const atIdx = val.lastIndexOf("@");
                if (atIdx !== -1 && !val.slice(atIdx + 1).includes(" ")) {
                  const q = val.slice(atIdx + 1).toLowerCase();
                  setMentionSearch(q);
                  import("@/lib/supabase").then(({ supabase }) =>
                    supabase.from("BT_task_followers").select("user_email").eq("task_id", task.id)
                      .then(({ data }) => {
                        const emails = [...new Set((data ?? []).map((r: { user_email: string }) => r.user_email))].filter(e => e.toLowerCase().includes(q));
                        setMentionUsers(emails.slice(0, 5));
                      })
                  );
                } else {
                  setMentionSearch(null);
                }
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && mentionSearch === null) { e.preventDefault(); submitComment(); } }}
              className="w-full text-sm border border-[#E8E8E9] rounded-md px-3 py-2 outline-none focus:border-[#4573D9] placeholder-[#6B6F76] text-[#151B26]"
            />
            {mentionSearch !== null && mentionUsers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-[#E8E8E9] rounded-lg shadow-lg z-50 overflow-hidden">
                {mentionUsers.map(email => (
                  <button key={email} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F5F5] text-[#151B26]"
                    onMouseDown={e => {
                      e.preventDefault();
                      const atIdx = commentDraft.lastIndexOf("@");
                      setCommentDraft(commentDraft.slice(0, atIdx) + `@${email} `);
                      setMentionSearch(null);
                      commentInputRef.current?.focus();
                    }}>
                    {email}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={submitComment}
            disabled={!commentDraft.trim() || submittingComment}
            className="px-3 py-2 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>
      {showShareModal && (
        <ShareTaskModal
          taskId={task.id}
          taskName={task.name}
          projectId={task.project_id}
          projectName={projectName}
          userEmail={userEmail}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}
