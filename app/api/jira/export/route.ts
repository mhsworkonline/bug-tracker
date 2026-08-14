import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

// Keys must match BT_tasks.priority values (see DEFAULT_PRIORITIES in lib/adminSettings.ts).
// "critical" is a legacy alias kept so older rows still map.
const PRIORITY_MAP: Record<string, string> = {
  show_stopper: "Highest", critical: "Highest", high: "High", medium: "Medium", low: "Low",
};

// Preferred Jira issue-type names per BT task_type, best first. Jira projects vary wildly in
// which types they define (many have no "Bug" at all), so we resolve against the types the
// target project actually exposes and fall back to "Task", present in virtually every project.
const TYPE_PREFERENCES: Record<string, string[]> = {
  bug:        ["Bug", "Defect", "Task"],
  ui_fix:     ["Bug", "Defect", "Task"],
  suggestion: ["Story", "Idea", "Suggestion", "Improvement", "Task"],
  feature:    ["Story", "Idea", "Task"],
  chore:      ["Task"],
  task:       ["Task"],
};

// Only these have a Jira counterpart. ready_for_qa / in_review / blocked exist only in
// this app, so we deliberately leave the Jira status alone for them — forcing them to
// "In Progress" would come back on the next sync and destroy the local distinction.
// "completed" is this app's terminal status (see COMPLETED_STATUSES in lib/data.ts) — it
// maps to Jira "Done" the same as the plain "done" status, so marking a task complete here
// pushes the same Jira state a manual "Done" transition would.
const STATUS_TO_JIRA: Record<string, string> = {
  not_started: "To Do",
  in_progress: "In Progress",
  done:        "Done",
  completed:   "Done",
};

// Jira rejects a summary longer than 255 chars, and rejects newlines in it.
const JIRA_SUMMARY_MAX = 255;
function toSummary(name: string): string {
  const oneLine = (name ?? "").replace(/\s*\n+\s*/g, " ").trim();
  return oneLine.length > JIRA_SUMMARY_MAX ? oneLine.slice(0, JIRA_SUMMARY_MAX - 1) + "…" : oneLine;
}

function jiraError(json: Record<string, unknown>): string {
  const msgs = (json.errorMessages as string[] | undefined) ?? [];
  const errs = json.errors ? Object.values(json.errors as Record<string, string>) : [];
  return [...msgs, ...errs].join(" ") || "Jira returned an error.";
}

function buildDescription(description: string | null, attachments: { name: string; url: string }[]): unknown {
  const content: unknown[] = [];
  if (description) content.push({ type: "paragraph", content: [{ type: "text", text: description }] });
  if (attachments.length > 0) {
    content.push({ type: "paragraph", content: [{ type: "text", text: "Attachments:", marks: [{ type: "strong" }] }] });
    for (const a of attachments) {
      content.push({ type: "paragraph", content: [{ type: "text", text: a.name, marks: [{ type: "link", attrs: { href: a.url, title: a.name } }] }] });
    }
  }
  return content.length ? { type: "doc", version: 1, content } : undefined;
}

// A create plus a status transition is several sequential Jira calls, so a whole project
// cannot be exported inside one serverless invocation. The route processes one batch and
// reports what is left; the client calls it repeatedly until `remaining` reaches 0.
export const maxDuration = 60;
const BATCH_SIZE = 10;

type Row = {
  taskId: string; taskName: string; jiraKey?: string; jiraUrl?: string;
  created?: boolean; updated?: boolean; unlinked?: boolean; degraded?: boolean;
  statusPushed?: string; error?: string;
};

