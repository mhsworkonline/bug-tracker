import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth-server";
import { ADMIN_EMAIL } from "@/lib/constants";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

async function canManage(userId: string, projectId: string) {
  const { data } = await sb().from("BT_project_members")
    .select("role").eq("user_id", userId).eq("project_id", projectId).single();
  return data?.role === "lead";
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id: projectId }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = sb();
  const { data: rows } = await client.from("BT_project_members")
    .select("user_id, role").eq("project_id", projectId);
  if (!rows?.length) return NextResponse.json({ members: [] });

  const results = await Promise.all(rows.map(r => client.auth.admin.getUserById(r.user_id)));
  const members = results
    .map((r, i) => {
      if (r.error || !r.data.user) return null;
      const u = r.data.user;
      return {
        id: u.id,
        email: u.email ?? "",
        name: (u.user_metadata?.name as string | undefined) ?? null,
        role: rows[i].role as "lead" | "member",
      };
    })
    .filter(Boolean);

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id: projectId }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && !(await canManage(user.id, projectId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, role = "member" } = await req.json();
  const client = sb();

  const { data: existing } = await client.from("BT_project_members")
    .select("id").eq("project_id", projectId).eq("user_id", user_id).single();

  if (existing) {
    await client.from("BT_project_members").update({ role }).eq("id", existing.id);
  } else {
    await client.from("BT_project_members").insert({ project_id: projectId, user_id, role });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id: projectId }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && !(await canManage(user.id, projectId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id } = await req.json();
  await sb().from("BT_project_members").delete().eq("project_id", projectId).eq("user_id", user_id);
  return NextResponse.json({ ok: true });
}
