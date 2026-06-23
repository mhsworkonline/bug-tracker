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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && !(await canManage(user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = ["name", "description", "icon_bg", "is_active"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  const { data, error } = await sb().from("BT_projects").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
