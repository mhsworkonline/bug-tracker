"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import type { Project } from "./data";

interface StoreState {
  projects: Project[];
  loading: boolean;
  addProject: (data: { name: string; description?: string; icon_bg: string }) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
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

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    await supabase.from("BT_projects").delete().eq("id", id);
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
