"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Trash2, RefreshCw, ChevronDown, Search } from "lucide-react";

interface LogEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  user_email: string | null;
  action: string;
  meta: Record<string, string>;
  created_at: string;
}

interface Project { id: string; name: string; }

const ACTION_LABELS: Record<string, string> = {
  task_created:             "Task created",
  task_deleted:             "Task deleted",
  task_status_changed:      "Status changed",
  task_assignee_changed:    "Assignee changed",
  task_priority_changed:    "Priority changed",
  task_name_changed:        "Task renamed",
  task_due_date_changed:    "Due date changed",
  task_type_changed:        "Type changed",
  task_description_changed: "Description updated",
  section_created:          "Section created",
  section_deleted:          "Section deleted",
  member_added:             "Member added",
  member_removed:           "Member removed",
};

function formatAction(entry: LogEntry): string {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const m = entry.meta;
  if (entry.action === "task_status_changed")
    return `${label}: "${m.task_name}" — ${m.from} → ${m.to}`;
  if (entry.action === "task_assignee_changed")
    return `${label}: "${m.task_name}" → ${m.to || "unassigned"}`;
  if (entry.action === "task_priority_changed")
    return `${label}: "${m.task_name}" — ${m.from} → ${m.to}`;
  if (entry.action === "task_name_changed")
    return `${label}: "${m.task_name}" → "${m.to}"`;
  if (entry.action === "task_due_date_changed")
    return `${label}: "${m.task_name}" — ${m.from || "none"} → ${m.to || "none"}`;
  if (entry.action === "task_type_changed")
    return `${label}: "${m.task_name}" — ${m.from} → ${m.to}`;
  if (m.task_name)    return `${label}: "${m.task_name}"`;
  if (m.section_name) return `${label}: "${m.section_name}"`;
  if (m.email)        return `${label}: ${m.email}`;
  return label;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const PAGE_SIZE = 25;

export default function ActivityLogSection() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterProject, setFilterProject] = useState("");
  const [filterUser, setFilterUser]       = useState("");
  const [filterFrom, setFilterFrom]       = useState("");
  const [filterTo, setFilterTo]           = useState("");
  const [page, setPage]           = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [clearing, setClearing]   = useState(false);

  useEffect(() => {
    supabase.from("BT_projects").select("id, name").order("name")
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);

    let q = supabase
      .from("BT_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

    if (filterProject) q = q.eq("project_id", filterProject);
    if (filterUser)    q = q.ilike("user_email", `%${filterUser}%`);
    if (filterFrom)    q = q.gte("created_at", new Date(filterFrom).toISOString());
    if (filterTo) {
      const toEnd = new Date(filterTo);
      toEnd.setDate(toEnd.getDate() + 1); // start of next day = end of selected day in any timezone
      q = q.lt("created_at", toEnd.toISOString());
    }

    const { data } = await q;
    const rows = data ?? [];
    setHasMore(rows.length > PAGE_SIZE);
    setLogs(reset ? rows.slice(0, PAGE_SIZE) : prev => [...prev, ...rows.slice(0, PAGE_SIZE)]);
    setLoading(false);
  }, [page, filterProject, filterUser, filterFrom, filterTo]);

  // Initial load only — subsequent fetches are triggered by the Search button
  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteEntry = async (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    await supabase.from("BT_activity_logs").delete().eq("id", id);
  };

  const clearProject = async () => {
    if (!filterProject) return;
    setClearing(true);
    await supabase.from("BT_activity_logs").delete().eq("project_id", filterProject);
    await load(true);
    setClearing(false);
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? "—";

  return (
    <div className="bg-white border border-[#E8E8E9] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[#6B6F76]" />
          <h2 className="font-semibold text-[#151B26]">Activity Log</h2>
        </div>
        <button
          onClick={() => load(true)}
          className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm text-[#151B26] bg-white outline-none focus:border-[#4573D9]"
          >
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            type="text"
            placeholder="Filter by user email"
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm text-[#151B26] outline-none focus:border-[#4573D9]"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-[#6B6F76] whitespace-nowrap w-8">From</span>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm text-[#151B26] outline-none focus:border-[#4573D9]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-[#6B6F76] whitespace-nowrap w-4">To</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm text-[#151B26] outline-none focus:border-[#4573D9]"
            />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-60 whitespace-nowrap"
            >
              <Search size={13} /> Search
            </button>
            {filterProject && (
              <button
                onClick={clearProject}
                disabled={clearing}
                className="px-3 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap"
              >
                {clearing ? "Clearing…" : "Clear"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 && !loading ? (
        <p className="text-sm text-[#6B6F76] py-6 text-center">No activity yet.</p>
      ) : (
        <div className="border border-[#E8E8E9] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFBFC] border-b border-[#E8E8E9]">
                <th className="text-left px-3 py-2 text-[#6B6F76] font-medium hidden sm:table-cell">Time</th>
                <th className="text-left px-3 py-2 text-[#6B6F76] font-medium">Action</th>
                <th className="text-left px-3 py-2 text-[#6B6F76] font-medium hidden sm:table-cell">Project</th>
                <th className="text-left px-3 py-2 text-[#6B6F76] font-medium hidden sm:table-cell">User</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-[#E8E8E9] last:border-0 ${i % 2 === 0 ? "" : "bg-[#FAFBFC]"}`}>
                  <td className="px-3 py-2 text-[#6B6F76] whitespace-nowrap hidden sm:table-cell">{fmtDate(log.created_at)}</td>
                  <td className="px-3 py-2 text-[#151B26]">
                    {formatAction(log)}
                    <div className="sm:hidden text-xs text-[#6B6F76] mt-0.5">{fmtDate(log.created_at)} · {log.user_email ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-[#6B6F76] hidden sm:table-cell">{projectName(log.project_id)}</td>
                  <td className="px-3 py-2 text-[#6B6F76] hidden sm:table-cell">{log.user_email ?? "—"}</td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => deleteEntry(log.id)}
                      className="p-1 text-[#B0B3B8] hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => { setPage(p => p + 1); load(); }}
          className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] py-2 rounded"
        >
          <ChevronDown size={14} /> Load more
        </button>
      )}
    </div>
  );
}
