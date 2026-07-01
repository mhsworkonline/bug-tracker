import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

const PRIORITY_MAP: Record<string, string> = {
  critical: "Highest", high: "High", medium: "Medium", low: "Low",
};
const TYPE_MAP: Record<string, string> = {
  bug: "Bug", feature: "Story", task: "Task", chore: "Task",
};

function jiraError(json: Record<string, unknown>): string {
  // Jira returns errors in errorMessages (array) and errors (object)
  const msgs = (json.errorMessages as string[] | undefined) ?? [];
  const errs = json.errors ? Object.values(json.errors as Record<string, string>) : [];
  return [...msgs, ...errs].join(" ") || "Jira returned an error.";
}

async function tryCreate(
  base: string, headers: Record<string, string>, fields: Record<string, unknown>
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const res = await fetch(`${base}/rest/api/3/issue`, {
    method: "POST", headers, body: JSON.stringify({ fields }),
  });
  const json = await res.json();
  if (res.ok) return { ok: true, key: json.key };
  return { ok: false, error: jiraError(json) };
}

export async function POST(req: NextRequest) {
  const { task_ids, project_id } = await req.json();

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured. Go to Admin → Settings → Jira Integration." }, { status: 400 });

  const { domain, email, api_token, project_key: globalKey } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };

  // Resolve task IDs
  let ids: string[] = task_ids ?? [];
  if (project_id && !ids.length) {
    const { data: projectTasks } = await client.from("BT_tasks").select("id").eq("project_id", project_id).is("parent_task_id", null);
    ids = (projectTasks ?? []).map((t: { id: string }) => t.id);
  }
  if (!ids.length) return NextResponse.json({ error: "No tasks found." }, { status: 400 });

  const { data: tasks } = await client.from("BT_tasks").select("*, BT_attachments(name, url)").in("id", ids);
  if (!tasks?.length) return NextResponse.json({ error: "Tasks not found." }, { status: 404 });

  // Cache project jira keys to avoid repeated DB calls
  const projectKeyCache: Record<string, string> = {};
  async function resolveProjectKey(pid: string): Promise<string> {
    if (projectKeyCache[pid]) return projectKeyCache[pid];
    const { data } = await client.from("BT_projects").select("jira_project_key").eq("id", pid).single();
    const key = (data?.jira_project_key as string | null) || globalKey;
    projectKeyCache[pid] = key;
    return key;
  }

  const results: { taskId: string; taskName: string; jiraKey?: string; jiraUrl?: string; error?: string }[] = [];

  for (const task of tasks) {
    if (task.jira_issue_key) {
      results.push({ taskId: task.id, taskName: task.name, jiraKey: task.jira_issue_key, jiraUrl: `${base}/browse/${task.jira_issue_key}` });
      continue;
    }

    const project_key = await resolveProjectKey(task.project_id);

    try {
      const issuetype = TYPE_MAP[task.task_type?.toLowerCase()] ?? "Task";
      const priority  = PRIORITY_MAP[task.priority?.toLowerCase()] ?? "Medium";

      // Full fields attempt
      const fullFields: Record<string, unknown> = {
        project:   { key: project_key },
        summary:   task.name,
        issuetype: { name: issuetype },
        priority:  { name: priority },
      };
      const attachments = (task.BT_attachments ?? []) as { name: string; url: string }[];
      const descContent: unknown[] = [];
      if (task.description) descContent.push({ type: "paragraph", content: [{ type: "text", text: task.description }] });
      if (attachments.length > 0) {
        descContent.push({ type: "paragraph", content: [{ type: "text", text: "Attachments:", marks: [{ type: "strong" }] }] });
        for (const a of attachments) descContent.push({ type: "paragraph", content: [{ type: "text", text: a.name, marks: [{ type: "link", attrs: { href: a.url, title: a.name } }] }] });
      }
      if (descContent.length > 0) fullFields.description = { type: "doc", version: 1, content: descContent };
      if (task.due_date) fullFields.duedate = task.due_date;

      let result = await tryCreate(base, headers, fullFields);

      // If full attempt fails, retry with just summary + issuetype (safest minimum)
      if (!result.ok) {
        const minFields: Record<string, unknown> = {
          project:   { key: project_key },
          summary:   task.name,
          issuetype: { name: "Task" }, // always falls back to "Task"
        };
        const retry = await tryCreate(base, headers, minFields);
        if (retry.ok) {
          result = retry;
        } else {
          // Return the original error (more descriptive) not the fallback error
          results.push({ taskId: task.id, taskName: task.name, error: result.error });
          continue;
        }
      }

      const now = new Date().toISOString();
      await client.from("BT_tasks").update({ jira_issue_key: result.key, jira_last_pushed_at: now }).eq("id", task.id);
      results.push({ taskId: task.id, taskName: task.name, jiraKey: result.key, jiraUrl: `${base}/browse/${result.key}` });
    } catch {
      results.push({ taskId: task.id, taskName: task.name, error: "Network error" });
    }
  }

  return NextResponse.json({ results });
}
