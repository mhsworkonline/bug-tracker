import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { jira_project_key } = await req.json();
  const client = sb();
  await client.from("BT_projects").update({ jira_project_key: jira_project_key ?? null }).eq("id", id);
  return NextResponse.json({ ok: true });
}
