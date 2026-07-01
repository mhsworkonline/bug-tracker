import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/constants";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const client = sb();
  const isAdmin = email === ADMIN_EMAIL;

  let projectIds: string[] | null = null;

  if (!isAdmin) {
    // Look up the user's auth UUID, then find their project memberships
    const { data: { users } } = await client.auth.admin.listUsers();
    const user = users.find(u => u.email === email);
    if (!user) return NextResponse.json({ projects: [], sections: [] });

    const { data: memberships } = await client
      .from("BT_project_members")
      .select("project_id")
      .eq("user_id", user.id);

    projectIds = (memberships ?? []).map((m: { project_id: string }) => m.project_id);
    if (!projectIds.length) return NextResponse.json({ projects: [], sections: [] });
  }

  let projectQuery = client.from("BT_projects").select("id, name");
  if (projectIds) projectQuery = projectQuery.in("id", projectIds);
  const { data: projects } = await projectQuery.order("name");

  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  const { data: sections } = await client
    .from("BT_sections")
    .select("id, project_id, name, position")
    .in("project_id", ids)
    .order("position");

  return NextResponse.json({ projects: projects ?? [], sections: sections ?? [] });
}
