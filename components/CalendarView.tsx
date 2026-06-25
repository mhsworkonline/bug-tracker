"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import type { Task } from "@/lib/data";

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "#6B6F76", in_progress: "#1D4ED8",
  ready_for_qa: "#6D28D9", in_review: "#B45309",
  done: "#065F46", blocked: "#B91C1C",
};
const STATUS_BG: Record<string, string> = {
  not_started: "#F3F4F6", in_progress: "#DBEAFE",
  ready_for_qa: "#EDE9FE", in_review: "#FEF3C7",
  done: "#D1FAE5", blocked: "#FEE2E2",
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarView({ tasks, onOpenTask, updateTask }: Props) {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = current.getFullYear();
  const month = current.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

  const weeks = useMemo(() => {
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [firstDow, daysInMonth]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const monthName = current.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FAFBFC]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-1.5 rounded hover:bg-[#F0F1F3] text-[#6B6F76]"><ChevronLeft size={16} /></button>
        <span className="text-base font-semibold text-[#151B26] w-44 text-center">{monthName}</span>
        <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-1.5 rounded hover:bg-[#F0F1F3] text-[#6B6F76]"><ChevronRight size={16} /></button>
        <button onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))} className="ml-2 px-3 py-1 text-xs border border-[#E8E8E9] rounded-md text-[#6B6F76] hover:bg-[#F5F5F5]">Today</button>
      </div>

      {/* Grid */}
      <div className="bg-white border border-[#E8E8E9] rounded-xl overflow-hidden">
        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-[#E8E8E9]">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-[#6B6F76]">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[#E8E8E9] last:border-0" style={{ minHeight: 96 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} className="bg-[#FAFBFC] border-r border-[#E8E8E9] last:border-0" />;
              const cellDate = new Date(year, month, day);
              const key = `${year}-${month}-${day}`;
              const dayTasks = tasksByDay[key] ?? [];
              const isToday = isSameDay(cellDate, today);
              const isPast  = cellDate < today && !isToday;

              return (
                <div key={di} className={`border-r border-[#E8E8E9] last:border-0 p-1 sm:p-2 ${isPast ? "bg-[#FAFBFC]" : "bg-white"}`}>
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? "bg-[#4573D9] text-white" : isPast ? "text-[#B0B3B8]" : "text-[#151B26]"}`}>
                    {day}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayTasks.slice(0, 3).map(t => (
                      <button
                        key={t.id}
                        onClick={() => onOpenTask(t.id)}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs truncate font-medium leading-tight"
                        style={{ background: STATUS_BG[t.status] ?? "#F3F4F6", color: STATUS_COLORS[t.status] ?? "#6B6F76" }}
                      >
                        {t.name || "Untitled"}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-[#6B6F76] px-1">+{dayTasks.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* No due dates notice */}
      {tasks.filter(t => t.due_date).length === 0 && (
        <p className="text-center text-sm text-[#6B6F76] mt-8">No tasks with due dates. Set due dates to see them here.</p>
      )}
    </div>
  );
}
