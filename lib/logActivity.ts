import { supabase } from "@/lib/supabase";

export type ActivityAction =
  | "task_created"
  | "task_deleted"
  | "task_status_changed"
  | "task_assignee_changed"
  | "task_priority_changed"
  | "task_name_changed"
  | "task_due_date_changed"
  | "task_type_changed"
  | "task_description_changed"
  | "section_created"
  | "section_deleted"
  | "member_added"
  | "member_removed";

export interface ActivityMeta {
  task_name?:    string;
  section_name?: string;
  from?:         string;
  to?:           string;
  email?:        string;
}

export function logActivity(
  projectId: string,
  action: ActivityAction,
  meta: ActivityMeta = {},
  taskId?: string,
  userEmail?: string,
) {
  // Fire-and-forget — never block mutations on logging
  supabase.from("BT_activity_logs").insert({
    project_id: projectId,
    task_id:    taskId ?? null,
    user_email: userEmail ?? null,
    action,
    meta,
  }).then(() => {});
}
