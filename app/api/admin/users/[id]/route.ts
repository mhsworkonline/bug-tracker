import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth-server";
import { ADMIN_EMAIL } from "@/lib/constants";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = adminClient();
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const sb = adminClient();

  const update: { user_metadata?: { name: string }; email?: string; password?: string } = {};
  if (body.name !== undefined) update.user_metadata = { name: body.name };
  if (body.email !== undefined) update.email = body.email;
  if (body.password) update.password = body.password;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { error } = await sb.auth.admin.updateUserById(id, update);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
