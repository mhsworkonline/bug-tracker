import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

// Resolves which Jira project (key + name) a bug-tracker project will export to
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const client = sb();
  const { data: setting } = await client.from("BT_settings").select("value").eq("key", "jira_config").single();
  if (!setting?.value) return NextResponse.json({ error: "Jira not configured. Go to Admin → Settings → Jira Integration." }, { status: 400 });

  const { domain, email, api_token } = setting.value as Record<string, string>;
  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  // The project must have its OWN key. There is deliberately no fallback to the global
  // default — that silently sent tasks into whichever project the default pointed at.
  const { data: proj } = await client.from("BT_projects").select("jira_project_key").eq("id", project_id).single();
  const key = (proj?.jira_project_key as string | null) || null;
  if (!key) {
    return NextResponse.json(
      { error: "This project has no Jira project key set. Set the key before exporting.", needsKey: true },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${base}/rest/api/3/project/${encodeURIComponent(key)}`, { headers });
    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ error: `Jira project "${key}" not found.`, needsKey: true }, { status: 404 });
      return NextResponse.json({ error: `Jira error ${res.status}` }, { status: res.status });
    }
    const json = await res.json();
    return NextResponse.json({ key, name: json.name as string });
  } catch {
    return NextResponse.json({ error: "Could not reach Jira." }, { status: 502 });
  }
}
