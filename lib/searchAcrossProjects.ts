import { supabase } from "@/lib/supabase";

export interface TaskSearchHit {
  id: string;
  name: string;
  status: string;
  completed: boolean;
  project_id: string;
}

export interface ProjectSearchHit {
  id: string;
  name: string;
  icon_bg: string;
}

// Sentinel so `.in()` never errors / never silently matches-all on an empty allow-list.
const NONE = ["__none__"];

// allowedProjectIds: null = unrestricted (admin), [] = no access, [...] = restricted to these projects.
export async function searchTasksAcrossProjects(
  query: string,
  allowedProjectIds: string[] | null,
  limit = 20,
): Promise<TaskSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  let builder = supabase.from("BT_tasks").select("id, name, status, completed, project_id").ilike("name", `%${q}%`).is("deleted_at", null).limit(limit);
  if (allowedProjectIds !== null) builder = builder.in("project_id", allowedProjectIds.length ? allowedProjectIds : NONE);
  const { data } = await builder;
  return data ?? [];
}

export async function searchProjectsByName(
  query: string,
  allowedProjectIds: string[] | null,
  limit = 5,
): Promise<ProjectSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  let builder = supabase.from("BT_projects").select("id, name, icon_bg").ilike("name", `%${q}%`).limit(limit);
  if (allowedProjectIds !== null) builder = builder.in("id", allowedProjectIds.length ? allowedProjectIds : NONE);
  const { data } = await builder;
  return data ?? [];
}
