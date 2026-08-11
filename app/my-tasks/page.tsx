import { getUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MyTasksClient, { type MyTask } from "./MyTasksClient";

export default async function MyTasksPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const userEmail = user.email ?? "";

  // Same two-step lookup MyTasksClient used to do client-side after mount — run it
  // here so the page ships with the list already populated instead of a fetch-on-load spinner.
  const { data: taskRows } = await supabase
    .from("BT_tasks")
    .select("id, name, status, priority, due_date, completed, project_id")
    .eq("assignee", userEmail)
    .order("due_date", { ascending: true, nullsFirst: false });

  let initialTasks: MyTask[] = [];
  if (taskRows?.length) {
    const projectIds = [...new Set(taskRows.map(t => t.project_id))];
    const { data: projects } = await supabase
      .from("BT_projects")
      .select("id, name, icon_bg")
      .in("id", projectIds);
    const pMap: Record<string, { name: string; icon_bg: string }> = {};
    for (const p of projects ?? []) pMap[p.id] = { name: p.name, icon_bg: p.icon_bg };
    initialTasks = taskRows.map(t => ({
      ...t,
      project_name:  pMap[t.project_id]?.name  ?? "Unknown",
      project_color: pMap[t.project_id]?.icon_bg ?? "#6B6F76",
    }));
  }

  return <MyTasksClient userEmail={userEmail} initialTasks={initialTasks} />;
}
