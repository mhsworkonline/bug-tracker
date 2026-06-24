"use client";

import Link from "next/link";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Star, ChevronDown, ChevronRight, ChevronUp, Share2, Settings2, Filter, ArrowUpDown,
  Search, Plus, User, Calendar, MoreHorizontal, Loader2, X, ChevronsUpDown, ChevronsDownUp,
} from "lucide-react";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import CustomizePanel from "@/components/CustomizePanel";
import ProjectDropdownMenu from "@/components/ProjectDropdownMenu";
import EditProjectModal from "@/components/EditProjectModal";
import MembersPanel from "@/components/MembersPanel";
import ImportModal from "@/components/ImportModal";
import FilterPanel, { type ActiveFilters, DEFAULT_FILTERS } from "@/components/FilterPanel";
import SortDropdown, { type SortKey } from "@/components/SortDropdown";
import ShowHideColumns from "@/components/ShowHideColumns";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import TaskTypeBadge from "@/components/TaskTypeBadge";
import { useProject } from "@/hooks/useProject";
import type { ColumnKey } from "@/lib/data";
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "@/lib/exportUtils";
import { createSupabaseBrowser } from "@/lib/auth-browser";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import { ADMIN_EMAIL } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import BoardView from "@/components/BoardView";
import DashboardView from "@/components/DashboardView";

const TABS = ["List","Board","Dashboard"];

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

function SortHeader({ label, sk, sortKey, sortDir, onSort, className }: {
  label: string; sk: import("@/components/SortDropdown").SortKey;
  sortKey: import("@/components/SortDropdown").SortKey; sortDir: "asc"|"desc";
  onSort: (k: import("@/components/SortDropdown").SortKey) => void; className?: string;
}) {
  const active = sortKey === sk;
  return (
    <button onClick={() => onSort(sk)} className={`flex items-center gap-1 text-xs font-medium hover:text-[#151B26] transition-colors ${active ? "text-[#4573D9]" : "text-[#6B6F76]"} ${className ?? ""}`}>
      {label}
      {active ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={10} className="opacity-30" />}
    </button>
  );
}

