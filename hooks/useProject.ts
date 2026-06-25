"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/logActivity";
import { notify } from "@/lib/notify";
import type {
  Project, Section, Task, Attachment,
  ColumnConfig, ColumnKey, TaskStatus, TaskPriority, DEFAULT_COLUMNS,
} from "@/lib/data";
import { DEFAULT_COLUMNS as COLS } from "@/lib/data";

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
  updateSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  duplicateSection: (id: string) => Promise<void>;
  addTask: (sectionId: string | null, name: string, dueDate?: string, parentTaskId?: string) => Promise<Task | null>;
  duplicateTask: (taskId: string) => Promise<Task | null>;
  updateTask: (taskId: string, updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addAttachment: (taskId: string, att: Omit<Attachment, "id" | "task_id" | "uploaded_at">) => Promise<void>;
  removeAttachment: (attId: string, taskId: string, fileUrl?: string) => Promise<void>;
  updateColumnConfig: (key: ColumnKey, visible: boolean) => Promise<void>;
}

export function useProject(projectId: string, userEmail?: string): ProjectData {
  const [project, setProject]           = useState<Project | null>(null);
  const [sections, setSections]         = useState<Section[]>([]);
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes, tRes, cRes] = await Promise.all([
        supabase.from("BT_projects").select("*").eq("id", projectId).single(),
        supabase.from("BT_sections").select("*").eq("project_id", projectId).order("position"),
        supabase.from("BT_tasks")
          .select("*, BT_attachments(*)")
          .eq("project_id", projectId)
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

  useEffect(() => { load(); }, [load]);

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
    const payload = {
      section_id:  src.section_id,
      project_id:  projectId,
      name:        `${src.name} (copy)`,
      status:      src.status,
      priority:    src.priority ?? null,
      assignee:    src.assignee ?? null,
      due_date:    src.due_date ?? null,
      description: src.description ?? null,
      completed:   false,
      position,
    };
    const { data, error } = await supabase
      .from("BT_tasks")
      .insert(payload)
      .select("*, BT_attachments(*)")
      .single();
    if (error || !data) return null;
    setTasks(prev => [...prev, data]);
    return data;
  }, [projectId, tasks]);

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Omit<Task, "id" | "project_id" | "created_at">>
  ) => {
    const task = tasks.find(t => t.id === taskId);
    const now = new Date().toISOString();
    const payload = { ...updates, updated_at: now };
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
      if (updates.task_type !== undefined && updates.task_type !== task.task_type)
        logActivity(projectId, "task_type_changed", { task_name: name, from: task.task_type ?? "", to: updates.task_type ?? "" }, taskId, userEmail);
      if (updates.description !== undefined && updates.description !== task.description)
        logActivity(projectId, "task_description_changed", { task_name: name }, taskId, userEmail);
    }
  }, [tasks, projectId, userEmail]);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const completed = !task.completed;
    const now = new Date().toISOString();
    const updates = {
      completed,
      completed_at: completed ? now : null,
      status: completed ? "done" as TaskStatus : "not_started" as TaskStatus,
      updated_at: now,
    };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    await supabase.from("BT_tasks").update(updates).eq("id", taskId);
  }, [tasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.BT_attachments?.length) {
      Promise.allSettled(
        task.BT_attachments.map(att =>
          fetch("/api/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: att.url }),
          })
        )
      );
    }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase.from("BT_tasks").delete().eq("id", taskId);
    if (task) logActivity(projectId, "task_deleted", { task_name: task.name }, taskId, userEmail);
  }, [tasks, projectId, userEmail]);

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
    addSection, updateSection, deleteSection, duplicateSection,
    addTask, duplicateTask, updateTask, toggleTask, deleteTask,
    addAttachment, removeAttachment,
    updateColumnConfig,
  };
}
