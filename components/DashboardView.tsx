"use client";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
  PieChart, Pie,
} from "recharts";
import type { Task, Section } from "@/lib/data";

interface Props { tasks: Task[]; sections: Section[]; }

const COLORS = ["#4573D9","#22C55E","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316"];

export default function DashboardView({ tasks, sections }: Props) {
  const upcoming = useMemo(() => {
    const now = new Date();
    const future = new Date(now); future.setDate(now.getDate() + 14);
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      if (!t.assignee || !t.due_date) return;
      const d = new Date(t.due_date);
      if (d >= now && d <= future) map[t.assignee] = (map[t.assignee] ?? 0) + 1;
    });
    return Object.entries(map).map(([assignee, count]) => ({ assignee: assignee.split("@")[0], count }));
  }, [tasks]);

  const bySection = useMemo(() => {
    const sectionMap: Record<string, string> = {};
    sections.forEach(s => { sectionMap[s.id] = s.name || "Untitled"; });
    const map: Record<string, number> = { "No section": 0 };
    tasks.filter(t => !t.completed).forEach(t => {
      const name = t.section_id ? (sectionMap[t.section_id] ?? "Unknown") : "No section";
      map[name] = (map[name] ?? 0) + 1;
    });
    return Object.entries(map).filter(([,v]) => v > 0).map(([name, count]) => ({ name, count }));
  }, [tasks, sections]);

  const overTime = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.filter(t => t.completed && t.completed_at).forEach(t => {
      const d = t.completed_at!.slice(0, 10);
      map[d] = (map[d] ?? 0) + 1;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).slice(-30).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }));
  }, [tasks]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => { const s = t.completed ? "Completed" : (t.status ?? "Unknown"); map[s] = (map[s] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const total = tasks.length;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAFBFC]">
      <div className="grid grid-cols-2 gap-5 max-w-5xl">
        {/* Upcoming tasks by assignee */}
        <Widget title="Upcoming tasks by assignee">
          {upcoming.length === 0
            ? <Empty label="No upcoming tasks with assignees" />
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={upcoming} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                  <XAxis dataKey="assignee" tick={{ fontSize:11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize:11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Tasks" radius={[4,4,0,0]}>
                    {upcoming.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </Widget>

        {/* Incomplete by section */}
        <Widget title="Incomplete tasks by section">
          {bySection.length === 0
            ? <Empty label="No incomplete tasks" />
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySection} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fontSize:11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize:11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Incomplete" radius={[4,4,0,0]}>
                    {bySection.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </Widget>

        {/* Completion over time */}
        <Widget title="Task completion over time">
          {overTime.length === 0
            ? <Empty label="No completed tasks yet" />
            : <ResponsiveContainer width="100%" height={200}>
                <LineChart data={overTime} margin={{ top:8, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize:11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize:11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Completed" stroke="#4573D9" strokeWidth={2} dot={{ r:3 }} />
                </LineChart>
              </ResponsiveContainer>
          }
        </Widget>

        {/* Total by completion status */}
        <Widget title="Total tasks by completion status">
          {total === 0
            ? <Empty label="No tasks yet" />
            : <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {byStatus.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5">
                  {byStatus.map((s,i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[#6B6F76]">{s.name}</span>
                      <span className="font-semibold text-[#151B26] ml-auto pl-2">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
          }
        </Widget>
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E9] p-5">
      <h3 className="text-sm font-semibold text-[#151B26] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-[#B0B3B8]">{label}</div>;
}
