"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Star, ChevronDown, ChevronRight, Share2, Settings2, Filter, ArrowUpDown,
  Search, Plus, User, Calendar, MoreHorizontal, Loader2, X,
} from "lucide-react";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import CustomizePanel from "@/components/CustomizePanel";
import ProjectDropdownMenu from "@/components/ProjectDropdownMenu";
import FilterPanel, { type ActiveFilters, DEFAULT_FILTERS } from "@/components/FilterPanel";
import SortDropdown, { type SortKey } from "@/components/SortDropdown";
import ShowHideColumns from "@/components/ShowHideColumns";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { useProject } from "@/hooks/useProject";
import type { ColumnKey } from "@/lib/data";
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "@/lib/exportUtils";

const TABS = ["Overview","List","Board","Timeline","Calendar","Workflow","Dashboard","Messages","Files"];

function getWeekRange(offset = 0) {
  const now = new Date(), day = now.getDay();
  const start = new Date(now); start.setDate(now.getDate() - day + offset * 7); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}

function ordSuffix(d: number) {
  if (d >= 11 && d <= 13) return "th";
  return ["th","st","nd","rd"][d % 10] ?? "th";
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.getDate();
  return `${day}${ordSuffix(day)} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const hh = h % 12 || 12, mm = String(m).padStart(2, "0"), ampm = h >= 12 ? "PM" : "AM";
  return `${fmtDate(iso)}, ${hh}:${mm} ${ampm}`;
}

export default function TaskList({ projectId }: { projectId: string }) {
  const {
    project, sections, tasks, columnConfigs, loading, error,
    addSection, updateSection,
    addTask, updateTask, toggleTask, duplicateTask, deleteTask,
    addAttachment, removeAttachment,
    updateColumnConfig,
  } = useProject(projectId);

  const [selectedTaskId, setSelectedTaskId]   = useState<string | null>(null);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [showCustomize, setShowCustomize]     = useState(false);
  const [showColumns, setShowColumns]         = useState(false);
  const [showFilter, setShowFilter]           = useState(false);
  const [showSort, setShowSort]               = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectMenuPos, setProjectMenuPos]   = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery]         = useState("");
  const [showSearch, setShowSearch]           = useState(false);

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey]             = useState<SortKey>("none");

  const [addingIn, setAddingIn]           = useState<string | null>(null);
  const [newTaskName, setNewTaskName]     = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const dateInputRef  = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [renamingSection, setRenamingSection]   = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const [editingTaskId, setEditingTaskId]       = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName]   = useState("");

  // ESC closes task detail panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTaskId) { setSelectedTaskId(null); return; }
        if (showSearch) { setSearchQuery(""); setShowSearch(false); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTaskId, showSearch]);

  const visibleCols = columnConfigs.filter(c => c.visible).map(c => c.column_key as ColumnKey);

  const filteredTasks = useMemo(() => {
    let r = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(t => t.name.toLowerCase().includes(q));
    }
    if (activeFilters.incomplete && !activeFilters.completed)  r = r.filter(t => !t.completed);
    if (activeFilters.completed  && !activeFilters.incomplete) r = r.filter(t =>  t.completed);
    if (activeFilters.justMyTasks)  r = r.filter(t => !t.assignee || t.assignee === "MH");
    if (activeFilters.dueThisWeek) { const { start, end } = getWeekRange(0); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (activeFilters.dueNextWeek) { const { start, end } = getWeekRange(1); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (sortKey !== "none") r = [...r].sort((a, b) => {
      const rank: Record<string, number> = { show_stopper: 0, high: 1, medium: 2, low: 3 };
      switch (sortKey) {
        case "alphabetical":   return a.name.localeCompare(b.name);
        case "dueDate":        return (a.due_date ?? "").localeCompare(b.due_date ?? "");
        case "createdAt":      return a.created_at.localeCompare(b.created_at);
        case "lastModifiedAt": return b.updated_at.localeCompare(a.updated_at);
        case "completedAt":    return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
        case "priority":       return (rank[a.priority ?? ""] ?? 4) - (rank[b.priority ?? ""] ?? 4);
        default: return 0;
      }
    });
    return r;
  }, [tasks, activeFilters, sortKey, searchQuery]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateSelectedTasks = async (updates: Parameters<typeof updateTask>[1]) => {
    await Promise.all([...selectedIds].map(id => updateTask(id, updates)));
  };

  // If the task being changed is among selected, apply to all selected
  const updateTaskOrBulk = (taskId: string, updates: Parameters<typeof updateTask>[1]) => {
    if (selectedIds.has(taskId) && selectedIds.size > 1) return updateSelectedTasks(updates);
    return updateTask(taskId, updates);
  };

  const openProjectMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setProjectMenuPos({ top: rect.bottom + 4, left: rect.left });
    setShowProjectMenu(true);
  };

  const commitNewTask = async (sectionId: string) => {
    const name = newTaskName.trim();
    if (name) await addTask(sectionId, name, newTaskDueDate || undefined);
    setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null);
  };

  const commitAndOpen = async (sectionId: string) => {
    const name = newTaskName.trim();
    if (!name) { setAddingIn(null); return; }
    const task = await addTask(sectionId, name, newTaskDueDate || undefined);
    setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null);
    if (task) { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>, sectionId: string) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) await addTask(sectionId, line);
    setNewTaskName(""); setAddingIn(null);
  };

  const handleExport = async (type: "csv"|"excel"|"pdf"|"json") => {
    if (!project) return;
    if (type === "csv")   exportToCSV(project, sections, tasks);
    if (type === "excel") await exportToExcel(project, sections, tasks);
    if (type === "pdf")   await exportToPDF(project, sections, tasks);
    if (type === "json")  exportToJSON(project, sections, tasks);
  };

  const filterActive = Object.values(activeFilters).some(Boolean);

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-2 text-[#6B6F76] text-sm">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  );
  if (error || !project) return (
    <div className="flex items-center justify-center h-full text-sm text-red-500">
      {error ?? "Project not found"}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#FAFBFC]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E8E8E9] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: project.icon_bg }}>
            {project.name[0]}
          </div>
          <button onClick={openProjectMenu} className="flex items-center gap-1 text-xl font-bold text-[#151B26] hover:bg-[#F5F5F5] px-2 py-1 rounded">
            {project.name} <ChevronDown size={18} />
          </button>
          <button className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Star size={16} /></button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#6B6F76] rounded-full hover:bg-[#F5F5F5]">
            ○ Set status <ChevronDown size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">MH</div>
            <button className="w-5 h-5 rounded-full border border-[#E8E8E9] bg-white flex items-center justify-center text-[#6B6F76] hover:bg-[#F5F5F5]"><Plus size={10} /></button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
            <Share2 size={13} /> Share
          </button>
          <button onClick={() => { setShowCustomize(true); setSelectedTaskId(null); setShowColumns(false); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]">
            <Settings2 size={13} /> Customize
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-6 bg-white border-b border-[#E8E8E9] flex-shrink-0">
        {TABS.map(tab => (
          <button key={tab} className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${tab === "List" ? "font-semibold text-[#151B26] border-b-2 border-[#151B26]" : "text-[#6B6F76] hover:text-[#151B26]"}`}>{tab}</button>
        ))}
        <button className="px-3 py-2.5 text-sm text-[#6B6F76] hover:text-[#151B26]">+</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-[#E8E8E9] flex-shrink-0 gap-3">
        <button onClick={() => { setAddingIn(sections[0]?.id ?? null); setSelectedTaskId(null); }} className="flex items-center gap-1 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] flex-shrink-0">
          <Plus size={14} /> Add task <ChevronDown size={13} />
        </button>
        <div className="flex items-center gap-0.5 flex-1 justify-end">
          {showSearch && (
            <div className="flex items-center gap-1 px-2 py-1 border border-[#4573D9] rounded-md bg-white">
              <Search size={13} className="text-[#4573D9] flex-shrink-0" />
              <input
                ref={searchInputRef}
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="text-sm outline-none text-[#151B26] placeholder-[#9EA3AA] w-40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-[#6B6F76] hover:text-[#151B26]"><X size={12} /></button>
              )}
            </div>
          )}
          <div className="relative">
            <button onClick={() => { setShowFilter(v => !v); setShowSort(false); }} className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${filterActive ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
              <Filter size={14} /> Filter{filterActive ? " •" : ""}
            </button>
            {showFilter && <FilterPanel filters={activeFilters} onChange={setActiveFilters} onClose={() => setShowFilter(false)} />}
          </div>
          <div className="relative">
            <button onClick={() => { setShowSort(v => !v); setShowFilter(false); }} className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${sortKey !== "none" ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
              <ArrowUpDown size={14} /> Sort{sortKey !== "none" ? " •" : ""}
            </button>
            {showSort && <SortDropdown current={sortKey} onChange={setSortKey} onClose={() => setShowSort(false)} />}
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><MoreHorizontal size={14} /> Group</button>
          <button onClick={() => { setShowColumns(v => !v); setShowCustomize(false); setSelectedTaskId(null); }} className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${showColumns ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
            <Settings2 size={14} /> Options
          </button>
          <button
            onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(""); }}
            className={`p-2 rounded transition-colors ${showSearch ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}
          >
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-[#151B26] text-white text-sm flex-shrink-0">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-white/20" />
          <StatusBadge
            compact
            value=""
            placeholder="Set status"
            onChange={v => updateSelectedTasks({ status: v })}
          />
          <label className="flex items-center gap-1 cursor-pointer hover:text-[#93C5FD] text-white/80">
            <Calendar size={13} />
            <span>Set due date</span>
            <input
              type="date"
              className="sr-only"
              onChange={e => { if (e.target.value) updateSelectedTasks({ due_date: e.target.value }); }}
            />
          </label>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto flex items-center gap-1 text-white/60 hover:text-white">
            <X size={14} /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="flex items-center px-6 py-2 border-b border-[#E8E8E9] sticky top-0 bg-[#FAFBFC] z-10">
          <div className="w-5 mr-2 flex-shrink-0" />
          <div className="flex-1 text-xs font-medium text-[#6B6F76]">Name</div>
          {visibleCols.includes("status")           && <div className="w-32 text-xs font-medium text-[#6B6F76]">Status</div>}
          {visibleCols.includes("assignee")         && <div className="w-28 text-xs font-medium text-[#6B6F76]">Assignee</div>}
          {visibleCols.includes("due_date")         && <div className="w-28 text-xs font-medium text-[#6B6F76]">Due date</div>}
          {visibleCols.includes("priority")         && <div className="w-32 text-xs font-medium text-[#6B6F76]">Priority</div>}
          {visibleCols.includes("created_on")       && <div className="w-40 text-xs font-medium text-[#6B6F76]">Created on</div>}
          {visibleCols.includes("last_modified_on") && <div className="w-40 text-xs font-medium text-[#6B6F76]">Last modified</div>}
          {visibleCols.includes("completed_on")     && <div className="w-40 text-xs font-medium text-[#6B6F76]">Completed on</div>}
          <div className="w-8 text-xs text-[#4573D9] cursor-pointer">+</div>
        </div>

        {/* Filter/search info bar */}
        {(filterActive || sortKey !== "none" || searchQuery) && (
          <div className="px-6 py-1.5 bg-[#EEF2FB] border-b border-[#E8E8E9] flex items-center gap-2">
            <span className="text-xs text-[#4573D9]">Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <button onClick={() => { setActiveFilters(DEFAULT_FILTERS); setSortKey("none"); setSearchQuery(""); }} className="text-xs text-[#4573D9] underline">Clear all</button>
          </div>
        )}

        {/* Sections + tasks */}
        {sections.map(section => {
          const sectionTasks = filteredTasks.filter(t => t.section_id === section.id);
          return (
            <div key={section.id}>
              {/* Section header */}
              <div className="flex items-center px-6 py-2 border-b border-[#E8E8E9] group">
                <ChevronDown size={14} className="text-[#6B6F76] mr-1 flex-shrink-0" />
                {renamingSection === section.id ? (
                  <input
                    autoFocus
                    value={sectionNameDraft}
                    onChange={e => setSectionNameDraft(e.target.value)}
                    onBlur={() => { updateSection(section.id, sectionNameDraft.trim() || section.name); setRenamingSection(null); }}
                    onKeyDown={e => { if (e.key === "Enter") { updateSection(section.id, sectionNameDraft.trim() || section.name); setRenamingSection(null); } if (e.key === "Escape") setRenamingSection(null); }}
                    className="text-sm font-semibold text-[#151B26] outline-none border border-[#4573D9] rounded px-2 py-0.5"
                    style={{ minWidth: 120 }}
                  />
                ) : (
                  <button
                    className="text-sm font-semibold text-[#151B26] hover:text-[#4573D9]"
                    onDoubleClick={() => { setRenamingSection(section.id); setSectionNameDraft(section.name); }}
                  >
                    {section.name}
                  </button>
                )}
                <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setAddingIn(section.id)} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><Plus size={13} /></button>
                  <button className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><MoreHorizontal size={13} /></button>
                </div>
              </div>

              {/* Task rows */}
              {sectionTasks.map(task => {
                const isSelected = selectedIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    onDoubleClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                    className={`flex items-center px-6 py-2 border-b border-[#E8E8E9] hover:bg-[#F5F5F5] group cursor-default ${selectedTaskId === task.id || isSelected ? "bg-[#F5F5F5]" : ""}`}
                  >
                    {/* Radio / select circle */}
                    <div
                      onClick={e => toggleSelect(task.id, e)}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mr-2 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#4573D9] border-[#4573D9]"
                          : task.completed
                          ? "bg-[#14A454] border-[#14A454]"
                          : "border-[#B0B3B8] hover:border-[#4573D9] group-hover:border-[#4573D9]"
                      }`}
                    >
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <circle cx="5" cy="5" r="2.5" fill="white" />
                        </svg>
                      )}
                      {!isSelected && task.completed && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5.5L4.2 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Task name — click to edit inline; ChevronRight opens detail */}
                    <div className="flex-1 text-sm min-w-0 py-1 flex items-center gap-1 min-w-0">
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          value={editingTaskName}
                          onChange={e => setEditingTaskName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); updateTask(task.id, { name: editingTaskName.trim() || task.name }); setEditingTaskId(null); }
                          }}
                          onBlur={() => { updateTask(task.id, { name: editingTaskName.trim() || task.name }); setEditingTaskId(null); }}
                          className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span
                            className={`truncate cursor-text ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}
                            onClick={e => { e.stopPropagation(); setEditingTaskId(task.id); setEditingTaskName(task.name); }}
                          >
                            {task.name}
                          </span>
                          {(task.BT_attachments?.length ?? 0) > 0 && (
                            <span className="text-xs text-[#6B6F76] flex-shrink-0">📎 {task.BT_attachments!.length}</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 text-[#6B6F76] hover:text-[#4573D9] transition-opacity"
                            title="Open detail"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </>
                      )}
                    </div>

                    {visibleCols.includes("status") && (
                      <div className="w-32" onClick={e => e.stopPropagation()}>
                        <StatusBadge compact value={task.status} onChange={v => updateTaskOrBulk(task.id, { status: v })} />
                      </div>
                    )}
                    {visibleCols.includes("assignee") && (
                      <div className="w-28" onClick={e => e.stopPropagation()}>
                        {task.assignee
                          ? <div className="w-6 h-6 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">{task.assignee.slice(0,2).toUpperCase()}</div>
                          : <button className="w-5 h-5 rounded-full border-2 border-dashed border-[#D0D2D6] flex items-center justify-center text-[#6B6F76] hover:border-[#4573D9] opacity-0 group-hover:opacity-100"><User size={10} /></button>
                        }
                      </div>
                    )}
                    {visibleCols.includes("due_date") && (
                      <div className="w-28" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-flex items-center gap-1 cursor-pointer">
                          {task.due_date && <span className="text-xs text-[#6B6F76]">{fmtDate(task.due_date)}</span>}
                          <div className={`relative ${task.due_date ? "" : "opacity-0 group-hover:opacity-100"}`}>
                            <Calendar size={13} className="text-[#6B6F76]" />
                            <input
                              type="date"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              value={task.due_date ?? ""}
                              onChange={e => updateTaskOrBulk(task.id, { due_date: e.target.value || null })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {visibleCols.includes("priority") && (
                      <div className="w-32" onClick={e => e.stopPropagation()}>
                        <PriorityBadge compact value={task.priority} onChange={v => updateTaskOrBulk(task.id, { priority: v })} />
                      </div>
                    )}
                    {visibleCols.includes("created_on") && (
                      <div className="w-40"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.created_at)}</span></div>
                    )}
                    {visibleCols.includes("last_modified_on") && (
                      <div className="w-40"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.updated_at)}</span></div>
                    )}
                    {visibleCols.includes("completed_on") && (
                      <div className="w-40"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.completed_at)}</span></div>
                    )}
                    <div className="w-8" />
                  </div>
                );
              })}

              {/* Inline add task */}
              {addingIn === section.id ? (
                <div className="flex items-center px-6 py-2 border-b border-[#E8E8E9] bg-white gap-2">
                  <div className="w-4 h-4 rounded-full border border-[#B0B3B8] flex-shrink-0" />
                  <input
                    autoFocus
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    onPaste={e => handlePaste(e, section.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitNewTask(section.id);
                      if (e.key === "Escape") { setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null); }
                    }}
                    onBlur={() => commitNewTask(section.id)}
                    placeholder="Write a task name"
                    className="flex-1 text-sm outline-none text-[#151B26] placeholder-[#6B6F76]"
                  />
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"
                    >
                      <ArrowUpDown size={13} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={async e => { e.preventDefault(); await commitAndOpen(section.id); }}
                      className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"
                    >
                      <ChevronRight size={13} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"
                    >
                      <User size={13} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); dateInputRef.current?.showPicker?.(); dateInputRef.current?.click(); }}
                      className={`p-1.5 rounded ${newTaskDueDate ? "text-[#4573D9]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}
                    >
                      <Calendar size={13} />
                    </button>
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="sr-only"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center px-6 py-2 border-b border-[#E8E8E9] cursor-pointer hover:bg-[#F5F5F5] group/add"
                  onClick={() => setAddingIn(section.id)}
                >
                  <div className="w-4 h-4 rounded-full border border-[#E8E8E9] mr-2 flex-shrink-0 group-hover/add:border-[#4573D9]" />
                  <span className="text-sm text-[#9EA3AA] group-hover/add:text-[#4573D9]">Add task...</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Add section */}
        <div className="px-6 py-3">
          <button
            onClick={async () => { const s = await addSection(); if (s) { setRenamingSection(s.id); setSectionNameDraft(s.name); } }}
            className="flex items-center gap-1 text-sm text-[#6B6F76] hover:text-[#151B26]"
          >
            <Plus size={14} /> Add section
          </button>
        </div>
      </div>

      {/* Panels */}
      {selectedTaskId && (() => {
        const t = tasks.find(x => x.id === selectedTaskId);
        return t ? (
          <TaskDetailPanel
            task={t}
            projectId={projectId}
            projectName={project.name}
            projectColor={project.icon_bg}
            sections={sections}
            onClose={() => setSelectedTaskId(null)}
            updateTask={updateTask}
            toggleTask={toggleTask}
            duplicateTask={duplicateTask}
            deleteTask={deleteTask}
            addAttachment={addAttachment}
            removeAttachment={removeAttachment}
          />
        ) : null;
      })()}
      {showCustomize && <CustomizePanel onClose={() => setShowCustomize(false)} />}
      {showColumns && (
        <ShowHideColumns
          configs={columnConfigs}
          onToggle={updateColumnConfig}
          onClose={() => setShowColumns(false)}
        />
      )}
      {showProjectMenu && (
        <ProjectDropdownMenu
          project={project}
          sections={sections}
          tasks={tasks}
          position={projectMenuPos}
          onExport={handleExport}
          onClose={() => setShowProjectMenu(false)}
        />
      )}
    </div>
  );
}