export async function POST(req: NextRequest) {
  // `force` re-sends everything regardless of jira_last_pushed_at (admin repair tool).
  // `since` makes force terminate: each pushed task is stamped with a later time.
  const { task_ids, project_id, force, since } = await req.json();

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured. Go to Admin → Settings → Integrations." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };

  // A project must have its OWN Jira key. There is deliberately no fallback to the global
  // default — that silently dumped tasks into whichever project the default pointed at.
  const projectKeyCache: Record<string, string | null> = {};
  async function projectKey(pid: string): Promise<string | null> {
    if (pid in projectKeyCache) return projectKeyCache[pid];
    const { data } = await client.from("BT_projects").select("jira_project_key").eq("id", pid).single();
    const key = (data?.jira_project_key as string | null) || null;
    projectKeyCache[pid] = key;
    return key;
  }

  if (project_id && !(await projectKey(project_id))) {
    return NextResponse.json(
      { error: "This project has no Jira project key set. Set the key before exporting.", needsKey: true },
      { status: 400 },
    );
  }

  // Candidate tasks. Blank-named tasks are excluded: Jira rejects an empty summary, so they
  // would fail forever and stall the batch loop.
  let query = client
    .from("BT_tasks")
    .select("*, BT_attachments(name, url)")
    .not("name", "is", null)
    .neq("name", "");
  if (project_id)            query = query.eq("project_id", project_id).is("parent_task_id", null);
  else if (task_ids?.length) query = query.in("id", task_ids);
  else return NextResponse.json({ error: "No tasks selected." }, { status: 400 });

  const { data: allTasks } = await query.order("created_at");
  if (!allTasks?.length) return NextResponse.json({ results: [], pendingTotal: 0, remaining: 0, skipped: 0 });

  const needsUpdate = (t: Record<string, unknown>) => {
    const pushedAt = t.jira_last_pushed_at as string | null;
    if (force) return !pushedAt || !since || new Date(pushedAt) < new Date(since as string);
    if (!pushedAt) return true;
    if (new Date(t.updated_at as string) > new Date(pushedAt)) return true;
    // Status is transitioned separately, so a status change alone must also qualify.
    return !!STATUS_TO_JIRA[t.status as string] && t.status !== t.jira_pushed_status;
  };

  const pending = allTasks.filter(t => !t.jira_issue_key || needsUpdate(t));
  if (!pending.length) {
    return NextResponse.json({ results: [], pendingTotal: 0, remaining: 0, skipped: allTasks.length });
  }

  const tasks = pending.slice(0, BATCH_SIZE);

  // Section names become Jira labels; Jira labels cannot contain spaces.
  const sectionIds = [...new Set(tasks.map(t => t.section_id as string | null).filter(Boolean))];
  const { data: sectionsData } = sectionIds.length
    ? await client.from("BT_sections").select("id, name").in("id", sectionIds)
    : { data: [] };
  const sectionMap: Record<string, string> = {};
  for (const s of sectionsData ?? []) sectionMap[s.id] = s.name.replace(/\s+/g, "_");

  // Issue types the project actually accepts (subtask types need a parent, so exclude them).
  const issueTypeCache: Record<string, string[]> = {};
  async function issueTypes(key: string): Promise<string[]> {
    if (issueTypeCache[key]) return issueTypeCache[key];
    let names: string[] = [];
    try {
      const res = await fetch(`${base}/rest/api/3/project/${encodeURIComponent(key)}`, { headers });
      if (res.ok) {
        names = (((await res.json()).issueTypes ?? []) as { name: string; subtask?: boolean }[])
          .filter(t => !t.subtask).map(t => t.name);
      }
    } catch { /* empty -> falls back to "Task" below */ }
    issueTypeCache[key] = names;
    return names;
  }

  async function resolveIssueType(key: string, taskType: string | null): Promise<string> {
    const available = await issueTypes(key);
    const prefs = TYPE_PREFERENCES[(taskType ?? "task").toLowerCase()] ?? ["Task"];
    const hit = prefs.find(p => available.some(a => a.toLowerCase() === p.toLowerCase()));
    if (hit) return available.find(a => a.toLowerCase() === hit.toLowerCase())!;
    return available.find(a => a.toLowerCase() === "task") ?? "Task";
  }

  // Move the Jira issue to the mapped status. Jira will not accept `status` as a normal
  // field — it has to go through the transitions endpoint.
  async function transitionTo(issueKey: string, target: string): Promise<boolean> {
    try {
      const listRes = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, { headers });
      if (!listRes.ok) return false;
      const transitions = ((await listRes.json()).transitions ?? []) as { id: string; name: string; to?: { name?: string } }[];
      const match =
        transitions.find(tr => tr.to?.name?.toLowerCase() === target.toLowerCase()) ??
        transitions.find(tr => tr.name?.toLowerCase() === target.toLowerCase());
      if (!match) return false; // already there, or workflow disallows it
      const res = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, {
        method: "POST", headers, body: JSON.stringify({ transition: { id: match.id } }),
      });
      return res.status === 204 || res.ok;
    } catch { return false; }
  }

  const results: Row[] = [];

  for (const task of tasks) {
    const key = await projectKey(task.project_id);
    if (!key) {
      results.push({ taskId: task.id, taskName: task.name, error: "Project has no Jira project key set" });
      continue;
    }

    const attachments = (task.BT_attachments ?? []) as { name: string; url: string }[];
    const label       = task.section_id ? sectionMap[task.section_id] : null;
    const priority    = PRIORITY_MAP[(task.priority ?? "").toLowerCase()] ?? "Medium";
    const desc        = buildDescription(task.description ?? null, attachments);
    const now         = () => new Date().toISOString();

    try {
      let issueKey = task.jira_issue_key as string | null;
      let created = false, updatedOk = false, degraded = false;

      if (!issueKey) {
        // ---- create ----
        const issuetype = await resolveIssueType(key, task.task_type);
        const fields: Record<string, unknown> = {
          project:   { key },
          summary:   toSummary(task.name),
          issuetype: { name: issuetype },
          priority:  { name: priority },
          ...(label ? { labels: [label] } : {}),
        };
        if (desc) fields.description = desc;
        if (task.due_date) fields.duedate = task.due_date;

        let res = await fetch(`${base}/rest/api/3/issue`, { method: "POST", headers, body: JSON.stringify({ fields }) });
        let json = await res.json();

        if (!res.ok) {
          // Retry with the safest minimum. Anything Jira refused (custom required fields,
          // an unavailable priority) is dropped, so flag the result as degraded.
          const minimal = { project: { key }, summary: toSummary(task.name), issuetype: { name: "Task" } };
          const retry = await fetch(`${base}/rest/api/3/issue`, { method: "POST", headers, body: JSON.stringify({ fields: minimal }) });
          const retryJson = await retry.json();
          if (!retry.ok) {
            results.push({ taskId: task.id, taskName: task.name, error: jiraError(json) });
            continue;
          }
          res = retry; json = retryJson; degraded = true;
        }
        issueKey = json.key as string;
        created = true;
      } else {
        // ---- update ----
        const fields: Record<string, unknown> = { summary: toSummary(task.name) };
        if (PRIORITY_MAP[(task.priority ?? "").toLowerCase()]) fields.priority = { name: priority };
        if (label) fields.labels = [label];
        if (desc) fields.description = desc;
        if (task.due_date) fields.duedate = task.due_date;

        const res = await fetch(`${base}/rest/api/3/issue/${issueKey}`, { method: "PUT", headers, body: JSON.stringify({ fields }) });
        if (res.status === 404) {
          // Deleted in Jira. Drop the stale link so it stops being retried forever.
          await client.from("BT_tasks")
            .update({ jira_issue_key: null, jira_last_pushed_at: null, jira_remote_updated_at: null, jira_pushed_status: null })
            .eq("id", task.id);
          results.push({ taskId: task.id, taskName: task.name, jiraKey: issueKey, unlinked: true, error: `${issueKey} no longer exists in Jira — link removed` });
          continue;
        }
        if (!(res.status === 204 || res.ok)) {
          results.push({ taskId: task.id, taskName: task.name, jiraKey: issueKey, error: jiraError(await res.json().catch(() => ({}))) });
          continue;
        }
        updatedOk = true;
      }

      // ---- status transition ----
      const target = STATUS_TO_JIRA[task.status as string];
      let statusPushed: string | undefined;
      if (target && task.status !== task.jira_pushed_status) {
        if (await transitionTo(issueKey!, target)) statusPushed = target;
      }

      const patch: Record<string, unknown> = {
        jira_issue_key: issueKey,
        jira_last_pushed_at: now(),
        // Our own write must not look like a remote change on the next sync.
        jira_remote_updated_at: now(),
      };
      // Only record the status once Jira actually accepted it, so a failed transition is retried.
      if (statusPushed) patch.jira_pushed_status = task.status;
      await client.from("BT_tasks").update(patch).eq("id", task.id);

      results.push({
        taskId: task.id, taskName: task.name, jiraKey: issueKey!, jiraUrl: `${base}/browse/${issueKey}`,
        created, updated: updatedOk, degraded, statusPushed,
      });
    } catch {
      results.push({ taskId: task.id, taskName: task.name, error: "Network error" });
    }
  }

  // Unlinked tasks also leave the pending set, so they count as progress — otherwise a batch
  // of deleted issues looks like zero progress and stalls the client loop.
  const resolved = results.filter(r => r.created || r.updated || r.unlinked).length;
  return NextResponse.json({
    results,
    pendingTotal: pending.length,
    remaining: Math.max(0, pending.length - resolved),
    skipped: allTasks.length - pending.length,
  });
}
