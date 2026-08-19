"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/logActivity";
import { notify } from "@/lib/notify";
import type {
  Project, Section, Task, Attachment,
  ColumnConfig, ColumnKey, TaskStatus, TaskPriority, DEFAULT_COLUMNS,
} from "@/lib/data";
import { DEFAULT_COLUMNS as COLS, syncCompletionWithStatus } from "@/lib/data";

export interface ProjectData {
  project: Project | null;
  sections: Section[];
  tasks: Task[];
  columnConfigs: ColumnConfig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProjectLocal: (p: Project) => void;
  addSection: (name?: string) => Promise<Section | null>;
  addSections: (names: string[]) => Promise<Section[]>;
  updateSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  duplicateSection: (id: string) => Promise<void>;
  addTask: (sectionId: string | null, name: string, dueDate?: string, parentTaskId?: string) => Promise<Task | null>;
  duplicateTask: (taskId: string) => Promise<Task | null>;
  updateTask: (taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => Promise<void>;
  updateTaskLocal: (taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => void;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addAttachment: (taskId: string, att: Omit<Attachment, "id" | "task_id" | "uploaded_at">) => Promise<void>;
  removeAttachment: (attId: string, taskId: string, fileUrl?: string) => Promise<void>;
  updateColumnConfig: (key: ColumnKey, visible: boolean) => Promise<void>;
  fetchDeletedTasks: () => Promise<Task[]>;
  restoreTask: (taskId: string) => Promise<void>;
  permanentlyDeleteTask: (taskId: string) => Promise<void>;
  purgeExpiredTasks: (retentionDays: number) => Promise<void>;
}

// Data fetched on the server (see app/projects/[id]/page.tsx) and passed in so the
// first paint already has content instead of blanking to a spinner while the client
// re-fetches everything it was just handed.
export interface InitialProjectData {
  project: Project | null;
  sections: Section[];
  tasks: Task[];
  columnConfigs: ColumnConfig[];
}

export function useProject(projectId: string, userEmail?: string, initialData?: InitialProjectData): ProjectData {
  const [project, setProject]           = useState<Project | null>(initialData?.project ?? null);
  const [sections, setSections]         = useState<Section[]>(initialData?.sections ?? []);
  const [tasks, setTasks]               = useState<Task[]>(initialData?.tasks ?? []);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(initialData?.columnConfigs ?? []);
  const [loading, setLoading]           = useState(!initialData);
  const [error, setError]               = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [pRes, sRes, tRes, cRes] = await Promise.all([
        supabase.from("BT_projects").select("*").eq("id", projectId).single(),
        supabase.from("BT_sections").select("*").eq("project_id", projectId).order("position"),
        supabase.from("BT_tasks")
          .select("*, BT_attachments(*)")
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("position"),
        supabase.from("BT_column_configs").select("*").eq("project_id", projectId).order("position"),
      ]);

      if (pRes.error) throw pRes.error;
      setProject(pRes.data);
      setSections(sRes.data ?? []);
      setTasks(tRes.data ?? []);

      // Seed missing columns (handles first-time and new columns added later)
      let configs = cRes.data ?? [];
      const existingKeys = new Set(configs.map(c => c.column_key));
      const missing = COLS.filter(c => !existingKeys.has(c.key));
      if (missing.length > 0) {
        const seeds = missing.map((c, i) => ({
          project_id: projectId,
          column_key: c.key,
          visible: c.defaultVisible,
          position: configs.length + i,
        }));
        const { data } = await supabase.from("BT_column_configs").insert(seeds).select();
        configs = [...configs, ...(data ?? [])];
      }
      setColumnConfigs(configs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // First run after a server-fetched initial paint re-syncs quietly (no spinner flash);
  // later runs (projectId changes) behave like a normal load.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    load({ silent: !!initialData && !initialLoadDone.current });
    initialLoadDone.current = true;
    // initialData deliberately excluded — only its presence on the very first run matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  /* ── sections ── */
  const addSection = useCallback(async (name = "New section"): Promise<Section | null> => {
    const position = sections.length;
    const { data, error } = await supabase
      .from("BT_sections")
      .insert({ project_id: projectId, name, position })
      .select()
      .single();
    if (error || !data) return null;
    setSections(prev => [...prev, data]);
    logActivity(projectId, "section_created", { section_name: name }, undefined, userEmail);
    return data;
  }, [projectId, sections.length, userEmail]);

  const addSections = useCallback(async (names: string[]): Promise<Section[]> => {
    const startPos = sections.length;
    const rows = names.map((name, i) => ({ project_id: projectId, name, position: startPos + i }));
    const { data, error } = await supabase.from("BT_sections").insert(rows).select();
    if (error || !data) return [];
    setSections(prev => [...prev, ...data]);
    for (const s of data) logActivity(projectId, "section_created", { section_name: s.name }, undefined, userEmail);
    return data;
  }, [projectId, sections.length, userEmail]);

  const updateSection = useCallback(async (id: string, name: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    await supabase.from("BT_sections").update({ name }).eq("id", id);
  }, []);

  const deleteSection = useCallback(async (id: string) => {
    const sec = sections.find(s => s.id === id);
    setSections(prev => prev.filter(s => s.id !== id));
    setTasks(prev => prev.map(t => t.section_id === id ? { ...t, section_id: null } : t));
    await supabase.from("BT_tasks").update({ section_id: null }).eq("section_id", id);
    await supabase.from("BT_sections").delete().eq("id", id);
    logActivity(projectId, "section_deleted", { section_name: sec?.name }, undefined, userEmail);
  }, [sections, projectId, userEmail]);

  const duplicateSection = useCallback(async (id: string): Promise<void> => {
    const src = sections.find(s => s.id === id);
    if (!src) return;
    const { data: newSec } = await supabase.from("BT_sections")
      .insert({ project_id: projectId, name: `${src.name} (copy)`, position: sections.length })
      .select().single();
    if (!newSec) return;
    setSections(prev => [...prev, newSec]);
    const srcTasks = tasks.filter(t => t.section_id === id);
    if (!srcTasks.length) return;
    const copies = srcTasks.map(({ id: _id, created_at: _c, updated_at: _u, BT_attachments: _a, ...t }) => ({
      ...t, section_id: newSec.id, completed: false, completed_at: null,
    }));
    const { data: newTasks } = await supabase.from("BT_tasks").insert(copies).select("*, BT_attachments(*)");
    if (newTasks) setTasks(prev => [...prev, ...newTasks]);
  }, [sections, tasks, projectId]);

  /* ── tasks ── */
  const addTask = useCallback(async (sectionId: string | null, name: string, dueDate?: string, parentTaskId?: string): Promise<Task | null> => {
    const position = tasks.filter(t => t.section_id === sectionId).length;
    const payload: Record<string, unknown> = { section_id: sectionId, project_id: projectId, name, position, status: "not_started", priority: "high", task_type: "bug" };
    if (dueDate) payload.due_date = dueDate;
    if (parentTaskId) payload.parent_task_id = parentTaskId;
    const { data, error } = await supabase
      .from("BT_tasks")
      .insert(payload)
      .select("*, BT_attachments(*)")
      .single();
    if (error || !data) return null;
    setTasks(prev => [...prev, data]);
    logActivity(projectId, "task_created", { task_name: name }, data.id, userEmail);
    return data;
  }, [projectId, tasks, userEmail]);

  const duplicateTask = useCallback(async (taskId: string): Promise<Task | null> => {
    const src = tasks.find(t => t.id === taskId);
    if (!src) return null;
    const position = tasks.filter(t => t.section_id === src.section_id).length;
    // Carry over every task field except identity/timestamps and Jira linkage
    // (a copy shouldn't point at the original's external Jira issue).
    const {
      id: _id, created_at: _c, updated_at: _u, name: _n, position: _p, BT_attachments: _a,
      jira_issue_key: _ji, jira_has_updates: _jh, jira_last_pushed_at: _jl,
      jira_remote_updated_at: _jr, jira_pushed_status: _jp,
      ...rest
    } = src;
    const payload = {
      ...rest,
      project_id: projectId,
      name: `${src.name} (copy)`,
      position,
    };
    const { data, error } = await supabase
      .from("BT_tasks")
      .insert(payload)
      .select("*, BT_attachments(*)")
      .single();
    if (error || !data) return null;
    let newTask: Task = data;
    if (src.BT_attachments?.length) {
      const attachmentCopies = src.BT_attachments.map(({ id: _aid, task_id: _tid, uploaded_at: _ua, ...att }) => ({
        ...att,
        task_id: newTask.id,
      }));
      const { data: newAttachments } = await supabase
        .from("BT_attachments")
        .insert(attachmentCopies)
        .select();
      if (newAttachments) newTask = { ...newTask, BT_attachments: newAttachments };
    }
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [projectId, tasks]);

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>
  ) => {
    const task = tasks.find(t => t.id === taskId);
    const now = new Date().toISOString();
    const payload = { ...syncCompletionWithStatus(task, updates), updated_at: now };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...payload } : t));
    await supabase.from("BT_tasks").update(payload).eq("id", taskId);
    if (task) {
      const name = task.name;
      if (updates.status !== undefined && updates.status !== task.status)
        logActivity(projectId, "task_status_changed", { task_name: name, from: task.status, to: updates.status }, taskId, userEmail);
      if (updates.assignee !== undefined && updates.assignee !== task.assignee) {
        logActivity(projectId, "task_assignee_changed", { task_name: name, from: task.assignee ?? "", to: updates.assignee ?? "" }, taskId, userEmail);
        if (updates.assignee && updates.assignee !== userEmail)
          notify(updates.assignee, "task_assigned", `You were assigned "${name}"`, `Assigned by ${userEmail ?? "someone"}`, projectId, taskId);
      }
      if (updates.priority !== undefined && updates.priority !== task.priority)
        logActivity(projectId, "task_priority_changed", { task_name: name, from: task.priority ?? "", to: updates.priority ?? "" }, taskId, userEmail);
      if (updates.name !== undefined && updates.name !== task.name)
        logActivity(projectId, "task_name_changed", { task_name: task.name, to: updates.name }, taskId, userEmail);
      if (updates.due_date !== undefined && updates.due_date !== task.due_date)
        logActivity(projectId, "task_due_date_changed", { task_name: name, from: task.due_date ?? "", to: updates.due_date ?? "" }, taskId, userEmail);
      if (updates.section_id !== undefined && updates.section_id !== task.section_id) {
        const fromName = sections.find(s => s.id === task.section_id)?.name ?? "";
        const toName = sections.find(s => s.id === updates.section_id)?.name ?? "";
        logActivity(projectId, "task_section_changed", { task_name: name, from: fromName, to: toName }, taskId, userEmail);
      }
      if (updates.task_type !== undefined && updates.task_type !== task.task_type)
        logActivity(projectId, "task_type_changed", { task_name: name, from: task.task_type ?? "", to: updates.task_type ?? "" }, taskId, userEmail);
      if (updates.description !== undefined && updates.description !== task.description)
        logActivity(projectId, "task_description_changed", { task_name: name }, taskId, userEmail);
    }
  }, [tasks, sections, projectId, userEmail]);

  // Local-only optimistic update — no DB write, no activity log. For live in-progress typing (e.g. title) to reflect instantly in the list without spamming saves per keystroke.
  const updateTaskLocal = useCallback((taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }, []);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const completed = !task.completed;
    await updateTask(taskId, {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      status: completed ? "completed" as TaskStatus : "not_started" as TaskStatus,
    });
  }, [tasks, updateTask]);

  // Soft delete: marks the task (and its direct subtasks, matching the DB's own
  // parent_task_id CASCADE so a deleted parent doesn't leave orphaned children visible)
  // as deleted instead of removing the row. Attachments/storage files are left alone —
  // they're only cleaned up on permanent purge, so a restore comes back intact.
  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const childIds = tasks.filter(t => t.parent_task_id === taskId).map(t => t.id);
    const ids = [taskId, ...childIds];
    const now = new Date().toISOString();
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    await supabase.from("BT_tasks").update({ deleted_at: now, deleted_by: userEmail ?? null }).in("id", ids);
    if (task) logActivity(projectId, "task_deleted", { task_name: task.name }, taskId, userEmail);
  }, [tasks, projectId, userEmail]);

  /* ── trash (soft-deleted tasks) ── */
  const fetchDeletedTasks = useCallback(async (): Promise<Task[]> => {
    const { data } = await supabase
      .from("BT_tasks")
      .select("*, BT_attachments(*)")
      .eq("project_id", projectId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    return data ?? [];
  }, [projectId]);

  const restoreTask = useCallback(async (taskId: string) => {
    const { data, error } = await supabase
      .from("BT_tasks")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", taskId)
      .select("*, BT_attachments(*)")
      .single();
    if (error || !data) return;
    setTasks(prev => prev.some(t => t.id === data.id) ? prev : [...prev, data]);
    logActivity(projectId, "task_restored", { task_name: data.name }, taskId, userEmail);
  }, [projectId, userEmail]);

  // Hard delete of an already soft-deleted task: removes its attachment files from
  // storage, then the row (DB cascades take care of comments/followers/dependencies/
  // custom field values/subtasks/etc., same as the old hard-delete behavior did).
  const permanentlyDeleteTask = useCallback(async (taskId: string) => {
    // Also drops it from the live list — a no-op for an already soft-deleted task (it
    // was filtered out of `tasks` already), but needed when called directly on a task
    // that's still visible (e.g. discarding a never-saved blank task).
    setTasks(prev => prev.filter(t => t.id !== taskId));
    const { data: att } = await supabase.from("BT_attachments").select("url").eq("task_id", taskId);
    if (att?.length) {
      await Promise.allSettled(
        att.map(a => fetch("/api/delete-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: a.url }),
        }))
      );
    }
    await supabase.from("BT_tasks").delete().eq("id", taskId);
  }, []);

  // Permanently removes every task in this project whose deleted_at is older than the
  // configured retention window. Called lazily whenever the Trash panel is opened,
  // rather than via a scheduled job.
  const purgeExpiredTasks = useCallback(async (retentionDays: number) => {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const { data: expired } = await supabase
      .from("BT_tasks")
      .select("id")
      .eq("project_id", projectId)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);
    if (!expired?.length) return;
    await Promise.all(expired.map(t => permanentlyDeleteTask(t.id)));
  }, [projectId, permanentlyDeleteTask]);

  /* ── attachments ── */
  const addAttachment = useCallback(async (
    taskId: string,
    att: Omit<Attachment, "id" | "task_id" | "uploaded_at">
  ) => {
    const { data, error } = await supabase
      .from("BT_attachments")
      .insert({ task_id: taskId, ...att })
      .select()
      .single();
    if (error || !data) return;
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, BT_attachments: [...(t.BT_attachments ?? []), data] }
        : t
    ));
  }, []);

  const removeAttachment = useCallback(async (attId: string, taskId: string, fileUrl?: string) => {
    // Optimistically remove from UI immediately
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, BT_attachments: (t.BT_attachments ?? []).filter(a => a.id !== attId) }
        : t
    ));
    // Delete from DB and storage in parallel
    await Promise.all([
      supabase.from("BT_attachments").delete().eq("id", attId),
      fileUrl
        ? fetch("/api/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: fileUrl }),
          }).catch(err => console.error("Storage delete failed:", err))
        : Promise.resolve(),
    ]);
  }, []);

  /* ── column configs ── */
  const updateColumnConfig = useCallback(async (key: ColumnKey, visible: boolean) => {
    setColumnConfigs(prev => prev.map(c => c.column_key === key ? { ...c, visible } : c));
    await supabase
      .from("BT_column_configs")
      .update({ visible })
      .eq("project_id", projectId)
      .eq("column_key", key);
  }, [projectId]);

  const updateProjectLocal = useCallback((p: Project) => setProject(p), []);

  return {
    project, sections, tasks, columnConfigs, loading, error,
    refresh: load,
    updateProjectLocal,
    addSection, addSections, updateSection, deleteSection, duplicateSection,
    addTask, duplicateTask, updateTask, updateTaskLocal, toggleTask, deleteTask,
    addAttachment, removeAttachment,
    updateColumnConfig,
    fetchDeletedTasks, restoreTask, permanentlyDeleteTask, purgeExpiredTasks,
  };
}
