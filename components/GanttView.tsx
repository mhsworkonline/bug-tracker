"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { Task, Section } from "@/lib/data";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface Props {
  tasks: Task[];
  sections: Section[];
  onOpenTask: (id: string) => void;
  statuses: readonly { readonly key: string; readonly color: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  not_started: "#9CA3AF",
  in_progress:  "#4573D9",
  done:         "#22C55E",
  blocked:      "#EF4444",
  on_hold:      "#F59E0B",
};

const CELL_W  = 36; // px per day
const ROW_H   = 36;
const LEFT_W  = 220;
const HEADER_H = 52;

function parseDate(d: string) { return new Date(d + "T00:00:00"); }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmt(d: Date) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export default function GanttView({ tasks, sections, onOpenTask, statuses }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: Task } | null>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Compute date range from tasks — pad 7 days on each side
  const { rangeStart, totalDays } = useMemo(() => {
    const dated = tasks.filter(t => t.due_date || t.start_date);
    if (!dated.length) {
      return { rangeStart: addDays(today, -14), totalDays: 90 };
    }
    const allDates = dated.flatMap(t => [t.start_date, t.due_date].filter(Boolean).map(d => parseDate(d!)));
    const min = new Date(Math.min(...allDates.map(d => d.getTime())));
    const max = new Date(Math.max(...allDates.map(d => d.getTime())));
    const rs = addDays(min, -7);
    return { rangeStart: rs, totalDays: Math.max(90, daysBetween(rs, max) + 14) };
  }, [tasks, today]);

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayOffset = daysBetween(rangeStart, today) * CELL_W - 200;
    scrollRef.current.scrollLeft = Math.max(0, todayOffset);
  }, [rangeStart, today]);

  // Build month/week header segments
  const monthSegs = useMemo(() => {
    const segs: { label: string; startDay: number; days: number }[] = [];
    let cur = new Date(rangeStart);
    for (let i = 0; i < totalDays; ) {
      const month = cur.getMonth();
      const year = cur.getFullYear();
      let count = 0;
      while (i + count < totalDays && new Date(addDays(rangeStart, i + count)).getMonth() === month) count++;
      segs.push({ label: new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }), startDay: i, days: count });
      i += count;
      cur = addDays(rangeStart, i);
    }
    return segs;
  }, [rangeStart, totalDays]);

  const dayLabels = useMemo(() =>
    Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, totalDays]);

  const todayX = daysBetween(rangeStart, today) * CELL_W;

  type Row = { type: "section"; section: Section } | { type: "task"; task: Task };

  // Ordered tasks with section groups
  const rows = useMemo(() => {
    const out: Row[] = [];
    // tasks with sections
    sections.forEach(sec => {
      const sectionTasks = tasks.filter(t => t.section_id === sec.id && !t.parent_task_id);
      if (!sectionTasks.length) return;
      out.push({ type: "section" as const, section: sec });
      sectionTasks.forEach(t => out.push({ type: "task" as const, task: t }));
    });
    // unsectioned
    const unsectioned = tasks.filter(t => !t.section_id && !t.parent_task_id);
    unsectioned.forEach(t => out.push({ type: "task" as const, task: t }));
    return out;
  }, [tasks, sections]);

  const totalHeight = rows.length * ROW_H;
  const totalWidth  = totalDays * CELL_W;

  function getBar(task: Task) {
    const start = task.start_date ? parseDate(task.start_date) : task.due_date ? parseDate(task.due_date) : null;
    const end   = task.due_date   ? parseDate(task.due_date)   : task.start_date ? parseDate(task.start_date) : null;
    if (!start || !end) return null;
    const x = daysBetween(rangeStart, start) * CELL_W;
    const w = Math.max(CELL_W, (daysBetween(start, end) + 1) * CELL_W);
    return { x, w };
  }

  const barColor = (task: Task) => STATUS_COLOR[task.status] ?? "#9CA3AF";

  return (
    <div className="flex flex-col h-full select-none">
      {/* Jump to today */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E8E8E9] bg-white">
        <button
          onClick={() => { if (!scrollRef.current) return; scrollRef.current.scrollLeft = Math.max(0, todayX - 200); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E8E8E9] rounded-md hover:bg-[#F5F5F5] text-[#151B26]"
        >
          <CalendarDays size={13} /> Today
        </button>
        <span className="text-xs text-[#9EA3AA]">{fmt(rangeStart)} — {fmt(addDays(rangeStart, totalDays - 1))}</span>
        <div className="flex items-center gap-1 ml-auto flex-wrap gap-y-1">
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-[#6B6F76]">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{k.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — task names */}
        <div className="flex-shrink-0 bg-white border-r border-[#E8E8E9] overflow-y-auto" style={{ width: LEFT_W }}>
          <div style={{ height: HEADER_H }} className="border-b border-[#E8E8E9] flex items-end pb-1 px-3">
            <span className="text-xs font-semibold text-[#6B6F76]">Task</span>
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ height: ROW_H }}
              className={`flex items-center px-3 border-b border-[#F0F1F3] ${row.type === "section" ? "bg-[#FAFBFC]" : "hover:bg-[#FAFBFC] cursor-pointer"}`}
              onClick={() => row.type === "task" && onOpenTask(row.task.id)}
            >
              {row.type === "section" ? (
                <span className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide truncate">{row.section.name}</span>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  {row.task.is_milestone && <span className="text-amber-500 text-[10px] flex-shrink-0">◆</span>}
                  <span className={`text-sm truncate ${row.task.completed ? "line-through text-[#9EA3AA]" : "text-[#151B26]"}`}>{row.task.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right panel — timeline */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Month header */}
            <div style={{ height: HEADER_H / 2 }} className="flex border-b border-[#E8E8E9] bg-[#FAFBFC] sticky top-0 z-10">
              {monthSegs.map((seg, i) => (
                <div key={i} style={{ width: seg.days * CELL_W, minWidth: seg.days * CELL_W }}
                  className="border-r border-[#E8E8E9] flex items-center px-2 text-[11px] font-semibold text-[#6B6F76] overflow-hidden">
                  {seg.label}
                </div>
              ))}
            </div>
            {/* Day header */}
            <div style={{ height: HEADER_H / 2 }} className="flex border-b border-[#E8E8E9] bg-white sticky top-[26px] z-10">
              {dayLabels.map((d, i) => {
                const isToday = d.getTime() === today.getTime();
                const isSun = d.getDay() === 0;
                return (
                  <div key={i} style={{ width: CELL_W, minWidth: CELL_W }}
                    className={`border-r border-[#F0F1F3] flex items-center justify-center text-[10px] ${isToday ? "text-white font-bold" : isSun ? "text-[#EF4444]" : "text-[#9EA3AA]"} ${isToday ? "bg-[#4573D9] rounded-full mx-auto" : ""}`}>
                    {d.getDate() === 1 || i === 0 ? d.getDate() : d.getDay() === 1 || i % 7 === 0 ? d.getDate() : ""}
                  </div>
                );
              })}
            </div>

            {/* Grid rows */}
            <div style={{ height: totalHeight, position: "relative" }}>
              {/* Today vertical line */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div style={{ left: todayX + CELL_W / 2, top: 0, bottom: 0, position: "absolute", width: 2, background: "#4573D9", opacity: 0.6, zIndex: 5, pointerEvents: "none" }} />
              )}
              {/* Weekend shading */}
              {dayLabels.map((d, i) => d.getDay() === 0 || d.getDay() === 6 ? (
                <div key={i} style={{ left: i * CELL_W, top: 0, bottom: 0, width: CELL_W, position: "absolute", background: "#F9FAFB", zIndex: 0, pointerEvents: "none" }} />
              ) : null)}

              {/* Row backgrounds */}
              {rows.map((row, i) => (
                <div key={i} style={{ top: i * ROW_H, height: ROW_H, left: 0, right: 0, position: "absolute" }}
                  className={`border-b border-[#F0F1F3] ${row.type === "section" ? "bg-[#FAFBFC]" : ""}`} />
              ))}

              {/* Bars */}
              {rows.map((row, i) => {
                if (row.type !== "task") return null;
                const task = row.task;
                const bar = getBar(task);
                if (!bar) return null;
                const color = barColor(task);
                const isMilestone = task.is_milestone && !task.start_date;

                return (
                  <div key={task.id}
                    style={{ top: i * ROW_H + 6, height: ROW_H - 12, left: bar.x, width: isMilestone ? ROW_H - 12 : bar.w, position: "absolute", zIndex: 2 }}
                    className="cursor-pointer"
                    onClick={() => onOpenTask(task.id)}
                    onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, task })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {isMilestone ? (
                      <div style={{ width: ROW_H - 12, height: ROW_H - 12, background: "#F59E0B", transform: "rotate(45deg)", borderRadius: 3 }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: color, borderRadius: 4, opacity: task.completed ? 0.5 : 1 }}
                        className="flex items-center px-2 overflow-hidden">
                        <span className="text-white text-[11px] truncate font-medium">{task.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 9999, pointerEvents: "none" }}
          className="bg-[#151B26] text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[200px]">
          <div className="font-semibold truncate">{tooltip.task.name}</div>
          {tooltip.task.start_date && <div className="text-[#9CA3AF] mt-0.5">Start: {tooltip.task.start_date}</div>}
          {tooltip.task.due_date   && <div className="text-[#9CA3AF]">Due: {tooltip.task.due_date}</div>}
          {tooltip.task.assignee   && <div className="text-[#9CA3AF] truncate">{tooltip.task.assignee}</div>}
        </div>
      )}
    </div>
  );
}
