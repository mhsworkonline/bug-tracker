import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth-server";
import { ADMIN_EMAIL } from "@/lib/constants";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action } = await req.json();
  if (action !== "approved" && action !== "rejected") return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const client = sb();
  const { data: req_, error: fetchErr } = await client.from("BT_assignment_requests").select("*").eq("id", id).single();
  if (fetchErr || !req_) return NextResponse.json({ error: "not found" }, { status: 404 });

  await client.from("BT_assignment_requests").update({ status: action }).eq("id", id);

  if (action === "approved") {
    await client.from("BT_tasks").update({ assignee: req_.assignee_email, updated_at: new Date().toISOString() }).eq("id", req_.task_id);
  }

  return NextResponse.json({ ok: true });
}
