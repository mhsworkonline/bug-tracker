"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FolderOpen, Settings, Activity, TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";

interface StatsData {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  tasksByProject: { name: string; tasks: number }[];
  activityByDay: { day: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  done:        "#14A454",
  in_progress: "#4573D9",
  not_started: "#B0B3B8",
  blocked:     "#EF4444",
  review:      "#F59E0B",
};

const NAV_CARDS = [
  {
    href:    "/projects",
    icon:    FolderOpen,
    label:   "Projects",
    desc:    "View and manage all projects",
    color:   "#4573D9",
    bg:      "#EEF2FB",
  },
  {
    href:    "/admin/settings",
    icon:    Settings,
    label:   "Settings",
    desc:    "Statuses, priorities, storage & more",
    color:   "#6B6F76",
    bg:      "#F5F5F5",
  },
  {
    href:    "/admin/activity",
    icon:    Activity,
    label:   "Activity Log",
    desc:    "All project activity across the workspace",
    color:   "#8B5CF6",
    bg:      "#F3F0FF",
  },
];

export default function AdminDashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, logRes] = await Promise.all([
        supabase.from("BT_projects").select("id, name"),
        supabase.from("BT_tasks").select("id, status, completed, due_date, project_id"),
        supabase.from("BT_activity_logs")
          .select("created_at")
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .order("created_at"),
      ]);

      const projects = projRes.data ?? [];
      const tasks    = taskRes.data ?? [];
      const logs     = logRes.data ?? [];

      const now = new Date();
      const completedTasks = tasks.filter(t => t.completed).length;
      const overdueTasks   = tasks.filter(t =>
        !t.completed && t.due_date && new Date(t.due_date) < now
      ).length;

      // Status breakdown
      const statusMap: Record<string, number> = {};
      for (const t of tasks) {
        const s = t.status ?? "not_started";
        statusMap[s] = (statusMap[s] ?? 0) + 1;
      }
      const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value,
        color: STATUS_COLORS[name] ?? "#B0B3B8",
      }));

      // Tasks by project (top 6)
      const projTaskMap: Record<string, { name: string; count: number }> = {};
      for (const p of projects) projTaskMap[p.id] = { name: p.name, count: 0 };
      for (const t of tasks) {
        if (t.project_id && projTaskMap[t.project_id])
          projTaskMap[t.project_id].count++;
      }
      const tasksByProject = Object.values(projTaskMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map(p => ({ name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name, tasks: p.count }));

      // Activity by day (last 7 days)
      const dayMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dayMap[d.toLocaleDateString("en-US", { weekday: "short" })] = 0;
      }
      for (const l of logs) {
        const day = new Date(l.created_at).toLocaleDateString("en-US", { weekday: "short" });
        if (day in dayMap) dayMap[day]++;
      }
      const activityByDay = Object.entries(dayMap).map(([day, count]) => ({ day, count }));

      setData({
        totalProjects: projects.length,
        totalTasks: tasks.length,
        completedTasks,
        overdueTasks,
        statusBreakdown,
        tasksByProject,
        activityByDay,
      });
      setLoading(false);
    }
    load();
  }, []);

  const pct = data && data.totalTasks > 0
    ? Math.round((data.completedTasks / data.totalTasks) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <AdminHeader />
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3">
        <h1 className="text-base font-semibold text-[#151B26]">Admin Dashboard</h1>
        <p className="text-xs text-[#6B6F76]">Workspace overview</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">

        {/* Nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {NAV_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="bg-white border border-[#E8E8E9] rounded-xl p-5 flex items-start gap-4 hover:border-[#4573D9] hover:shadow-sm transition-all group"
              >
                <div className="p-2.5 rounded-lg" style={{ background: card.bg }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <div>
                  <div className="font-semibold text-[#151B26] group-hover:text-[#4573D9] transition-colors">{card.label}</div>
                  <div className="text-xs text-[#6B6F76] mt-0.5">{card.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Stat pills */}
        {loading ? (
          <div className="h-24 flex items-center justify-center text-sm text-[#6B6F76]">Loading…</div>
        ) : data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Projects",  value: data.totalProjects, icon: FolderOpen,    color: "#4573D9" },
                { label: "Tasks",     value: data.totalTasks,    icon: TrendingUp,    color: "#8B5CF6" },
                { label: "Completed", value: `${data.completedTasks} (${pct}%)`, icon: CheckCircle2, color: "#14A454" },
                { label: "Overdue",   value: data.overdueTasks,  icon: AlertCircle,   color: "#EF4444" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white border border-[#E8E8E9] rounded-xl px-4 py-4 flex items-center gap-3">
                    <Icon size={18} style={{ color: s.color }} />
                    <div>
                      <div className="text-xl font-bold text-[#151B26]">{s.value}</div>
                      <div className="text-xs text-[#6B6F76]">{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Status donut */}
              <div className="bg-white border border-[#E8E8E9] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[#151B26] mb-4">Tasks by status</h2>
                {data.statusBreakdown.length === 0 ? (
                  <p className="text-sm text-[#6B6F76] text-center py-6">No tasks yet</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={data.statusBreakdown} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                          {data.statusBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      {data.statusBreakdown.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-[#6B6F76] capitalize truncate">{s.name}</span>
                          <span className="ml-auto font-medium text-[#151B26]">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks by project bar */}
              <div className="bg-white border border-[#E8E8E9] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[#151B26] mb-4">Tasks by project</h2>
                {data.tasksByProject.length === 0 ? (
                  <p className="text-sm text-[#6B6F76] text-center py-6">No projects yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data.tasksByProject} barSize={16} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B6F76" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#6B6F76" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E8E8E9" }} />
                      <Bar dataKey="tasks" fill="#4573D9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Activity line chart */}
            <div className="bg-white border border-[#E8E8E9] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#151B26] mb-4">Activity — last 7 days</h2>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.activityByDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B6F76" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B6F76" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E8E8E9" }} />
                  <Line type="monotone" dataKey="count" stroke="#4573D9" strokeWidth={2} dot={{ r: 3, fill: "#4573D9" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
