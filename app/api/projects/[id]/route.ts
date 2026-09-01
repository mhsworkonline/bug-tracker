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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && !(await canManage(user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only projects with no tasks can be deleted — checked server-side too, not just
  // disabled in the UI, since the delete itself cascades (sections, comments, activity
  // log, etc. all reference BT_projects with ON DELETE CASCADE).
  const { count, error: countError } = await sb()
    .from("BT_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .is("deleted_at", null);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count && count > 0)
    return NextResponse.json({ error: "Only projects with no tasks can be deleted" }, { status: 409 });

  const { error } = await sb().from("BT_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
