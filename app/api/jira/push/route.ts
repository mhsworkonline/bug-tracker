import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

const PRIORITY_MAP: Record<string, string> = {
  critical: "Highest", high: "High", medium: "Medium", low: "Low",
};

function jiraError(json: Record<string, unknown>): string {
  const msgs = (json.errorMessages as string[] | undefined) ?? [];
  const errs = json.errors ? Object.values(json.errors as Record<string, string>) : [];
  return [...msgs, ...errs].join(" ") || "Jira returned an error.";
}

function buildDescription(description: string | null, attachments: { name: string; url: string }[]): unknown {
  const content: unknown[] = [];

  if (description) {
    content.push({ type: "paragraph", content: [{ type: "text", text: description }] });
  }

  if (attachments.length > 0) {
    content.push({ type: "paragraph", content: [{ type: "text", text: "Attachments:", marks: [{ type: "strong" }] }] });
    for (const a of attachments) {
      content.push({
        type: "paragraph",
        content: [{
          type: "text",
          text: a.name,
          marks: [{ type: "link", attrs: { href: a.url, title: a.name } }],
        }],
      });
    }
  }

  if (content.length === 0) return undefined;
  return { type: "doc", version: 1, content };
}

export async function POST(req: NextRequest) {
  const { task_ids, project_id } = await req.json();

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };

  // Only tasks with a Jira key that have been modified since last push
  let query = client
    .from("BT_tasks")
    .select("*, BT_attachments(name, url)")
    .not("jira_issue_key", "is", null);
  if (project_id)            query = query.eq("project_id", project_id);
  else if (task_ids?.length) query = query.in("id", task_ids);

  const { data: allTasks } = await query;
  if (!allTasks?.length) return NextResponse.json({ results: [], skipped: 0 });

  // Pre-fetch sections for label mapping
  const sectionIds = [...new Set(allTasks.map((t: { section_id: string | null }) => t.section_id).filter(Boolean))];
  const { data: sectionsData } = sectionIds.length
    ? await client.from("BT_sections").select("id, name").in("id", sectionIds)
    : { data: [] };
  const sectionMap: Record<string, string> = {};
  for (const s of sectionsData ?? []) sectionMap[s.id] = s.name.replace(/\s+/g, "_");

  // Filter to only tasks modified after last push (or never pushed)
  const tasks = allTasks.filter(t =>
    !t.jira_last_pushed_at || new Date(t.updated_at) > new Date(t.jira_last_pushed_at)
  );

  if (!tasks.length) return NextResponse.json({ results: [], skipped: allTasks.length, message: "All tasks are already up to date in Jira." });

  const results: { taskId: string; taskName: string; jiraKey: string; pushed?: boolean; skipped?: boolean; error?: string }[] = [];

  for (const task of tasks) {
    const key         = task.jira_issue_key as string;
    const attachments = (task.BT_attachments ?? []) as { name: string; url: string }[];

    const label = task.section_id ? sectionMap[task.section_id] : null;
    const fields: Record<string, unknown> = { summary: task.name };

    if (task.priority && PRIORITY_MAP[task.priority.toLowerCase()]) {
      fields.priority = { name: PRIORITY_MAP[task.priority.toLowerCase()] };
    }
    if (label) fields.labels = [label];

    const desc = buildDescription(task.description ?? null, attachments);
    if (desc) fields.description = desc;

    if (task.due_date) fields.duedate = task.due_date;

    try {
      const res = await fetch(`${base}/rest/api/3/issue/${key}`, {
        method: "PUT", headers, body: JSON.stringify({ fields }),
      });

      if (res.status === 204 || res.ok) {
        await client.from("BT_tasks").update({ jira_last_pushed_at: new Date().toISOString() }).eq("id", task.id);
        results.push({ taskId: task.id, taskName: task.name, jiraKey: key, pushed: true });
      } else {
        const json = await res.json();
        results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: jiraError(json) });
      }
    } catch {
      results.push({ taskId: task.id, taskName: task.name, jiraKey: key, error: "Network error" });
    }
  }

  return NextResponse.json({ results, skipped: allTasks.length - tasks.length });
}
