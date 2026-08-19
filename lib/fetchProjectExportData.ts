import { supabase } from "@/lib/supabase";
import type { Section, Task } from "@/lib/data";

export interface ProjectExportData {
  sections: Section[];
  tasks: Task[];
}

// Fetches sections + tasks (with attachments) for multiple projects in parallel, for bulk Excel export.
export async function fetchProjectsExportData(projectIds: string[]): Promise<Map<string, ProjectExportData>> {
  const results = await Promise.all(
    projectIds.map(async (id) => {
      const [sRes, tRes] = await Promise.all([
        supabase.from("BT_sections").select("*").eq("project_id", id).order("position"),
        supabase.from("BT_tasks").select("*, BT_attachments(*)").eq("project_id", id).is("deleted_at", null).order("position"),
      ]);
      return [id, { sections: sRes.data ?? [], tasks: tRes.data ?? [] }] as const;
    })
  );
  return new Map(results);
}
