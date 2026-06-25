"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Circle, Calendar, ArrowLeft, Loader2 } from "lucide-react";

interface MyTask {
  id: string;
  name: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  completed: boolean;
  project_id: string;
  project_name: string;
  project_color: string;
}

const STATUS_COLORS: Record<string, string> = {
  not_started:  "#6B6F76",
  in_progress:  "#1D4ED8",
  ready_for_qa: "#6D28D9",
  in_review:    "#B45309",
  done:         "#065F46",
  blocked:      "#B91C1C",
};

const STATUS_BG: Record<string, string> = {
  not_started:  "#F3F4F6",
  in_progress:  "#DBEAFE",
  ready_for_qa: "#EDE9FE",
  in_review:    "#FEF3C7",
  done:         "#D1FAE5",
  blocked:      "#FEE2E2",
};

const STATUS_LABELS: Record<string, string> = {
  not_started:  "Not Started",
  in_progress:  "In Progress",
  ready_for_qa: "Ready for QA",
  in_review:    "In Review",
  done:         "Done",
  blocked:      "Blocked",
};

const PRIORITY_DOT: Record<string, string> = {
  show_stopper: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#9CA3AF",
};

type GroupBy = "status" | "project" | "due_date";

export default function MyTasksClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [tasks, setTasks]       = useState<MyTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [groupBy, setGroupBy]   = useState<GroupBy>("status");
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: taskRows } = await supabase
        .from("BT_tasks")
        .select("id, name, status, priority, due_date, completed, project_id")
        .eq("assignee", userEmail)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (!taskRows?.length) { setLoading(false); return; }

      const projectIds = [...new Set(taskRows.map(t => t.project_id))];
      const { data: projects } = await supabase
        .from("BT_projects")
        .select("id, name, icon_bg")
        .in("id", projectIds);

      const pMap: Record<string, { name: string; icon_bg: string }> = {};
      for (const p of projects ?? []) pMap[p.id] = { name: p.name, icon_bg: p.icon_bg };

      setTasks(taskRows.map(t => ({
        ...t,
        project_name:  pMap[t.project_id]?.name  ?? "Unknown",
        project_color: pMap[t.project_id]?.icon_bg ?? "#6B6F76",
      })));
      setLoading(false);
    }
    load();
  }, [userEmail]);

  const visible = showDone ? tasks : tasks.filter(t => !t.completed);

  function groupTasks(): { label: string; tasks: MyTask[] }[] {
    if (groupBy === "status") {
      const order = ["in_progress", "not_started", "in_review", "ready_for_qa", "blocked", "done"];
      const groups: Record<string, MyTask[]> = {};
      for (const t of visible) {
        const k = t.status ?? "not_started";
        if (!groups[k]) groups[k] = [];
        groups[k].push(t);
      }
      return order.filter(k => groups[k]?.length).map(k => ({ label: STATUS_LABELS[k] ?? k, tasks: groups[k] }));
    }
    if (groupBy === "project") {
      const groups: Record<string, MyTask[]> = {};
      for (const t of visible) {
        if (!groups[t.project_name]) groups[t.project_name] = [];
        groups[t.project_name].push(t);
      }
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([label, tasks]) => ({ label, tasks }));
    }
    // due_date
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
    const groups: Record<string, MyTask[]> = { Overdue: [], Today: [], Tomorrow: [], "This week": [], Later: [], "No due date": [] };
    for (const t of visible) {
      if (!t.due_date) { groups["No due date"].push(t); continue; }
      const d = new Date(t.due_date); d.setHours(0,0,0,0);
      if (d < today)        groups["Overdue"].push(t);
      else if (d.getTime() === today.getTime())  groups["Today"].push(t);
      else if (d.getTime() === tomorrow.getTime()) groups["Tomorrow"].push(t);
      else if (d <= nextWeek) groups["This week"].push(t);
      else                   groups["Later"].push(t);
    }
    return Object.entries(groups).filter(([, t]) => t.length).map(([label, tasks]) => ({ label, tasks }));
  }

  const grouped = groupTasks();

  const toggleComplete = async (task: MyTask) => {
    const completed = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed, status: completed ? "done" : "not_started" } : t));
    await supabase.from("BT_tasks").update({ completed, status: completed ? "done" : "not_started", completed_at: completed ? new Date().toISOString() : null }).eq("id", task.id);
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-semibold text-[#151B26]">My Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B6F76] hidden sm:block">{userEmail}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1 bg-white border border-[#E8E8E9] rounded-lg p-1">
            {(["status", "project", "due_date"] as GroupBy[]).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${groupBy === g ? "bg-[#4573D9] text-white" : "text-[#6B6F76] hover:text-[#151B26]"}`}
              >
                {g === "due_date" ? "Due date" : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowDone(v => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${showDone ? "bg-[#F5F5F5] border-[#D0D2D6] text-[#151B26]" : "border-[#E8E8E9] text-[#6B6F76] hover:bg-[#F5F5F5]"}`}
          >
            {showDone ? "Hide completed" : "Show completed"}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[#6B6F76]" />
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 size={40} className="text-[#D1FAE5] mx-auto mb-3" />
            <p className="text-[#6B6F76] text-sm">No tasks assigned to you.</p>
          </div>
        )}

        {!loading && grouped.map(group => (
          <div key={group.label} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide">{group.label}</span>
              <span className="text-xs text-[#B0B3B8]">{group.tasks.length}</span>
            </div>
            <div className="bg-white border border-[#E8E8E9] rounded-xl overflow-hidden">
              {group.tasks.map((task, i) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors ${i < group.tasks.length - 1 ? "border-b border-[#E8E8E9]" : ""}`}
                >
                  <button onClick={() => toggleComplete(task)} className="flex-shrink-0">
                    {task.completed
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <Circle size={16} className="text-[#C8C9CC] hover:text-[#4573D9]" />}
                  </button>
                  <Link href={`/projects/${task.project_id}`} className="flex-1 min-w-0">
                    <span className={`text-sm ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"} block truncate`}>
                      {task.name || "Untitled"}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.priority && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIORITY_DOT[task.priority] ?? "#9CA3AF" }} />
                    )}
                    <span
                      className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STATUS_BG[task.status] ?? "#F3F4F6", color: STATUS_COLORS[task.status] ?? "#6B6F76" }}
                    >
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                    {task.due_date && (
                      <span className={`flex items-center gap-1 text-xs ${new Date(task.due_date) < new Date() && !task.completed ? "text-red-500" : "text-[#6B6F76]"}`}>
                        <Calendar size={11} />
                        <span className="hidden sm:inline">{new Date(task.due_date).toLocaleDateString()}</span>
                      </span>
                    )}
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: task.project_color }} title={task.project_name} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
