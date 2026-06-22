import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth-server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id: projectId }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: rows } = await sb.from("BT_project_members").select("user_id").eq("project_id", projectId);
  if (!rows?.length) return NextResponse.json({ members: [] });

  const ids = rows.map(r => r.user_id);
  const results = await Promise.all(ids.map(id => sb.auth.admin.getUserById(id)));
  const members = results
    .filter(r => !r.error && r.data.user)
    .map(r => ({
      id: r.data.user!.id,
      email: r.data.user!.email ?? "",
      name: (r.data.user!.user_metadata?.name as string | undefined) ?? null,
    }));

  return NextResponse.json({ members });
}
