import { supabase } from "@/lib/supabase";

export async function notify(userEmail: string, type: string, title: string, body?: string, projectId?: string, taskId?: string) {
  if (!userEmail) return;
  supabase.from("BT_notifications").insert({ user_email: userEmail, type, title, body: body ?? null, project_id: projectId ?? null, task_id: taskId ?? null }).then(() => {});
}