export default function TaskList({ projectId, userEmail }: { projectId: string; userEmail?: string }) {
  const router = useRouter();
  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "??";
  const isAdmin = userEmail === ADMIN_EMAIL;

  const {
    project, sections, tasks, columnConfigs, loading, error,
    updateProjectLocal,
    addSection, updateSection, deleteSection, duplicateSection,
    addTask, updateTask, toggleTask, duplicateTask, deleteTask,
    addAttachment, removeAttachment,
    updateColumnConfig,
  } = useProject(projectId);

  const { lockPriorities, taskTypes } = useAdminSettings();
  const { updateProject } = useStore();

  const [userRole, setUserRole]               = useState<"lead" | "member">("member");
  const canManage = isAdmin || userRole === "lead";

  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  const [openSectionMenu, setOpenSectionMenu] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showMembers, setShowMembers]         = useState(false);
  const [showImport, setShowImport]           = useState(false);
  const [copyToast, setCopyToast]             = useState(false);

  const [activeTab, setActiveTab]             = useState<"List"|"Board"|"Dashboard">("List");
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
  const [sortDir, setSortDir]             = useState<"asc"|"desc">("asc");

  const handleColSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const [members, setMembers]             = useState<{ id: string; email: string; name?: string }[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`).then(r => r.json()).then(d => {
      const mbs = d.members ?? [];
      setMembers(mbs);
      if (!isAdmin && userEmail) {
        const me = mbs.find((m: { email: string; role: string }) => m.email === userEmail);
        if (me) setUserRole(me.role as "lead" | "member");
      }
    });
  }, [projectId, isAdmin, userEmail]);

  const [addingIn, setAddingIn]           = useState<string | null>(null);
  const [newTaskName, setNewTaskName]     = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const dateInputRef     = useRef<HTMLInputElement>(null);
  const searchInputRef   = useRef<HTMLInputElement>(null);
const [renamingSection, setRenamingSection]   = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const scrollRef       = useRef<HTMLDivElement>(null);
  const scrollTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`bt_collapsed_${projectId}`);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const toggleCollapse = (id: string) => setCollapsedSections(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    try { localStorage.setItem(`bt_collapsed_${projectId}`, JSON.stringify([...next])); } catch {}
    return next;
  });
  const collapseAll = () => setCollapsedSections(() => {
    const next = new Set(sections.map(s => s.id));
    try { localStorage.setItem(`bt_collapsed_${projectId}`, JSON.stringify([...next])); } catch {}
    return next;
  });
  const expandAll = () => setCollapsedSections(() => {
    try { localStorage.setItem(`bt_collapsed_${projectId}`, JSON.stringify([])); } catch {}
    return new Set();
  });
  const [editingTaskId, setEditingTaskId]       = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName]   = useState("");

  // Restore scroll position after data finishes loading
  useEffect(() => {
    if (loading) return;
    const saved = localStorage.getItem(`bt_scroll_${projectId}`);
    if (!saved || !scrollRef.current) return;
    const top = Number(saved);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = top; });
  }, [loading, projectId]);

  // ESC closes task detail panel, then clears selection, then closes search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddTaskMenu) { setShowAddTaskMenu(false); return; }
        if (openSectionMenu) { setOpenSectionMenu(null); return; }
        if (selectedTaskId) { setSelectedTaskId(null); return; }
        if (selectedIds.size > 0) { setSelectedIds(new Set()); return; }
        if (showSearch) { setSearchQuery(""); setShowSearch(false); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTaskId, selectedIds, showSearch, showAddTaskMenu, openSectionMenu]);

  useEffect(() => {
    if (!openSectionMenu && !showAddTaskMenu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-section-menu]") && !t.closest("[data-addtask-menu]")) {
        setOpenSectionMenu(null);
        setHoveredSection(null);
        setShowAddTaskMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openSectionMenu, showAddTaskMenu]);

  const visibleCols = columnConfigs.filter(c => c.visible).map(c => c.column_key as ColumnKey);

  const filteredTasks = useMemo(() => {
    let r = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(t => t.name.toLowerCase().includes(q));
    }
    if (activeFilters.incomplete && !activeFilters.completed)  r = r.filter(t => !t.completed);
    if (activeFilters.completed  && !activeFilters.incomplete) r = r.filter(t =>  t.completed);
    if (activeFilters.justMyTasks)  r = r.filter(t => t.assignee === userEmail);
    if (activeFilters.dueThisWeek) { const { start, end } = getWeekRange(0); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (activeFilters.dueNextWeek) { const { start, end } = getWeekRange(1); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (activeFilters.statuses.length)   r = r.filter(t => activeFilters.statuses.includes(t.status ?? ""));
    if (activeFilters.priorities.length) r = r.filter(t => activeFilters.priorities.includes(t.priority ?? ""));
    if (activeFilters.taskTypes.length)  r = r.filter(t => activeFilters.taskTypes.includes(t.task_type ?? ""));
    if (activeFilters.assignees.length)  r = r.filter(t => activeFilters.assignees.includes(t.assignee ?? ""));
    if (sortKey !== "none") r = [...r].sort((a, b) => {
      const rank: Record<string, number> = { show_stopper: 0, high: 1, medium: 2, low: 3 };
      let v = 0;
      switch (sortKey) {
        case "alphabetical":   v = a.name.localeCompare(b.name); break;
        case "dueDate":        v = (a.due_date ?? "").localeCompare(b.due_date ?? ""); break;
        case "assignee":       v = (a.assignee ?? "").localeCompare(b.assignee ?? ""); break;
        case "createdAt":      v = a.created_at.localeCompare(b.created_at); break;
        case "lastModifiedAt": v = a.updated_at.localeCompare(b.updated_at); break;
        case "completedAt":    v = (a.completed_at ?? "").localeCompare(b.completed_at ?? ""); break;
        case "priority":       v = (rank[a.priority ?? ""] ?? 4) - (rank[b.priority ?? ""] ?? 4); break;
        default: v = 0;
      }
      return sortDir === "asc" ? v : -v;
    });
    else r = [...r].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return r;
  }, [tasks, activeFilters, sortKey, sortDir, searchQuery]);

  const lastClickedRef = useRef<string | null>(null);

  const orderedTaskIds = useMemo(() => {
    const unsectioned = filteredTasks.filter(t => !t.section_id).map(t => t.id);
    const sectioned = [...sections]
      .sort((a, b) => a.position - b.position)
      .flatMap(s => filteredTasks.filter(t => t.section_id === s.id).map(t => t.id));
    return [...unsectioned, ...sectioned];
  }, [filteredTasks, sections]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedRef.current) {
      const startIdx = orderedTaskIds.indexOf(lastClickedRef.current);
      const endIdx = orderedTaskIds.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = orderedTaskIds.slice(from, to + 1);
        setSelectedIds(prev => { const next = new Set(prev); rangeIds.forEach(rid => next.add(rid)); return next; });
        return;
      }
    }
    lastClickedRef.current = id;
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
    await addTask(sectionId, name, newTaskDueDate || undefined);
    setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null);
  };

  const commitAndOpen = async (sectionId: string) => {
    const task = await addTask(sectionId, newTaskName.trim(), newTaskDueDate || undefined);
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
    if (type === "csv")   exportToCSV(project, sections, filteredTasks, taskTypes);
    if (type === "excel") await exportToExcel(project, sections, filteredTasks, taskTypes);
    if (type === "pdf")   await exportToPDF(project, sections, filteredTasks, taskTypes);
    if (type === "json")  exportToJSON(project, sections, filteredTasks);
  };

  const filterActive = activeFilters.incomplete || activeFilters.completed || activeFilters.justMyTasks ||
    activeFilters.dueThisWeek || activeFilters.dueNextWeek ||
    activeFilters.statuses.length > 0 || activeFilters.priorities.length > 0 ||
    activeFilters.taskTypes.length > 0 || activeFilters.assignees.length > 0;

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
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 bg-white border-b border-[#E8E8E9] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: project.icon_bg }}>
            {project.name[0]}
          </div>
          <button onClick={openProjectMenu} className="flex items-center gap-1 text-base sm:text-xl font-bold text-[#151B26] hover:bg-[#F5F5F5] px-1 sm:px-2 py-1 rounded min-w-0 truncate">
            <span className="truncate">{project.name}</span> <ChevronDown size={18} className="flex-shrink-0" />
          </button>
          <button className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded hidden sm:flex"><Star size={16} /></button>
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#6B6F76] rounded-full hover:bg-[#F5F5F5]">
            ○ Set status <ChevronDown size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            {isAdmin ? (
              <Link href="/projects" title={userEmail} className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold hover:opacity-80">{userInitials}</Link>
            ) : (
              <div title={userEmail} className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold cursor-default">{userInitials}</div>
            )}
            <button onClick={handleLogout} className="px-2 py-1 text-xs text-[#6B6F76] border border-[#E8E8E9] rounded hover:bg-[#F5F5F5]">Logout</button>
          </div>
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
            <Share2 size={13} /> Share
          </button>
          <button onClick={() => { setShowCustomize(true); setSelectedTaskId(null); setShowColumns(false); }} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]">
            <Settings2 size={13} /> Customize
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-3 sm:px-6 bg-white border-b border-[#E8E8E9] flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as "List"|"Board"|"Dashboard")} className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${tab === activeTab ? "font-semibold text-[#151B26] border-b-2 border-[#151B26]" : "text-[#6B6F76] hover:text-[#151B26]"}`}>{tab}</button>
        ))}
        <button className="px-3 py-2.5 text-sm text-[#6B6F76] hover:text-[#151B26]">+</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-white border-b border-[#E8E8E9] flex-shrink-0 gap-3">
        {/* Add task split button */}
        <div className="relative flex items-center flex-shrink-0">
          <div className="flex items-center border border-[#D0D2D6] rounded-md">
            <button
              onClick={async () => {
                const task = await addTask(null, "");
                if (task) { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }
              }}
              className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm text-[#151B26] hover:bg-[#F5F5F5] rounded-l-md"
            >
              <Plus size={14} className="text-[#6B6F76]" /> Add task
            </button>
            <div className="w-px h-5 bg-[#D0D2D6] flex-shrink-0" />
            <button
              onClick={e => { e.stopPropagation(); setShowAddTaskMenu(v => !v); }}
              className="flex items-center px-1.5 py-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-r-md"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          {showAddTaskMenu && (
            <div data-addtask-menu className="absolute left-0 top-full mt-1 w-52 bg-white border border-[#E8E8E9] rounded-xl shadow-lg py-1 z-50">
              <button
                onClick={async () => {
                  setShowAddTaskMenu(false);
                  const task = await addTask(null, "");
                  if (task) { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5] rounded-lg mx-1" style={{ width: "calc(100% - 8px)" }}
              >
                <span className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke="#4573D9" strokeWidth="1.5"/><path d="M5 7.5L7 9.5L10 6" stroke="#4573D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Task
                </span>
                <span className="text-xs text-[#B0B3B8]">Default</span>
              </button>
              <button disabled className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#B0B3B8] cursor-not-allowed mx-1" style={{ width: "calc(100% - 8px)" }}>
                <span className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke="#D0D2D6" strokeWidth="1.5"/></svg>
                  Approval
                </span>
              </button>
              <button disabled className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#B0B3B8] cursor-not-allowed mx-1" style={{ width: "calc(100% - 8px)" }}>
                <span className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" stroke="#D0D2D6" strokeWidth="1.5"/></svg>
                  Milestone
                </span>
              </button>
              <div className="my-1 border-t border-[#F0F1F3]" />
              <button
                onClick={async () => {
                  setShowAddTaskMenu(false);
                  const s = await addSection();
                  if (s) { setRenamingSection(s.id); setSectionNameDraft(s.name); }
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5] rounded-lg mx-1" style={{ width: "calc(100% - 8px)" }}
              >
                <span className="flex items-center gap-2">
                  <svg width="15" height="4" viewBox="0 0 15 4" fill="none"><rect y="0" width="15" height="1.5" rx="0.75" fill="#6B6F76"/><rect y="2.5" width="15" height="1.5" rx="0.75" fill="#6B6F76"/></svg>
                  Section
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] bg-[#F0F1F3] text-[#6B6F76] px-1.5 py-0.5 rounded font-medium">Tab</span>
                  <span className="text-[10px] bg-[#F0F1F3] text-[#6B6F76] px-1.5 py-0.5 rounded font-medium">N</span>
                </span>
              </button>
            </div>
          )}
        </div>
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
            {showFilter && <FilterPanel filters={activeFilters} onChange={setActiveFilters} onClose={() => setShowFilter(false)} members={members} />}
          </div>
          <div className="relative">
            <button onClick={() => { setShowSort(v => !v); setShowFilter(false); }} className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${sortKey !== "none" ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
              <ArrowUpDown size={14} /> Sort{sortKey !== "none" ? " •" : ""}
            </button>
            {showSort && <SortDropdown current={sortKey} onChange={setSortKey} onClose={() => setShowSort(false)} />}
          </div>
          <button className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><MoreHorizontal size={14} /> Group</button>
          <button onClick={expandAll} title="Expand all sections" className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded">
            <ChevronsUpDown size={14} /> Expand
          </button>
          <button onClick={collapseAll} title="Collapse all sections" className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded">
            <ChevronsDownUp size={14} /> Collapse
          </button>
          <button onClick={() => { setShowColumns(v => !v); setShowCustomize(false); setSelectedTaskId(null); }} className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${showColumns ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
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
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto flex items-center gap-1 text-white/60 hover:text-white" title="Deselect all (Esc)">
            <X size={14} /> Deselect all
          </button>
        </div>
      )}

      {activeTab === "Board" && (
        <BoardView
          tasks={filteredTasks} sections={sections} projectId={projectId}
          onOpenTask={id => setSelectedTaskId(id)}
          addTask={addTask} updateTask={updateTask}
        />
      )}
      {activeTab === "Dashboard" && (
        <DashboardView tasks={filteredTasks} sections={sections} />
      )}

      {/* Table */}
      {activeTab === "List" && <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onMouseDown={e => { if (e.shiftKey) e.preventDefault(); }}
        onScroll={() => {
          if (scrollTimer.current) clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(() => {
            try { localStorage.setItem(`bt_scroll_${projectId}`, String(scrollRef.current?.scrollTop ?? 0)); } catch {}
          }, 150);
        }}
      >
        {/* Column headers */}
        <div className="flex items-center px-3 sm:px-6 py-2 border-b border-[#E8E8E9] sticky top-0 bg-[#FAFBFC] z-10">
          <div className="w-5 mr-2 flex-shrink-0" />
          <SortHeader label="Name"          sk="alphabetical"   sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="flex-1 border-r border-[#E8E8E9] pr-3" />
          {visibleCols.includes("status")           && <div className="hidden sm:block w-32 text-xs font-medium text-[#6B6F76] border-r border-[#E8E8E9] pl-3">Status</div>}
          {visibleCols.includes("assignee")         && <SortHeader label="Assignee"    sk="assignee"      sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("due_date")         && <SortHeader label="Due date"    sk="dueDate"       sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("priority")         && <SortHeader label="Priority"    sk="priority"      sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("task_type")        && <div className="hidden sm:block w-32 text-xs font-medium text-[#6B6F76] border-r border-[#E8E8E9] pl-3">Task Type</div>}
          {visibleCols.includes("created_on")       && <SortHeader label="Created on"  sk="createdAt"     sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("last_modified_on") && <SortHeader label="Last modified" sk="lastModifiedAt" sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("completed_on")     && <SortHeader label="Completed on" sk="completedAt"  sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          <div className="w-8 text-xs text-[#4573D9] cursor-pointer hidden sm:block">+</div>
        </div>

        {/* Filter/search info bar */}
        {(filterActive || sortKey !== "none" || searchQuery) && (
          <div className="px-6 py-1.5 bg-[#EEF2FB] border-b border-[#E8E8E9] flex items-center gap-2">
            <span className="text-xs text-[#4573D9]">Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <button onClick={() => { setActiveFilters(DEFAULT_FILTERS); setSortKey("none"); setSearchQuery(""); }} className="text-xs text-[#4573D9] underline">Clear all</button>
          </div>
        )}

        {/* Unsectioned tasks */}
        {filteredTasks.filter(t => !t.section_id).map(task => {
          const isSelected = selectedIds.has(task.id);
          return (
            <div
              key={task.id}
              className={`flex items-center px-3 sm:px-6 py-1 border-b border-[#E8E8E9] hover:bg-[#F5F5F5] group cursor-default ${selectedTaskId === task.id || isSelected ? "bg-[#F5F5F5]" : ""}`}
              onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
            >
              <div onClick={e => toggleSelect(task.id, e)} className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mr-2 cursor-pointer transition-colors ${isSelected ? "bg-[#4573D9] border-[#4573D9]" : "border-[#B0B3B8] hover:border-[#4573D9] group-hover:border-[#4573D9]"}`}>
                {isSelected && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2.5" fill="white"/></svg>}
              </div>
              <div className="flex-1 text-sm min-w-0 py-0.5 flex items-center sm:border-r border-[#E8E8E9]">
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 cursor-pointer py-0.5 pl-0 pr-1" onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}>
                  {editingTaskId === task.id ? (
                    <input autoFocus value={editingTaskName} onChange={e => setEditingTaskName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { deleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}}
                      onBlur={() => { if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { deleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}
                      className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]" onClick={e => e.stopPropagation()} />
                  ) : (
                    <>
                      <span className={`min-w-0 truncate cursor-text ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}
                        onClick={e => { if (!task.name) return; e.stopPropagation(); setEditingTaskId(task.id); setEditingTaskName(task.name); }}>
                        {task.name}
                      </span>
                      <span className="sm:hidden text-[10px] text-[#6B6F76] bg-[#F3F4F6] px-1.5 py-0.5 rounded w-fit">{task.status?.replace(/_/g," ")}</span>
                    </>
                  )}
                </div>
                <button
                  className="flex-shrink-0 p-1 mr-1 text-[#B0B3B8] hover:text-[#4573D9] hover:bg-[#EEF2FB] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                  title="Open detail"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              {visibleCols.includes("status") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><StatusBadge compact value={task.status} onChange={v => updateTaskOrBulk(task.id, { status: v })} /></div>}
              {visibleCols.includes("assignee") && (
                <div className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                  <select value={task.assignee ?? ""} onChange={e => updateTaskOrBulk(task.id, { assignee: e.target.value || null })}
                    className="w-full text-xs text-[#151B26] bg-transparent border-0 outline-none cursor-pointer hover:bg-[#F5F5F5] rounded px-1 py-0.5">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.email}>{m.name ?? m.email}</option>)}
                  </select>
                </div>
              )}
              {visibleCols.includes("due_date") && (
                <div className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                  <div className="relative inline-flex items-center gap-1 cursor-pointer">
                    {task.due_date && <span className="text-xs text-[#6B6F76]">{fmtDate(task.due_date)}</span>}
                    <div className={`relative ${task.due_date ? "" : "opacity-0 group-hover:opacity-100"}`}>
                      <Calendar size={13} className="text-[#6B6F76]" />
                      <input type="date" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.due_date ?? ""} onChange={e => updateTaskOrBulk(task.id, { due_date: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}
              {visibleCols.includes("priority") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><PriorityBadge compact value={task.priority ?? "high"} onChange={v => updateTaskOrBulk(task.id, { priority: v })} disabled={lockPriorities && !isAdmin} /></div>}
              {visibleCols.includes("task_type") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><TaskTypeBadge compact value={task.task_type ?? "bug"} onChange={v => updateTaskOrBulk(task.id, { task_type: v })} /></div>}
              {visibleCols.includes("created_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.created_at)}</span></div>}
              {visibleCols.includes("last_modified_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.updated_at)}</span></div>}
              {visibleCols.includes("completed_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.completed_at)}</span></div>}
              <div className="w-8 hidden sm:block" />
            </div>
          );
        })}

        {/* Sections + tasks */}
        {sections.map(section => {
          const sectionTasks = filteredTasks.filter(t => t.section_id === section.id);
          const isSearchActive = searchQuery.trim() !== "" || filteredTasks.length !== tasks.length;
          const collapsed = isSearchActive ? false : collapsedSections.has(section.id);
          if (isSearchActive && sectionTasks.length === 0) return null;
          return (
            <div key={section.id} className="mt-3">
              {/* Section header */}
              <div
                className="flex items-center px-3 sm:px-6 py-1.5 border-y border-[#E8E8E9] bg-[#FAFBFC]"
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => { if (openSectionMenu !== section.id) setHoveredSection(null); }}
              >
                <button onClick={() => toggleCollapse(section.id)} className="mr-1.5 text-[#6B6F76] hover:text-[#151B26] flex-shrink-0 text-[10px] leading-none">
                  {collapsed ? "▶" : "▼"}
                </button>
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
                <span className="ml-2 text-xs text-[#B0B3B8]">{sectionTasks.length}</span>
                <div
                  data-section-menu
                  className="ml-3 flex items-center gap-1 relative"
                  style={{ opacity: hoveredSection === section.id || openSectionMenu === section.id ? 1 : 0 }}
                >
                  <button onClick={() => setAddingIn(section.id)} className="p-1 text-[#6B6F76] hover:bg-[#F0F1F3] rounded" title="Add task"><Plus size={13} /></button>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenSectionMenu(openSectionMenu === section.id ? null : section.id); }}
                    className={`p-1 rounded ${openSectionMenu === section.id ? "bg-[#F0F1F3] text-[#151B26]" : "text-[#6B6F76] hover:bg-[#F0F1F3]"}`}
                    title="Section options"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                  {openSectionMenu === section.id && (
                    <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#E8E8E9] rounded-xl shadow-lg py-1.5 z-50">
                      {/* Rename */}
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5]"
                        onClick={() => { setOpenSectionMenu(null); setRenamingSection(section.id); setSectionNameDraft(section.name); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2-7 7H2.5V9l7-6.5z" stroke="#6B6F76" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        Rename section
                      </button>
                      {/* Add section below */}
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5]"
                        onClick={async () => { setOpenSectionMenu(null); const s = await addSection(); if (s) { setRenamingSection(s.id); setSectionNameDraft(s.name); } }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect y="2" width="14" height="1.5" rx="0.75" fill="#6B6F76"/><rect y="6.25" width="14" height="1.5" rx="0.75" fill="#6B6F76"/><rect y="10.5" width="14" height="1.5" rx="0.75" fill="#6B6F76"/></svg>
                        Add section below
                      </button>
                      {/* Duplicate */}
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5]"
                        onClick={async () => { setOpenSectionMenu(null); await duplicateSection(section.id); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="9" rx="1" stroke="#6B6F76" strokeWidth="1.2"/><path d="M2 10V2a1 1 0 011-1h7" stroke="#6B6F76" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Duplicate section
                      </button>
                      <div className="my-1 border-t border-[#F0F1F3]" />
                      {/* Delete */}
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#E5534B] hover:bg-[#FFF5F5]"
                        onClick={async () => { setOpenSectionMenu(null); await deleteSection(section.id); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M11.5 3.5l-.8 8a1 1 0 01-1 .9H4.3a1 1 0 01-1-.9l-.8-8" stroke="#E5534B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Delete section
                        <span className="ml-auto text-[10px] text-[#B0B3B8]">tasks → default</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Task rows */}
              {!collapsed && sectionTasks.map(task => {
                const isSelected = selectedIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center px-3 sm:px-6 py-1 border-b border-[#E8E8E9] hover:bg-[#F5F5F5] group cursor-default ${selectedTaskId === task.id || isSelected ? "bg-[#F5F5F5]" : ""}`}
                    onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
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

                    {/* Task name column: click text = inline edit, › button = open detail */}
                    <div className="flex-1 text-sm min-w-0 py-1 flex items-center sm:border-r border-[#E8E8E9]">
                      <div
                        className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 cursor-pointer pr-1"
                        onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                      >
                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            value={editingTaskName}
                            onChange={e => setEditingTaskName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { deleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }
                            }}
                            onBlur={() => { if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { deleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}
                            className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span
                              className={`min-w-0 truncate cursor-text ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}
                              onClick={e => { if (!task.name) return; e.stopPropagation(); setEditingTaskId(task.id); setEditingTaskName(task.name); }}
                            >
                              {task.name}
                            </span>
                            {(task.BT_attachments?.length ?? 0) > 0 && (
                              <span className="text-xs text-[#6B6F76] shrink-0" onClick={e => e.stopPropagation()}>📎 {task.BT_attachments!.length}</span>
                            )}
                            <span className="sm:hidden text-[10px] text-[#6B6F76] bg-[#F3F4F6] px-1.5 py-0.5 rounded w-fit">{task.status?.replace(/_/g," ")}</span>
                          </>
                        )}
                      </div>
                      <button
                        className="flex-shrink-0 p-1 mr-1 text-[#B0B3B8] hover:text-[#4573D9] hover:bg-[#EEF2FB] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                        title="Open detail"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {visibleCols.includes("status") && (
                      <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                        <StatusBadge compact value={task.status} onChange={v => updateTaskOrBulk(task.id, { status: v })} />
                      </div>
                    )}
                    {visibleCols.includes("assignee") && (
                      <div className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                        <select value={task.assignee ?? ""} onChange={e => updateTaskOrBulk(task.id, { assignee: e.target.value || null })} className="w-full text-xs text-[#151B26] bg-transparent border-0 outline-none cursor-pointer hover:bg-[#F5F5F5] rounded px-1 py-0.5">
                          <option value="">Unassigned</option>
                          {members.map(m => <option key={m.id} value={m.email}>{m.name ?? m.email}</option>)}
                        </select>
                      </div>
                    )}
                    {visibleCols.includes("due_date") && (
                      <div className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-flex items-center gap-1 cursor-pointer">
                          {task.due_date && <span className="text-xs text-[#6B6F76]">{fmtDate(task.due_date)}</span>}
                          <div className={`relative ${task.due_date ? "" : "opacity-0 group-hover:opacity-100"}`}>
                            <Calendar size={13} className="text-[#6B6F76]" />
                            <input type="date" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={task.due_date ?? ""} onChange={e => updateTaskOrBulk(task.id, { due_date: e.target.value || null })} />
                          </div>
                        </div>
                      </div>
                    )}
                    {visibleCols.includes("priority") && (
                      <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                        <PriorityBadge compact value={task.priority ?? "high"} onChange={v => updateTaskOrBulk(task.id, { priority: v })} disabled={lockPriorities && !isAdmin} />
                      </div>
                    )}
                    {visibleCols.includes("task_type") && (
                      <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}>
                        <TaskTypeBadge compact value={task.task_type ?? "bug"} onChange={v => updateTaskOrBulk(task.id, { task_type: v })} />
                      </div>
                    )}
                    {visibleCols.includes("created_on") && (
                      <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.created_at)}</span></div>
                    )}
                    {visibleCols.includes("last_modified_on") && (
                      <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.updated_at)}</span></div>
                    )}
                    {visibleCols.includes("completed_on") && (
                      <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.completed_at)}</span></div>
                    )}
                    <div className="w-8 hidden sm:block" />
                  </div>
                );
              })}

              {/* Inline add task */}
              {!collapsed && addingIn === section.id ? (
                <div className="flex items-center px-3 sm:px-6 py-2 border-b border-[#E8E8E9] bg-white gap-2">
                  <div className="w-4 h-4 rounded-full border border-[#B0B3B8] flex-shrink-0" />
                  <div
                    className="flex-1 flex items-center cursor-pointer"
                    onMouseDown={e => e.preventDefault()}
                    onClick={async () => { await commitAndOpen(section.id); }}
                  >
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
                      placeholder="Write task here"
                      className="text-sm outline-none text-[#151B26] placeholder-[#6B6F76] shrink-0 bg-transparent"
                      style={{ width: newTaskName ? `${newTaskName.length + 1}ch` : "10ch" }}
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex-1 h-full min-h-[24px]" />
                  </div>
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
              ) : !collapsed ? (
                <div
                  className="flex items-center px-3 sm:px-6 py-2 border-b border-[#E8E8E9] cursor-pointer hover:bg-[#F5F5F5] group/add"
                  onClick={() => setAddingIn(section.id)}
                >
                  <div className="w-4 h-4 rounded-full border border-[#E8E8E9] mr-2 flex-shrink-0 group-hover/add:border-[#4573D9]" />
                  <span className="text-sm text-[#9EA3AA] group-hover/add:text-[#4573D9]">Add task...</span>
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Add section */}
        <div className="px-6 py-3">
          <button
            onClick={async () => { const s = await addSection(); if (s) { setRenamingSection(s.id); setSectionNameDraft(s.name); } }}
            className="flex items-center gap-1.5 text-sm text-[#6B6F76] hover:text-[#151B26]"
          >
            <Plus size={14} /> Add section
          </button>
        </div>
      </div>}

      {/* Panels */}
      {selectedTaskId && (() => {
        const t = tasks.find(x => x.id === selectedTaskId);
        return t ? (
          <TaskDetailPanel
            key={selectedTaskId}
            task={t}
            tasks={filteredTasks}
            projectId={projectId}
            projectName={project.name}
            projectColor={project.icon_bg}
            sections={sections}
            onClose={() => setSelectedTaskId(null)}
            updateTask={updateTask}
            toggleTask={toggleTask}
            duplicateTask={duplicateTask}
            deleteTask={deleteTask}
            addTask={addTask}
            onOpenTask={id => { setSelectedTaskId(id); }}
            addAttachment={addAttachment}
            removeAttachment={removeAttachment}
            userEmail={userEmail}
            isAdmin={isAdmin}
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
          canManage={canManage}
          position={projectMenuPos}
          onExport={handleExport}
          onEditSettings={() => setShowEditProject(true)}
          onManageMembers={() => setShowMembers(true)}
          onCopyLink={() => {
            navigator.clipboard.writeText(`${window.location.origin}/projects/${project.id}`);
            setCopyToast(true);
            setTimeout(() => setCopyToast(false), 2000);
          }}
          onDuplicate={async () => {
            const r = await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
            const d = await r.json();
            if (d.project) { updateProject(d.project); router.push(`/projects/${d.project.id}`); }
          }}
          onImport={() => setShowImport(true)}
          onToggleActive={async () => {
            const r = await fetch(`/api/projects/${project.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ is_active: !project.is_active }),
            });
            const d = await r.json();
            if (d.project) { updateProject(d.project); updateProjectLocal(d.project); }
          }}
          onClose={() => setShowProjectMenu(false)}
        />
      )}
      {showEditProject && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onSaved={p => { updateProject(p); updateProjectLocal(p); }}
        />
      )}
      {showMembers && (
        <MembersPanel
          projectId={project.id}
          canManage={canManage}
          onClose={() => setShowMembers(false)}
        />
      )}
      {showImport && (
        <ImportModal
          projectId={project.id}
          onClose={() => setShowImport(false)}
          onImported={() => window.location.reload()}
        />
      )}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#151B26] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[200]">
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
