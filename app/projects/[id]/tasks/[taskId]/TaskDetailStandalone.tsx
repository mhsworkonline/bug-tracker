"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import type { Task, Section, Project } from "@/lib/data";
import { syncCompletionWithStatus } from "@/lib/data";
import type { ProjectData } from "@/hooks/useProject";

interface Props { projectId: string; taskId: string; userEmail?: string; }

export default function TaskDetailStandalone({ projectId, taskId, userEmail }: Props) {
  const router = useRouter();
  const { statuses } = useAdminSettings();
  const [task, setTask]       = useState<Task | null>(null);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("BT_tasks").select("*, BT_attachments(*)").eq("id", taskId).single(),
      supabase.from("BT_tasks").select("*, BT_attachments(*)").eq("project_id", projectId).is("deleted_at", null),
      supabase.from("BT_sections").select("*").eq("project_id", projectId).order("position"),
      supabase.from("BT_projects").select("*").eq("id", projectId).single(),
    ]).then(([t, ts, s, p]) => {
      setTask((t.data as Task) ?? null);
      setTasks((ts.data as Task[]) ?? []);
      setSections((s.data as Section[]) ?? []);
      setProject((p.data as Project) ?? null);
      setLoading(false);
    });
  }, [projectId, taskId]);

  // Matches the project view's convention (TaskList.tsx) — project name leads, "Bug Tracker" is
  // the suffix, never the other way round. This page has no server-rendered metadata of its own
  // (project/task are fetched client-side), so without this it's stuck on the layout's bare
  // "Bug Tracker" title the whole time it's open.
  useEffect(() => {
    document.title = project?.name ? `${project.name} — Bug Tracker` : "Bug Tracker";
    return () => { document.title = "Bug Tracker"; };
  }, [project?.name]);

  const updateTask: ProjectData["updateTask"] = async (id, updates) => {
    const current = task?.id === id ? task : tasks.find(t => t.id === id);
    const synced = syncCompletionWithStatus(current, updates);
    setTask(prev => prev && prev.id === id ? { ...prev, ...synced } : prev);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...synced } : t));
    await supabase.from("BT_tasks").update({ ...synced, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const updateTaskLocal: ProjectData["updateTaskLocal"] = (id, updates) => {
    setTask(prev => prev ? { ...prev, ...updates } : prev);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleTask: ProjectData["toggleTask"] = async (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const completed = !t.completed;
    const updates = { completed, completed_at: completed ? new Date().toISOString() : null, status: completed ? "completed" : "not_started", updated_at: new Date().toISOString() };
    setTask(prev => prev?.id === id ? { ...prev, ...updates } : prev);
    setTasks(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
    await supabase.from("BT_tasks").update(updates).eq("id", id);
  };

  const addTask: ProjectData["addTask"] = async (sectionId, name, dueDate, parentTaskId) => {
    const payload: Record<string, unknown> = { section_id: sectionId, project_id: projectId, name, position: 0, status: "not_started", priority: "high", task_type: "bug" };
    if (dueDate) payload.due_date = dueDate;
    if (parentTaskId) payload.parent_task_id = parentTaskId;
    const { data } = await supabase.from("BT_tasks").insert(payload).select("*, BT_attachments(*)").single();
    if (data) setTasks(prev => [...prev, data as Task]);
    return (data as Task) ?? null;
  };

  const duplicateTask: ProjectData["duplicateTask"] = async () => null;
  const deleteTask: ProjectData["deleteTask"] = async (id) => {
    await supabase.from("BT_tasks").update({ deleted_at: new Date().toISOString(), deleted_by: userEmail ?? null }).eq("id", id);
    if (id === taskId) router.push(`/projects/${projectId}`);
  };
  // Used only for a blank task discarded on close — a real hard delete, not soft delete,
  // same as the main TaskList/TaskDetailPanel flow.
  const permanentlyDeleteTask: ProjectData["permanentlyDeleteTask"] = async (id) => {
    await supabase.from("BT_tasks").delete().eq("id", id);
    if (id === taskId) router.push(`/projects/${projectId}`);
  };
  const addAttachment: ProjectData["addAttachment"] = async (taskId, att) => {
    const { data } = await supabase.from("BT_attachments").insert({ task_id: taskId, ...att }).select().single();
    if (data) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, BT_attachments: [...(t.BT_attachments ?? []), data] } : t));
  };
  const removeAttachment: ProjectData["removeAttachment"] = async (attId, tid) => {
    await supabase.from("BT_attachments").delete().eq("id", attId);
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, BT_attachments: (t.BT_attachments ?? []).filter(a => a.id !== attId) } : t));
  };
  const addSection: ProjectData["addSection"] = async (name = "New section") => {
    const { data } = await supabase.from("BT_sections").insert({ project_id: projectId, name, position: sections.length }).select().single();
    if (data) setSections(prev => [...prev, data as Section]);
    return (data as Section) ?? null;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#6B6F76]">Loading…</div>;
  if (!task || !project) return <div className="min-h-screen flex items-center justify-center text-sm text-[#6B6F76]">Task not found.</div>;

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFC] pb-[calc(var(--bt-tabbar-h)+env(safe-area-inset-bottom))] md:pb-0">
      {/* Back link */}
      <div className="px-4 py-3 border-b border-[#E8E8E9] bg-white flex items-center gap-2 flex-shrink-0">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="text-sm text-[#6B6F76] hover:text-[#151B26]">
          ← Back to {project.name}
        </button>
      </div>
      <div className="flex-1 overflow-hidden max-w-4xl w-full mx-auto">
        <TaskDetailPanel
          task={task}
          tasks={tasks}
          projectId={projectId}
          projectName={project.name}
          projectColor={project.icon_bg ?? "#4573D9"}
          sections={sections}
          onClose={() => router.push(`/projects/${projectId}`)}
          updateTask={updateTask}
          updateTaskLocal={updateTaskLocal}
          toggleTask={toggleTask}
          duplicateTask={duplicateTask}
          deleteTask={deleteTask}
          permanentlyDeleteTask={permanentlyDeleteTask}
          addTask={addTask}
          onOpenTask={(id) => router.push(`/projects/${projectId}/tasks/${id}`)}
          addAttachment={addAttachment}
          removeAttachment={removeAttachment}
          addSection={addSection}
          userEmail={userEmail}
          isAdmin={true}
          standalone={true}
        />
      </div>
    </div>
  );
}
