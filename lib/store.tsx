"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import type { Project } from "./data";

interface StoreState {
  projects: Project[];
  loading: boolean;
  addProject: (data: { name: string; description?: string; icon_bg: string }) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<{ ok: boolean; error?: string }>;
  updateProject: (p: Project) => void;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("BT_projects")
      .select("*")
      .order("created_at");
    setProjects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProject = useCallback(async (
    data: { name: string; description?: string; icon_bg: string }
  ): Promise<Project | null> => {
    const { data: row, error } = await supabase
      .from("BT_projects")
      .insert(data)
      .select()
      .single();
    if (error || !row) return null;

    // Seed default column configs for new project
    const { DEFAULT_COLUMNS } = await import("./data");
    const configs = DEFAULT_COLUMNS.map((c, i) => ({
      project_id: row.id,
      column_key: c.key,
      visible: c.defaultVisible,
      position: i,
    }));
    await supabase.from("BT_column_configs").insert(configs);

    // Create a default section
    await supabase.from("BT_sections").insert({
      project_id: row.id,
      name: "Untitled section",
      position: 0,
    });

    setProjects(prev => [...prev, row]);
    return row;
  }, []);

  // Goes through the API route (not a direct client delete) so the "0 tasks" rule is
  // enforced server-side too, and permission-checked the same way as PATCH. Only removed
  // from local state once the delete actually succeeds — deletion cascades in the DB
  // (sections, comments, activity log, etc. all reference BT_projects with ON DELETE
  // CASCADE), so there's nothing else to clean up client-side.
  const deleteProject = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error ?? "Failed to delete project" };
    }
    setProjects(prev => prev.filter(p => p.id !== id));
    return { ok: true };
  }, []);

  const updateProject = useCallback((p: Project) => {
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
  }, []);

  return (
    <StoreContext.Provider value={{ projects, loading, addProject, deleteProject, updateProject, refresh: load }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within ProjectProvider");
  return ctx;
}
