import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COMPLETED_STATUSES, type TaskStatus } from "@/lib/data";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

// Values must match BT_tasks.status values (see DEFAULT_STATUSES in lib/adminSettings.ts).
const STATUS_MAP: Record<string, string> = {
  "to do":        "not_started",
  "open":         "not_started",
  "backlog":      "not_started",
  "in progress":  "in_progress",
  "ready for qa": "ready_for_qa",
  "qa":           "ready_for_qa",
  "in review":    "in_review",
  "review":       "in_review",
  "blocked":      "blocked",
  // "Completed" is this app's one terminal status — the only one that carries the
  // completed/strikethrough treatment (see COMPLETED_STATUSES in lib/data.ts) and
  // gets hidden from views by default. Every Jira "finished" state maps to it
  // directly, so a synced issue lands in the same state a manual "Mark complete"
  // would produce, instead of the separate "done" status.
  "done":         "completed",
  "closed":       "completed",
  "resolved":     "completed",
  "won't do":     "completed",
};

// Values must match BT_tasks.priority values (see DEFAULT_PRIORITIES in lib/adminSettings.ts).
const PRIORITY_MAP: Record<string, string> = {
  highest: "show_stopper", high: "high", medium: "medium", low: "low", lowest: "low",
};

// These exist only in this app — Jira has no equivalent, so it always reports something else
// (usually "To Do" or "In Progress"). Overwriting them would silently wipe the distinction
// every time someone syncs, so a task sitting in one of these keeps its local status.
const LOCAL_ONLY_STATUSES = new Set(["ready_for_qa", "in_review", "blocked"]);

// One GET per issue, so a whole project cannot be synced in a single serverless invocation.
// Unchanged tasks are not written, so they never leave the candidate set — this route pages
// by offset rather than by "what is left to do".
export const maxDuration = 60;
const BATCH_SIZE = 20;

export async function POST(req: NextRequest) {
  const { task_ids, project_id, offset = 0 } = await req.json();

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  let query = client
    .from("BT_tasks")
    .select("id, name, jira_issue_key, jira_remote_updated_at, status, priority, assignee, due_date", { count: "exact" })
    .not("jira_issue_key", "is", null);
  if (project_id)            query = query.eq("project_id", project_id);
  else if (task_ids?.length) query = query.in("id", task_ids);

  const { data: tasks, count: total } = await query.order("created_at").range(offset, offset + BATCH_SIZE - 1);

  if (!tasks?.length) {
    if (offset === 0) return NextResponse.json({ error: "No Jira-linked tasks found. Export to Jira first." }, { status: 404 });
    return NextResponse.json({ results: [], total: total ?? 0, nextOffset: null });
  }

  const results: { taskId: string; taskName: string; jiraKey: string; updated?: boolean; checked?: boolean; unlinked?: boolean; error?: string }[] = [];

  for (const task of tasks) {
    const key = task.jira_issue_key as string;
    try {
      const res = await fetch(`${base}/rest/api/3/issue/${key}?fields=summary,status,priority,assignee,duedate,description,attachment,updated`, { headers });

      if (res.status === 404) {
        await client.from("BT_tasks")
          .update({ jira_issue_key: null, jira_last_pushed_at: null, jira_remote_updated_at: null, jira_pushed_status: null })
          .eq("id", task.id);
        results.push({ taskId: task.id, taskName: task.name, jiraKey: key, unlinked: true, error: `${key} no longer exists in Jira — link removed` });
        continue;
      }
      if (!res.ok) { results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: `Jira ${res.status}` }); continue; }

      const fields = (await res.json()).fields;
      const remoteUpdated = fields.updated as string | undefined;
      const seen = task.jira_remote_updated_at as string | null;

      // Skip untouched issues. This is what stops a sync from clobbering local edits with
      // stale Jira values, and stops our own export from looking like a remote change.
      if (remoteUpdated && seen && new Date(remoteUpdated) <= new Date(seen)) {
        results.push({ taskId: task.id, taskName: task.name, jiraKey: key, updated: false, checked: true });
        continue;
      }

      const updates: Record<string, unknown> = {};
      const newStatus   = STATUS_MAP[(fields.status?.name ?? "").toLowerCase()];
      const newPriority = PRIORITY_MAP[(fields.priority?.name ?? "").toLowerCase()];
      const newName     = fields.summary as string | undefined;
      const newAssignee = fields.assignee?.emailAddress as string | undefined;
      const newDue      = fields.duedate as string | undefined;

      // A task parked in a local-only status keeps it; Jira cannot represent those.
      const statusLocked = LOCAL_ONLY_STATUSES.has(task.status as string);
      if (newStatus && !statusLocked) updates.status = newStatus;
      if (newPriority) updates.priority = newPriority;
      if (newName)     updates.name     = newName;
      if (newAssignee !== undefined) updates.assignee = newAssignee;
      if (newDue      !== undefined) updates.due_date = newDue;
      // Keep `completed` in sync with status here too, the same rule useProject's
      // updateTask applies client-side — one definition of "complete" (COMPLETED_STATUSES),
      // not a Jira-specific copy of it.
      if (updates.status !== undefined && updates.status !== task.status) {
        const nowComplete = COMPLETED_STATUSES.includes(updates.status as TaskStatus);
        updates.completed = nowComplete;
        updates.completed_at = nowComplete ? new Date().toISOString() : null;
      }

      const hasChanges =
        (updates.status   !== undefined && updates.status   !== task.status)   ||
        (updates.priority !== undefined && updates.priority !== task.priority) ||
        (updates.name     !== undefined && updates.name     !== task.name)     ||
        (updates.assignee !== undefined && updates.assignee !== task.assignee) ||
        (updates.due_date !== undefined && updates.due_date !== task.due_date);

      if (hasChanges) {
        const now = new Date().toISOString();
        updates.jira_has_updates = true;
        updates.updated_at = now;
        // Our copy now matches Jira, so there is nothing to push back.
        updates.jira_last_pushed_at = now;
        if (updates.status) updates.jira_pushed_status = updates.status;
      }
      // Always advance the watermark, so an unchanged issue is skipped cheaply next time.
      if (remoteUpdated) updates.jira_remote_updated_at = remoteUpdated;

      if (Object.keys(updates).length) await client.from("BT_tasks").update(updates).eq("id", task.id);

      // Pull Jira's own attachments across, matching on filename to avoid duplicates.
      const jiraAttachments = (fields.attachment ?? []) as { filename: string; content: string; mimeType: string; size: number }[];
      if (jiraAttachments.length > 0) {
        const { data: existing } = await client.from("BT_attachments").select("name").eq("task_id", task.id);
        const existingNames = new Set((existing ?? []).map((a: { name: string }) => a.name));
        const toInsert = jiraAttachments
          .filter(a => !existingNames.has(a.filename))
          .map(a => ({
            task_id: task.id, name: a.filename,
            url: a.content, // Jira content URL — needs a Jira login to open
            file_type: a.mimeType, size: a.size, uploaded_at: new Date().toISOString(),
          }));
        if (toInsert.length) await client.from("BT_attachments").insert(toInsert);
      }

      results.push({ taskId: task.id, taskName: task.name, jiraKey: key, updated: !!hasChanges, checked: true });
    } catch {
      results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: "Network error" });
    }
  }

  const nextOffset = offset + tasks.length;
  return NextResponse.json({
    results,
    total: total ?? 0,
    nextOffset: nextOffset < (total ?? 0) ? nextOffset : null,
  });
}
