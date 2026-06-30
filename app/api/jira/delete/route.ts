import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { task_id } = await req.json();
  if (!task_id) return NextResponse.json({ error: "task_id required." }, { status: 400 });

  const client = sb();

  const { data: task } = await client.from("BT_tasks").select("id, name, jira_issue_key").eq("id", task_id).single();
  if (!task?.jira_issue_key) return NextResponse.json({ error: "This task has no linked Jira issue." }, { status: 404 });

  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");

  const key = task.jira_issue_key as string;

  const res = await fetch(`${base}/rest/api/3/issue/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  if (res.status === 204 || res.ok) {
    // Clear jira_issue_key from our task
    await client.from("BT_tasks").update({ jira_issue_key: null }).eq("id", task_id);
    return NextResponse.json({ ok: true, jiraKey: key });
  }

  // 403 = no delete permission in Jira; 404 = already deleted in Jira
  if (res.status === 404) {
    // Already gone from Jira — just clear our reference
    await client.from("BT_tasks").update({ jira_issue_key: null }).eq("id", task_id);
    return NextResponse.json({ ok: true, jiraKey: key, warning: "Issue was already deleted in Jira." });
  }

  if (res.status === 403) {
    return NextResponse.json({ error: "You don't have permission to delete issues in Jira. Ask your Jira admin to grant delete permissions." }, { status: 403 });
  }

  return NextResponse.json({ error: `Jira returned ${res.status}.` }, { status: 400 });
}
