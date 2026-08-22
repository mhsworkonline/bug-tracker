import { supabase } from "@/lib/supabase";
import AdminDashboardClient, { type AdminDashboardRaw } from "../AdminDashboardClient";

// This page has no cookies()/auth call of its own, so Next has no signal to render it
// per-request — without this it gets statically frozen to whatever the stats were at
// build time. Force it dynamic so every visit gets a fresh snapshot.
export const dynamic = "force-dynamic";

const sevenDaysAgoISO = () => new Date(Date.now() - 7 * 86400000).toISOString();

export default async function AdminDashboard() {
  const [projRes, taskRes, logRes] = await Promise.all([
    supabase.from("BT_projects").select("id, name"),
    supabase.from("BT_tasks").select("id, status, completed, due_date, project_id").is("deleted_at", null),
    supabase.from("BT_activity_logs")
      .select("created_at")
      .gte("created_at", sevenDaysAgoISO())
      .order("created_at"),
  ]);

  const raw: AdminDashboardRaw = {
    projects: projRes.data ?? [],
    tasks: taskRes.data ?? [],
    logs: logRes.data ?? [],
  };

  return <AdminDashboardClient raw={raw} />;
}
