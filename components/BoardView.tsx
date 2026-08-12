"use client";
import { useState, useRef } from "react";
import { Plus, Circle, CheckCircle2 } from "lucide-react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Section } from "@/lib/data";
import type { ProjectData } from "@/hooks/useProject";

interface Props {
  tasks: Task[];
  sections: Section[];
  projectId: string;
  onOpenTask: (id: string) => void;
  addTask: ProjectData["addTask"];
  updateTask: ProjectData["updateTask"];
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void; updateTask: Props["updateTask"] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes} {...listeners}
      onClick={onOpen}
      className="bg-white border border-[#E8E8E9] rounded-lg p-3 hover:shadow-sm hover:border-[#4573D9] transition-all cursor-pointer select-none"
    >
      <div className="flex items-start gap-2">
        {task.completed
          ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
          : <Circle size={15} className="text-[#C8C9CC] flex-shrink-0 mt-0.5" />}
        <span className={`flex-1 text-sm leading-snug line-clamp-3 ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}>
          {task.name || <span className="text-[#B0B3B8] italic">Untitled</span>}
        </span>
      </div>
      {task.assignee && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-[9px] font-semibold">
            {task.assignee.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs text-[#6B6F76] truncate">{task.assignee}</span>
        </div>
      )}
      {task.due_date && (
        <div className="mt-1.5 text-xs text-[#6B6F76]">{new Date(task.due_date).toLocaleDateString()}</div>
      )}
    </div>
  );
}

export default function BoardView({ tasks, sections, onOpenTask, addTask, updateTask }: Props) {
  const [addingIn, setAddingIn]     = useState<string | null>(null);
  const [draft, setDraft]           = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId]         = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Separate mouse/touch sensors (dnd-kit's recommended pairing) instead of one PointerSensor:
  // touch needs a short press-and-hold delay so a quick swipe pages between columns instead of
  // starting a drag, while mouse can start dragging immediately on a small move.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const scrollToColumn = (id: string | null) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-col="${id ?? "unsectioned"}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const tasksFor = (sectionId: string | null) =>
    tasks.filter(t => t.section_id === sectionId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const columns = sections.map(s => ({ id: s.id as string | null, name: s.name }));

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === active.id) ?? null);
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null); setOverId(null);
    if (!over) return;
    const taskId = String(active.id);
    const overedId = String(over.id);
    const targetCol = columns.find(c => `col-${c.id}` === overedId);
    if (targetCol) { updateTask(taskId, { section_id: targetCol.id }); return; }
    const targetTask = tasks.find(t => t.id === overedId);
    if (targetTask && targetTask.id !== taskId) updateTask(taskId, { section_id: targetTask.section_id });
  };

  const handleAdd = async (sectionId: string | null) => {
    if (!draft.trim()) { setAddingIn(null); return; }
    const t = await addTask(sectionId, draft.trim());
    if (t) onOpenTask(t.id);
    setDraft(""); setAddingIn(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      {/* Mobile-only column picker — on a phone the board pages one column at a time
          (snap-scroll below); this lets you jump straight to a section instead of swiping. */}
      <div className="sm:hidden flex items-center gap-2 overflow-x-auto px-3 py-2 border-b border-[#E8E8E9] bg-white flex-shrink-0">
        {columns.map(col => (
          <button
            key={col.id ?? "unsectioned"}
            onClick={() => scrollToColumn(col.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E8E8E9] text-xs font-medium text-[#151B26] hover:border-[#4573D9] active:bg-[#EEF2FB]"
          >
            {col.name || "Untitled"} <span className="text-[#6B6F76]">{tasksFor(col.id).length}</span>
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 px-3 sm:px-6 py-4 bg-[#FAFBFC] snap-x snap-mandatory sm:snap-none scroll-smooth">
        {columns.map(col => {
          const colTasks = tasksFor(col.id);
          const isOver = overId === `col-${col.id}`;
          return (
            <div
              key={col.id ?? "unsectioned"}
              data-col={col.id ?? "unsectioned"}
              className={`flex-shrink-0 w-[85vw] sm:w-72 snap-start sm:snap-align-none flex flex-col rounded-xl border bg-white overflow-hidden transition-colors ${isOver ? "border-[#4573D9] bg-blue-50/30" : "border-[#E8E8E9]"}`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E9]">
                <span className="text-sm font-semibold text-[#151B26] truncate">{col.name || "Untitled section"}</span>
                <span className="text-xs text-[#6B6F76] ml-2">{colTasks.length}</span>
              </div>

              <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div
                  id={`col-${col.id}`}
                  className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[60px]"
                >
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onOpen={() => onOpenTask(task.id)} updateTask={updateTask} />
                  ))}

                  {addingIn === col.id ? (
                    <div className="bg-white border border-[#4573D9] rounded-lg px-3 py-2 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-[#B0B3B8] flex-shrink-0" />
                      <input
                        autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleAdd(col.id);
                          if (e.key === "Escape") { setAddingIn(null); setDraft(""); }
                        }}
                        onBlur={() => handleAdd(col.id)}
                        placeholder="Write a task name"
                        className="flex-1 text-sm outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingIn(col.id)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-[#6B6F76] hover:text-[#151B26] hover:bg-[#F5F5F5] rounded-lg"
                    >
                      <Plus size={14} /> Add task
                    </button>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-white border border-[#4573D9] rounded-lg p-3 shadow-lg w-72 opacity-95">
            <div className="flex items-start gap-2">
              <Circle size={15} className="text-[#C8C9CC] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#151B26]">{activeTask.name || "Untitled"}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
