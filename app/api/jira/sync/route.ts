import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

const STATUS_MAP: Record<string, string> = {
  "to do":       "not_started",
  "open":        "not_started",
  "backlog":     "not_started",
  "in progress": "in_progress",
  "in review":   "in_progress",
  "review":      "in_progress",
  "blocked":     "blocked",
  "done":        "done",
  "closed":      "done",
  "resolved":    "done",
  "won't do":    "done",
};

const PRIORITY_MAP: Record<string, string> = {
  highest: "critical", high: "high", medium: "medium", low: "low", lowest: "low",
};

export async function POST(req: NextRequest) {
  const { task_ids, project_id } = await req.json();

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  let query = client.from("BT_tasks").select("id, name, jira_issue_key, status, priority, assignee, due_date").not("jira_issue_key", "is", null);
  if (project_id)            query = query.eq("project_id", project_id);
  else if (task_ids?.length) query = query.in("id", task_ids);

  const { data: tasks } = await query;
  if (!tasks?.length) return NextResponse.json({ error: "No Jira-linked tasks found." }, { status: 404 });

  const results: { taskId: string; taskName: string; jiraKey: string; updated?: boolean; error?: string }[] = [];

  for (const task of tasks) {
    const key = task.jira_issue_key as string;
    try {
      const res = await fetch(`${base}/rest/api/3/issue/${key}?fields=summary,status,priority,assignee,duedate,description,attachment`, { headers });
      if (!res.ok) { results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: `Jira ${res.status}` }); continue; }

      const issue = await res.json();
      const fields = issue.fields;

      // Task field updates
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const jiraStatus   = (fields.status?.name ?? "").toLowerCase();
      const jiraPriority = (fields.priority?.name ?? "").toLowerCase();
      const newStatus    = STATUS_MAP[jiraStatus];
      const newPriority  = PRIORITY_MAP[jiraPriority];
      const newName      = fields.summary as string | undefined;
      const newAssignee  = fields.assignee?.emailAddress as string | undefined;
      const newDue       = fields.duedate as string | undefined;

      if (newStatus)   updates.status   = newStatus;
      if (newPriority) updates.priority = newPriority;
      if (newName)     updates.name     = newName;
      if (newAssignee !== undefined) updates.assignee = newAssignee;
      if (newDue      !== undefined) updates.due_date = newDue;
      if (updates.status === "done") { updates.completed = true; updates.completed_at = new Date().toISOString(); }

      // Detect if anything actually changed compared to what we have
      const hasChanges =
        (newStatus   && newStatus   !== task.status)   ||
        (newPriority && newPriority !== task.priority) ||
        (newName     && newName     !== task.name)     ||
        (newAssignee !== undefined  && newAssignee !== task.assignee) ||
        (newDue      !== undefined  && newDue      !== task.due_date);

      if (hasChanges) updates.jira_has_updates = true;

      await client.from("BT_tasks").update(updates).eq("id", task.id);

      // Sync Jira attachments → BT_attachments
      const jiraAttachments = (fields.attachment ?? []) as {
        filename: string; content: string; mimeType: string; size: number;
      }[];

      if (jiraAttachments.length > 0) {
        // Get existing attachment names for this task to avoid duplicates
        const { data: existing } = await client
          .from("BT_attachments")
          .select("name")
          .eq("task_id", task.id);
        const existingNames = new Set((existing ?? []).map((a: { name: string }) => a.name));

        const toInsert = jiraAttachments
          .filter(a => !existingNames.has(a.filename))
          .map(a => ({
            task_id:   task.id,
            name:      a.filename,
            url:       a.content, // Jira content URL (requires Jira auth to open)
            file_type: a.mimeType,
            size:      a.size,
            uploaded_at: new Date().toISOString(),
          }));

        if (toInsert.length > 0) {
          await client.from("BT_attachments").insert(toInsert);
        }
      }

      results.push({ taskId: task.id, taskName: task.name, jiraKey: key, updated: true });
    } catch {
      results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: "Network error" });
    }
  }

  return NextResponse.json({ results });
}
