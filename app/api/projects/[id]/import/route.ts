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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else cur += ch;
    }
    vals.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").replace(/^"|"$/g, "")]));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id: projectId }] = await Promise.all([getUser(), params]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin && !(await canManage(user.id, projectId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, content } = await req.json() as { type: "csv" | "json"; content: string };
  const client = sb();

  const { data: existingSections } = await client.from("BT_sections").select("*").eq("project_id", projectId);
  const sectionByName: Record<string, string> = {};
  for (const s of existingSections ?? []) sectionByName[s.name.toLowerCase()] = s.id;

  const getOrCreateSection = async (name: string): Promise<string | null> => {
    if (!name) return null;
    const key = name.toLowerCase();
    if (sectionByName[key]) return sectionByName[key];
    const pos = Object.keys(sectionByName).length;
    const { data } = await client.from("BT_sections").insert({ project_id: projectId, name, position: pos }).select().single();
    if (data) { sectionByName[key] = data.id; return data.id; }
    return null;
  };

  let rows: Array<{ name: string; section?: string; status?: string; priority?: string; assignee?: string; due_date?: string; description?: string; task_type?: string }> = [];

  if (type === "json") {
    const parsed = JSON.parse(content) as { tasks?: Array<Record<string, unknown>>; sections?: Array<{ id: string; name: string }> };
    const secMap: Record<string, string> = {};
    for (const s of parsed.sections ?? []) secMap[s.id] = s.name;
    rows = (parsed.tasks ?? []).map(t => ({
      name: String(t.name ?? ""),
      section: t.section_id ? secMap[String(t.section_id)] : undefined,
      status: t.status as string,
      priority: t.priority as string,
      assignee: t.assignee as string,
      due_date: t.due_date as string,
      description: t.description as string,
      task_type: t.task_type as string,
    }));
  } else {
    const parsed = parseCSV(content);
    rows = parsed.map(r => ({
      name: r["Task Name"] ?? "",
      section: r["Section"],
      status: r["Status"],
      priority: r["Priority"],
      assignee: r["Assignee"],
      due_date: r["Due Date"],
      description: r["Description"],
      task_type: r["Task Type"],
    }));
  }

  const { data: existingTasks } = await client.from("BT_tasks").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1);
  let pos = (existingTasks?.[0]?.position ?? -1) + 1;

  const STATUS_MAP: Record<string, string> = { "Not Started": "not_started", "In Progress": "in_progress", "Ready for QA": "ready_for_qa", "In Review": "in_review", "Done": "done", "Blocked": "blocked" };
  const PRIORITY_MAP: Record<string, string> = { "Show Stopper": "show_stopper", "High": "high", "Medium": "medium", "Low": "low" };

  let imported = 0;
  for (const row of rows) {
    if (!row.name?.trim()) continue;
    const section_id = await getOrCreateSection(row.section ?? "");
    await client.from("BT_tasks").insert({
      project_id: projectId,
      section_id,
      name: row.name.trim(),
      status: STATUS_MAP[row.status ?? ""] ?? "not_started",
      priority: PRIORITY_MAP[row.priority ?? ""] ?? "high",
      task_type: row.task_type?.toLowerCase() ?? "bug",
      assignee: row.assignee || null,
      due_date: row.due_date || null,
      description: row.description || null,
      position: pos++,
      completed: false,
    });
    imported++;
  }

  return NextResponse.json({ imported });
}
