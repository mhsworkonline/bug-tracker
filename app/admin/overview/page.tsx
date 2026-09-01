import { supabase } from "@/lib/supabase";
import AdminDashboardClient, { type AdminDashboardRaw } from "../AdminDashboardClient";

// This page has no cookies()/auth call of its own, so Next has no signal to render it
// per-request — without this it gets statically frozen to whatever the stats were at
// build time. Force it dynamic so every visit gets a fresh snapshot.
export const dynamic = "force-dynamic";

const sevenDaysAgoISO = () => new Date(Date.now() - 7 * 86400000).toISOString();

// Supabase/PostgREST caps a single select at 1000 rows by default — silently, no error,
// just a truncated result. This page's workspace-wide queries can each cross that on their
// own, so every stat downstream (totals, status breakdown, tasks-by-project, activity chart)
// was quietly undercounting. Pages through with `.range()` until a page comes back short.
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export default async function AdminDashboard() {
  const since = sevenDaysAgoISO();
  const [projects, tasks, logs] = await Promise.all([
    fetchAllRows<{ id: string; name: string; icon_bg: string }>((from, to) =>
      supabase.from("BT_projects").select("id, name, icon_bg").order("id").range(from, to)
    ),
    fetchAllRows<{ id: string; status: string | null; completed: boolean; due_date: string | null; project_id: string | null }>((from, to) =>
      supabase.from("BT_tasks").select("id, status, completed, due_date, project_id").is("deleted_at", null).order("id").range(from, to)
    ),
    fetchAllRows<{ created_at: string }>((from, to) =>
      // `created_at` alone isn't unique enough to guarantee stable page boundaries when
      // rows share a timestamp — `id` as a tiebreaker keeps paging from skipping/duplicating.
      supabase.from("BT_activity_logs").select("created_at").gte("created_at", since).order("created_at").order("id").range(from, to)
    ),
  ]);

  const raw: AdminDashboardRaw = { projects, tasks, logs };

  return <AdminDashboardClient raw={raw} />;
}
