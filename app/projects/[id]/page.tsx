import { Suspense } from "react";
import TaskList from "@/components/TaskList";
import { getUser } from "@/lib/auth-server";
import { supabase } from "@/lib/supabase";
import type { InitialProjectData } from "@/hooks/useProject";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch the auth check and the task-list data in parallel on the server, so the
  // page arrives with content already in it instead of blanking to a client-side
  // spinner while the browser re-requests everything it could've been handed up front.
  const [user, pRes, sRes, tRes, cRes] = await Promise.all([
    getUser(),
    supabase.from("BT_projects").select("*").eq("id", id).single(),
    supabase.from("BT_sections").select("*").eq("project_id", id).order("position"),
    supabase.from("BT_tasks").select("*, BT_attachments(*)").eq("project_id", id).order("position"),
    supabase.from("BT_column_configs").select("*").eq("project_id", id).order("position"),
  ]);

  const initialData: InitialProjectData = {
    project: pRes.data ?? null,
    sections: sRes.data ?? [],
    tasks: tRes.data ?? [],
    columnConfigs: cRes.data ?? [],
  };

  return (
    <div className="h-screen flex flex-col">
      <Suspense fallback={null}>
        <TaskList projectId={id} userEmail={user?.email} initialData={initialData} />
      </Suspense>
    </div>
  );
}
