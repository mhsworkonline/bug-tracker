import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth-server";
import { ADMIN_EMAIL } from "@/lib/constants";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = sb();

  const { data: src } = await client.from("BT_projects").select("*").eq("id", id).single();
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: newProject, error: pErr } = await client.from("BT_projects")
    .insert({ name: `${src.name} (copy)`, description: src.description, icon_bg: src.icon_bg, is_active: true })
    .select().single();
  if (pErr || !newProject) return NextResponse.json({ error: pErr?.message }, { status: 500 });

  const { data: sections } = await client.from("BT_sections").select("*").eq("project_id", id).order("position");
  const sectionMap: Record<string, string> = {};

  if (sections?.length) {
    for (const s of sections) {
      const { data: ns } = await client.from("BT_sections")
        .insert({ project_id: newProject.id, name: s.name, position: s.position }).select().single();
      if (ns) sectionMap[s.id] = ns.id;
    }
  }

  const { data: tasks } = await client.from("BT_tasks").select("*").eq("project_id", id).order("position");
  if (tasks?.length) {
    const newTasks = tasks.map(({ id: _id, created_at: _c, updated_at: _u, BT_attachments: _a, ...t }) => ({
      ...t,
      project_id: newProject.id,
      section_id: t.section_id ? (sectionMap[t.section_id] ?? null) : null,
      completed: false,
      completed_at: null,
    }));
    await client.from("BT_tasks").insert(newTasks);
  }

  const { data: cols } = await client.from("BT_column_configs").select("*").eq("project_id", id);
  if (cols?.length) {
    await client.from("BT_column_configs").insert(
      cols.map(({ id: _id, ...c }) => ({ ...c, project_id: newProject.id }))
    );
  }

  return NextResponse.json({ project: newProject });
}
