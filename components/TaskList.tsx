"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Star, ChevronDown, ChevronRight, ChevronUp, Share2, Settings2, Filter, ArrowUpDown,
  Search, Plus, User, Calendar, MoreHorizontal, Loader2, X, ChevronsUpDown, ChevronsDownUp,
  FolderInput, Trash2,
} from "lucide-react";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import CustomizePanel from "@/components/CustomizePanel";
import ProjectDropdownMenu, { type ExportType, type SectionExportFilter } from "@/components/ProjectDropdownMenu";
import EditProjectModal from "@/components/EditProjectModal";
import FilterPanel, { type ActiveFilters, DEFAULT_FILTERS } from "@/components/FilterPanel";
import SortDropdown, { type SortKey } from "@/components/SortDropdown";
import ShowHideColumns from "@/components/ShowHideColumns";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import TaskTypeBadge from "@/components/TaskTypeBadge";
import { useProject, type InitialProjectData } from "@/hooks/useProject";
import type { ColumnKey, Task } from "@/lib/data";
import { exportToCSV, exportToExcel, exportToExcelAttachmentsOnly, exportToPDF, exportToJSON } from "@/lib/exportUtils";
import { createSupabaseBrowser } from "@/lib/auth-browser";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import { ADMIN_EMAIL } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

// Lazy-loaded: these pull in heavy libs (dnd-kit, recharts) or are only shown
// on demand (modals/panels), so keep them out of the initial TaskList bundle —
// the List view (the default) shouldn't have to wait on Board/Dashboard code.
const ViewLoading = () => (
  <div className="flex-1 flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-[#9EA3AA]" /></div>
);
const BoardView        = dynamic(() => import("@/components/BoardView"),        { loading: ViewLoading });
const DashboardView    = dynamic(() => import("@/components/DashboardView"),    { loading: ViewLoading });
const CalendarView     = dynamic(() => import("@/components/CalendarView"),     { loading: ViewLoading });
const GanttView        = dynamic(() => import("@/components/GanttView"),        { loading: ViewLoading });
const MembersPanel     = dynamic(() => import("@/components/MembersPanel"));
const ImportModal      = dynamic(() => import("@/components/ImportModal"));
const InboxPanel       = dynamic(() => import("@/components/InboxPanel"));
const TrashPanel        = dynamic(() => import("@/components/TrashPanel"));
const ShareProjectModal = dynamic(() => import("@/components/ShareProjectModal"));

const TABS = ["List","Board","Calendar","Gantt","Dashboard"];

// Shapes returned by the /api/jira/* routes. `created` vs `skipped` matters:
// counting skipped rows as created is what made the old totals wrong.
type JiraExportResult = { taskId?: string; taskName?: string; jiraKey?: string; created?: boolean; updated?: boolean; unlinked?: boolean; degraded?: boolean; statusPushed?: string; error?: string };
type JiraSyncResult   = { taskId?: string; taskName?: string; jiraKey?: string; updated?: boolean; checked?: boolean; unlinked?: boolean; error?: string };

// A failing task stays pending, so it is retried in every batch and appears in the results
// once per attempt. Collapse by taskId so counts reflect distinct tasks, not attempts —
// otherwise 11 dead issues over 5 batches get reported as "55 failed".
type JiraRow = { taskId?: string; taskName?: string; error?: string };
function distinctFailures<T extends JiraRow>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) {
    if (!r.error) continue;
    seen.set(r.taskId ?? r.taskName ?? String(seen.size), r);
  }
  return [...seen.values()];
}

// Failures were only ever reported as a count, which made them impossible to act on.
// Show what actually went wrong, capped so the dialog stays readable.
function describeJiraFailures(rows: JiraRow[]): string {
  const failed = distinctFailures(rows);
  if (!failed.length) return "";
  const shown = failed.slice(0, 5)
    .map(r => `• ${(r.taskName ?? "Untitled").slice(0, 60)} — ${r.error}`)
    .join("\n");
  return `\n\nFailures:\n${shown}${failed.length > 5 ? `\n…and ${failed.length - 5} more` : ""}`;
}

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
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const hh = h % 12 || 12, mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0"), ampm = h >= 12 ? "PM" : "AM";
  // Seconds included (not just h:mm) so rows created moments apart — e.g. via paste-many-lines
  // or a project duplicate — stay visually distinguishable when sorted by one of these columns.
  return `${fmtDate(iso)}, ${hh}:${mm}:${ss} ${ampm}`;
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

export default function TaskList({ projectId, userEmail, initialData }: { projectId: string; userEmail?: string; initialData?: InitialProjectData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleFavorite = async () => {
    if (!project) return;
    const next = !isFavorite;
    setIsFavorite(next);
    const sb = createSupabaseBrowser();
    await sb.from("BT_projects").update({ is_favorite: next }).eq("id", project.id);
  };

  const PROJECT_STATUSES = [
    { key: "on_track",  label: "On track",  color: "#14A454" },
    { key: "at_risk",   label: "At risk",   color: "#F59E0B" },
    { key: "off_track", label: "Off track", color: "#EF4444" },
  ] as const;

  const handleSetStatus = async (key: string) => {
    if (!project) return;
    setProjectStatus(key);
    setShowStatusMenu(false);
    const sb = createSupabaseBrowser();
    await sb.from("BT_projects").update({ status: key }).eq("id", project.id);
  };

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "??";
  const isAdmin = userEmail === ADMIN_EMAIL;

  const {
    project, sections, tasks, columnConfigs, loading, error,
    updateProjectLocal,
    addSection, addSections, updateSection, deleteSection, duplicateSection,
    addTask, updateTask, updateTaskLocal, toggleTask, duplicateTask, deleteTask, permanentlyDeleteTask,
    fetchDeletedTasks, restoreTask, purgeExpiredTasks,
    addAttachment, removeAttachment,
    updateColumnConfig,
  } = useProject(projectId, userEmail, initialData);

  useEffect(() => {
    document.title = project?.name ? `${project.name} — Bug Tracker` : "Bug Tracker";
    return () => { document.title = "Bug Tracker"; };
  }, [project?.name]);

  const { statuses, lockPriorities, taskTypes, membersCanManageMembers, membersCanExportJira, membersCanExportExcel } = useAdminSettings();
  const { updateProject, deleteProject } = useStore();

  const [userRole, setUserRole]               = useState<"lead" | "member">("member");
  const canManage = isAdmin || (membersCanManageMembers && userRole === "lead");
  const canExport = isAdmin || membersCanExportExcel;

  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  // Positioned via getBoundingClientRect + `fixed` rather than `absolute` — the toolbar row
  // is horizontally scrollable (`overflow-x-auto`), and per the CSS overflow spec, having
  // *any* non-visible overflow-x forces overflow-y to compute as `auto` too, which clips an
  // `absolute` dropdown anchored inside it (it never becomes visible, however it's opened).
  // `fixed` isn't clipped by an ancestor's overflow at all.
  const [addTaskMenuPos, setAddTaskMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [openSectionMenu, setOpenSectionMenu] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showMembers, setShowMembers]         = useState(false);
  const [showImport, setShowImport]           = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateSaving, setTemplateSaving]   = useState(false);
  const [templateSaved, setTemplateSaved]     = useState(false);
  const [copyToast, setCopyToast]             = useState(false);

  const [activeTab, setActiveTab]             = useState<"List"|"Board"|"Calendar"|"Gantt"|"Dashboard">("List");
  const [selectedTaskId, setSelectedTaskId]   = useState<string | null>(() => searchParams.get("task"));
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [showMoveMenu, setShowMoveMenu]       = useState(false);
  const moveMenuRef                           = useRef<HTMLDivElement>(null);
  const [showCustomize, setShowCustomize]     = useState(false);
  const [showColumns, setShowColumns]         = useState(false);
  const [showShare, setShowShare]             = useState(false);
  const [showJiraMenu, setShowJiraMenu]       = useState(false);
  const [jiraWorking, setJiraWorking]         = useState(false);
  const [jiraLoadingMsg, setJiraLoadingMsg]   = useState<string | null>(null);
  const [jiraConfirm, setJiraConfirm]         = useState<{ title: string; body: string; action: () => void; showSkipCompleted?: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog]     = useState<{ title: string; body: string; action: () => void } | null>(null);
  const [jiraKeyInput, setJiraKeyInput]       = useState<string | null>(null);
  // Default true: completed tasks stay out of Jira unless the user unchecks this in the
  // confirm modal. A ref (not just the state) so the action closure — built before the
  // checkbox can be touched — reads whatever the checkbox says at the moment Confirm is clicked.
  const [jiraSkipCompleted, setJiraSkipCompleted] = useState(true);
  const jiraSkipCompletedRef = useRef(true);
  const [showStatusMenu, setShowStatusMenu]   = useState(false);
  const [isFavorite, setIsFavorite]           = useState(project?.is_favorite ?? false);
  const [projectStatus, setProjectStatus]     = useState<string>(project?.status ?? "on_track");
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const currentStatus = PROJECT_STATUSES.find(s => s.key === projectStatus);
  const [showFilter, setShowFilter]           = useState(false);
  const [showSort, setShowSort]               = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectMenuPos, setProjectMenuPos]   = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery]         = useState("");
  const [showSearch, setShowSearch]           = useState(false);
  const [showBulkSections, setShowBulkSections] = useState(false);
  const [showTrash, setShowTrash]             = useState(false);
  const [bulkSectionsText, setBulkSectionsText] = useState("");

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey]             = useState<SortKey>("none");
  const [sortDir, setSortDir]             = useState<"asc"|"desc">("asc");

  // Shared by column-header clicks and the Sort dropdown: picking the already-active
  // key flips direction (asc <-> desc); picking a new key sorts ascending by it;
  // "none" (from the dropdown's "Clear sort") drops back to unsorted/position order.
  const handleColSort = (key: SortKey) => {
    if (key === "none") { setSortKey("none"); return; }
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

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Tasks marked with the "Completed" status are hidden from every view (List/Board/
  // Calendar/Gantt/Dashboard) by default — this toggle reveals them. Persisted per-project
  // so it survives a refresh, same pattern as collapsed sections.
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const toggleShowCompleted = () => setShowCompletedTasks(prev => {
    const next = !prev;
    try { localStorage.setItem(`bt_showcompleted_${projectId}`, next ? "1" : "0"); } catch {}
    return next;
  });

  // List view only: grouping tasks under section headers is the default, but it hides
  // any task not in the section you're currently looking at. Unchecking this flattens
  // every task (still respecting search/filter/sort) into one continuous list so they
  // can all be sorted against each other at once. Persisted per-project like the toggle above.
  const [showSections, setShowSections] = useState(true);

  // These three all default to what the server rendered (no localStorage there) and only
  // pick up the persisted value once mounted client-side — reading localStorage straight in
  // the useState initializer ran during SSR too (where it just throws and falls back), so
  // whenever a persisted value differed from the default, hydration saw two different trees
  // and React tore the whole page down to re-render it client-side.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bt_collapsed_${projectId}`);
      if (saved) setCollapsedSections(new Set(JSON.parse(saved) as string[]));
    } catch {}
    try {
      setShowCompletedTasks(localStorage.getItem(`bt_showcompleted_${projectId}`) === "1");
    } catch {}
    try {
      const savedShowSections = localStorage.getItem(`bt_showsections_${projectId}`);
      if (savedShowSections !== null) setShowSections(savedShowSections !== "0");
    } catch {}
  }, [projectId]);

  const toggleShowSections = () => setShowSections(prev => {
    const next = !prev;
    try { localStorage.setItem(`bt_showsections_${projectId}`, next ? "1" : "0"); } catch {}
    return next;
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
  const expandSection = (id: string) => setCollapsedSections(prev => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    try { localStorage.setItem(`bt_collapsed_${projectId}`, JSON.stringify([...next])); } catch {}
    return next;
  });
  // The inline "add task" row only renders while its section is expanded — clicking + on a
  // collapsed section otherwise set addingIn with nothing on screen to show for it, silently
  // doing nothing from the user's perspective. Expanding here guarantees the row appears.
  const startAddingTask = (sectionId: string) => { expandSection(sectionId); setAddingIn(sectionId); };
  const [editingTaskId, setEditingTaskId]       = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName]   = useState("");

  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft]     = useState("");

  // Restore scroll position after data finishes loading
  useEffect(() => {
    if (loading) return;
    const saved = localStorage.getItem(`bt_scroll_${projectId}`);
    if (!saved || !scrollRef.current) return;
    const top = Number(saved);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = top; });
  }, [loading, projectId]);

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

  useEffect(() => {
    if (!showStatusMenu) return;
    const close = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node))
        setShowStatusMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showStatusMenu]);

  useEffect(() => {
    if (!showMoveMenu) return;
    const close = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node))
        setShowMoveMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMoveMenu]);

  const visibleCols = columnConfigs.filter(c => c.visible).map(c => c.column_key as ColumnKey);

  // filteredTasksBase applies search/filter/sort but not the completed-status hiding, so
  // the export dialog's "include completed" checkbox can decide independently of whatever
  // the on-screen "Show completed" toggle is currently set to.
  const filteredTasksBase = useMemo(() => {
    let r = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(t => t.name.toLowerCase().includes(q) || (t.BT_attachments ?? []).some(a => a.name.toLowerCase().includes(q)));
    }
    if (activeFilters.incomplete && !activeFilters.completed)  r = r.filter(t => !t.completed);
    if (activeFilters.completed  && !activeFilters.incomplete) r = r.filter(t =>  t.completed);
    if (activeFilters.justMyTasks)  r = r.filter(t => t.assignee === userEmail);
    if (activeFilters.dueThisWeek) { const { start, end } = getWeekRange(0); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (activeFilters.dueNextWeek) { const { start, end } = getWeekRange(1); r = r.filter(t => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d <= end; }); }
    if (activeFilters.createdFrom || activeFilters.createdTo) {
      const from = activeFilters.createdFrom ? new Date(activeFilters.createdFrom) : null;
      const to   = activeFilters.createdTo   ? new Date(activeFilters.createdTo)   : null;
      if (to) to.setHours(23, 59, 59, 999);
      r = r.filter(t => {
        if (!t.created_at) return false;
        const d = new Date(t.created_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    if (activeFilters.statuses.length)   r = r.filter(t => activeFilters.statuses.includes(t.status ?? ""));
    if (activeFilters.priorities.length) r = r.filter(t => activeFilters.priorities.includes(t.priority ?? ""));
    if (activeFilters.taskTypes.length)  r = r.filter(t => activeFilters.taskTypes.includes(t.task_type ?? ""));
    if (activeFilters.assignees.length)  r = r.filter(t => activeFilters.assignees.includes(t.assignee ?? ""));
    if (sortKey !== "none") r = [...r].sort((a, b) => {
      const rank: Record<string, number> = { show_stopper: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = (key: string | null | undefined) => statuses.find(s => s.key === key)?.order ?? 99;
      let v = 0;
      switch (sortKey) {
        case "alphabetical":   v = a.name.localeCompare(b.name); break;
        case "dueDate":        v = (a.due_date ?? "").localeCompare(b.due_date ?? ""); break;
        case "assignee":       v = (a.assignee ?? "").localeCompare(b.assignee ?? ""); break;
        case "createdAt":      v = a.created_at.localeCompare(b.created_at); break;
        case "lastModifiedAt": v = a.updated_at.localeCompare(b.updated_at); break;
        case "completedAt":    v = (a.completed_at ?? "").localeCompare(b.completed_at ?? ""); break;
        case "priority":       v = (rank[a.priority ?? ""] ?? 4) - (rank[b.priority ?? ""] ?? 4); break;
        case "status":         v = statusOrder(a.status) - statusOrder(b.status); break;
        default: v = 0;
      }
      return sortDir === "asc" ? v : -v;
    });
    else r = [...r].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return r;
  }, [tasks, activeFilters, sortKey, sortDir, searchQuery, statuses]);

  const completedHiddenCount = useMemo(() =>
    filteredTasksBase.filter(t => t.status === "completed").length,
    [filteredTasksBase]);

  const filteredTasks = useMemo(() =>
    showCompletedTasks ? filteredTasksBase : filteredTasksBase.filter(t => t.status !== "completed"),
    [filteredTasksBase, showCompletedTasks]);

  const sortedSections = useMemo(() =>
    [...sections].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [sections]);

  // Flat (Show Sections off) mode still needs to tell tasks apart by section, so a
  // Section column can label each row even though the grouped headers are gone.
  const sectionNameById = useMemo(() => {
    const m = new Map<string, string>();
    sections.forEach(s => m.set(s.id, s.name));
    return m;
  }, [sections]);

  const lastClickedRef = useRef<string | null>(null);

  // ESC closes task detail panel, then clears selection, then closes search.
  // N creates a task and opens it, / focuses search, J/K move between tasks in the open task's section.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddTaskMenu) { setShowAddTaskMenu(false); return; }
        if (openSectionMenu) { setOpenSectionMenu(null); return; }
        if (showJiraMenu)    { setShowJiraMenu(false); return; }
        if (selectedTaskId) { setSelectedTaskId(null); return; }
        if (selectedIds.size > 0) { setSelectedIds(new Set()); return; }
        if (showSearch) { setSearchQuery(""); setShowSearch(false); }
        return;
      }

      // Force any pending edit (e.g. an unsaved title draft) to commit via its blur handler
      // before we swap selectedTaskId — switching tasks via keyboard never fires a natural blur.
      const flushPendingEdit = () => { (document.activeElement as HTMLElement | null)?.blur(); };

      const createTask = () => {
        flushPendingEdit();
        const activeId = selectedTaskId ?? lastClickedRef.current;
        const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
        addTask(activeTask?.section_id ?? null, "").then(t => { if (t) setSelectedTaskId(t.id); });
      };

      // Alt+N always creates a task, regardless of what's focused
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        createTask();
        return;
      }

      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (typing) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        createTask();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setShowSearch(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }
      if ((e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K") && selectedTaskId) {
        e.preventDefault();
        const current = filteredTasks.find(t => t.id === selectedTaskId);
        if (!current) return;
        // With sections hidden there's no section to stay within — move through the whole flat list.
        const scope = showSections ? filteredTasks.filter(t => t.section_id === current.section_id) : filteredTasks;
        const idx = scope.findIndex(t => t.id === selectedTaskId);
        const isDown = e.key === "j" || e.key === "J";
        const target2 = isDown ? scope[idx + 1] : scope[idx - 1];
        if (target2) { flushPendingEdit(); setSelectedTaskId(target2.id); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTaskId, selectedIds, showSearch, showAddTaskMenu, openSectionMenu, showJiraMenu, filteredTasks, tasks, addTask, showSections]);

  const orderedTaskIds = useMemo(() => {
    if (!showSections) return filteredTasks.map(t => t.id);
    const unsectioned = filteredTasks.filter(t => !t.section_id).map(t => t.id);
    const sectioned = [...sections]
      .sort((a, b) => a.position - b.position)
      .flatMap(s => filteredTasks.filter(t => t.section_id === s.id).map(t => t.id));
    return [...unsectioned, ...sectioned];
  }, [filteredTasks, sections, showSections]);

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

  // Moves every selected task into sectionId, appending each after that section's
  // existing tasks (same "append at bottom" convention addTask uses) rather than
  // carrying over each task's old position, which could collide with tasks already there.
  const moveSelectedTasksToSection = async (sectionId: string) => {
    const ids = [...selectedIds];
    let nextPosition = tasks.filter(t => t.section_id === sectionId).length;
    await Promise.all(ids.map(id => updateTask(id, { section_id: sectionId, position: nextPosition++ })));
    setShowMoveMenu(false);
    setSelectedIds(new Set());
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

  const startEditProjectName = () => {
    if (!project) return;
    setProjectNameDraft(project.name);
    setEditingProjectName(true);
  };
  // Escape unmounts the input, which can itself trigger a native blur just before removal —
  // this flag tells the blur handler that just fired "cancel, don't save" rather than commit
  // whatever was left in the draft.
  const cancelledProjectEditRef = useRef(false);
  const cancelEditProjectName = () => {
    cancelledProjectEditRef.current = true;
    setEditingProjectName(false);
  };
  const saveProjectName = async () => {
    setEditingProjectName(false);
    if (cancelledProjectEditRef.current) { cancelledProjectEditRef.current = false; return; }
    const trimmed = projectNameDraft.trim();
    if (!project || !trimmed || trimmed === project.name) return;
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const d = await r.json();
    if (d.project) { updateProject(d.project); updateProjectLocal(d.project); }
  };

  const commitNewTask = async (sectionId: string) => {
    const name = newTaskName.trim();
    // Blank tasks must never land in the list — this fires on blur (clicking away commits
    // "nothing typed" just as much as pressing Enter does), so without this guard every
    // abandoned "Add task..." row would insert an empty task into the section.
    if (name) await addTask(sectionId, name, newTaskDueDate || undefined);
    setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null);
  };

  const commitAndOpen = async (sectionId: string) => {
    const task = await addTask(sectionId, newTaskName.trim(), newTaskDueDate || undefined);
    setNewTaskName(""); setNewTaskDueDate(""); setAddingIn(null);
    if (task) { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }
  };

  // Click on a task's name text: while the detail panel is already open, clicking any other
  // task should switch the panel to it (not drop into inline rename). Only the currently-open
  // task's own name — or no panel being open at all — still enters inline rename.
  const handleNameClick = (task: Task) => {
    if (!task.name) return;
    if (selectedTaskId && selectedTaskId !== task.id) {
      setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false);
    } else {
      setEditingTaskId(task.id); setEditingTaskName(task.name);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>, sectionId: string) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) await addTask(sectionId, line);
    setNewTaskName(""); setAddingIn(null);
  };

  const handleSaveTemplate = async () => {
    if (!project || templateSaving) return;
    setTemplateSaving(true);
    const structure = sections.map(s => ({
      name: s.name,
      tasks: tasks.filter(t => t.section_id === s.id).map(t => ({ name: t.name, status: t.status, priority: t.priority, task_type: t.task_type })),
    }));
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("BT_templates").insert({ name: project.name, description: project.description ?? "", icon_bg: project.icon_bg, structure });
    setTemplateSaving(false); setTemplateSaved(true); setShowSaveTemplate(false);
    setTimeout(() => setTemplateSaved(false), 3000);
  };

  // The Jira routes process one batch per request so they fit inside the serverless time
  // limit. These runners keep calling until the server reports nothing left, updating the
  // progress message as they go. Without this, a large project stops partway through.
  const postJira = async (path: string, body: Record<string, unknown>) =>
    (await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

  const runJiraBatches = async <T,>(
    path: string,
    body: Record<string, unknown>,
    progress: (done: number, total: number) => string,
    countDone: (rows: T[]) => number,
  ): Promise<{ rows: T[]; skipped: number; stalled: boolean }> => {
    const rows: T[] = [];
    let skipped = 0, done = 0, stalled = false;
    for (let guard = 0; guard < 500; guard++) {
      const json = await postJira(path, body);
      if (json.error) { if (!rows.length) throw new Error(json.error); break; }
      const batch = (json.results ?? []) as T[];
      rows.push(...batch);
      skipped = json.skipped ?? skipped;
      const progressed = countDone(batch);
      done += progressed;
      const total = (json.pendingTotal ?? 0) + done - progressed;
      setJiraLoadingMsg(progress(done, Math.max(total, done)));
      if (!json.remaining) break;
      // Nothing succeeded this round, so retrying would loop forever on the same failures.
      if (progressed === 0) { stalled = true; break; }
    }
    return { rows, skipped, stalled };
  };

  // Resolves the exact Jira project (key + name) this project exports to, and confirms with the user before proceeding
  const confirmJiraProject = async (
    title: string,
    describe: (jiraName: string, jiraKey: string) => string,
    action: () => void,
    showSkipCompleted = false,
  ) => {
    setJiraWorking(true);
    const res = await fetch(`/api/jira/resolve-project?project_id=${projectId}`);
    const resolved = await res.json();
    setJiraWorking(false);
    if (resolved.error) {
      alert(resolved.error);
      // Nothing can be sent without a key, so drop the user straight into the field.
      if (resolved.needsKey) { setShowJiraMenu(true); setJiraKeyInput(project?.jira_project_key ?? ""); }
      return;
    }
    setJiraSkipCompleted(true);
    jiraSkipCompletedRef.current = true;
    setJiraConfirm({ title, body: describe(resolved.name, resolved.key), action, showSkipCompleted });
  };

  const handleExport = async (type: ExportType, includeCompleted = false, sectionFilter: SectionExportFilter | null = null) => {
    if (!project) return;
    // Independent of the on-screen "Show completed" toggle — starts from the
    // search/filter/sort-applied list and only adds/drops completed-status tasks
    // based on the export dialog's own checkbox.
    let base = filteredTasksBase;
    if (sectionFilter) {
      base = base.filter(t => t.section_id ? sectionFilter.ids.includes(t.section_id) : sectionFilter.includeUnsectioned);
    }
    const exportTasks = includeCompleted ? base : base.filter(t => t.status !== "completed");
    // "Since last report" only compares each task's updated_at against this one project-wide
    // timestamp — it has no memory of which sections actually made it into a given export. So
    // the baseline only advances on a real full export (every section); a section-filtered
    // export leaves it untouched, otherwise anything left unedited in a skipped section would
    // silently stop showing up in every future delta export instead of just being re-included
    // (redundant, but never lost) until an actual full export catches it.
    const isFullExport = sectionFilter === null;
    if (type === "csv")   exportToCSV(project, sections, exportTasks, taskTypes);
    if (type === "pdf")   await exportToPDF(project, sections, exportTasks, taskTypes);
    if (type === "json")  exportToJSON(project, sections, exportTasks);

    if (type === "excel" || type === "excel-delta") {
      let excelTasks = exportTasks;
      if (type === "excel-delta" && project.last_excel_export_at) {
        const since = new Date(project.last_excel_export_at);
        excelTasks = exportTasks.filter(t => new Date(t.updated_at) > since);
      }
      if (!excelTasks.length) { alert("No new or changed tasks since the last report."); return; }
      await exportToExcel(project, sections, excelTasks, taskTypes);

      if (isFullExport) {
        const now = new Date().toISOString();
        const { supabase } = await import("@/lib/supabase");
        await supabase.from("BT_projects").update({ last_excel_export_at: now }).eq("id", project.id);
        const updatedProject = { ...project, last_excel_export_at: now };
        updateProject(updatedProject);
        updateProjectLocal(updatedProject);
      }
    }

    if (type === "excel-attachments-only" || type === "excel-attachments-only-delta") {
      let excelTasks = exportTasks;
      if (type === "excel-attachments-only-delta" && project.last_excel_export_at) {
        const since = new Date(project.last_excel_export_at);
        excelTasks = exportTasks.filter(t => new Date(t.updated_at) > since);
      }
      if (!excelTasks.length) { alert("No new or changed tasks since the last report."); return; }
      await exportToExcelAttachmentsOnly(project, sections, excelTasks);

      if (isFullExport) {
        const now = new Date().toISOString();
        const { supabase } = await import("@/lib/supabase");
        await supabase.from("BT_projects").update({ last_excel_export_at: now }).eq("id", project.id);
        const updatedProject = { ...project, last_excel_export_at: now };
        updateProject(updatedProject);
        updateProjectLocal(updatedProject);
      }
    }
  };

  const filterActive = activeFilters.incomplete || activeFilters.completed || activeFilters.justMyTasks ||
    activeFilters.dueThisWeek || activeFilters.dueNextWeek ||
    activeFilters.statuses.length > 0 || activeFilters.priorities.length > 0 ||
    activeFilters.taskTypes.length > 0 || activeFilters.assignees.length > 0 ||
    !!activeFilters.createdFrom || !!activeFilters.createdTo;

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
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 bg-white border-b border-[#E8E8E9] flex-shrink-0" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: project.icon_bg }}>
            {project.name[0]}
          </div>
          <div className="flex items-center gap-1 min-w-0">
            {editingProjectName ? (
              <input
                autoFocus
                value={projectNameDraft}
                onChange={e => setProjectNameDraft(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.currentTarget.blur(); }
                  if (e.key === "Escape") { cancelEditProjectName(); }
                }}
                onBlur={saveProjectName}
                className="text-base sm:text-xl font-bold text-[#151B26] px-1 sm:px-2 py-1 rounded border border-[#4573D9] outline-none min-w-0 w-full max-w-[60vw] sm:max-w-xs"
              />
            ) : (
              <button onClick={startEditProjectName} className="text-base sm:text-xl font-bold text-[#151B26] hover:bg-[#F5F5F5] px-1 sm:px-2 py-1 rounded min-w-0 truncate text-left" title="Click to rename">
                <span className="truncate">{project.name}</span>
              </button>
            )}
            <button onClick={openProjectMenu} className="p-1 text-[#151B26] hover:bg-[#F5F5F5] rounded flex-shrink-0" title="Project menu">
              <ChevronDown size={18} />
            </button>
          </div>
          <button onClick={toggleFavorite} className="p-1.5 rounded hover:bg-[#F5F5F5] hidden sm:flex" title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
            <Star size={16} className={isFavorite ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#6B6F76]"} />
          </button>
          <div className="relative hidden sm:block" ref={statusMenuRef}>
            <button onClick={() => setShowStatusMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm rounded-full hover:bg-[#F5F5F5]" style={{ color: currentStatus?.color ?? "#6B6F76" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: currentStatus?.color ?? "#E8E8E9" }} />
              {currentStatus?.label ?? "Set status"} <ChevronDown size={13} />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                {PROJECT_STATUSES.map(s => (
                  <button key={s.key} onClick={() => handleSetStatus(s.key)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F5F5F5]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span style={{ color: s.color }}>{s.label}</span>
                    {projectStatus === s.key && <span className="ml-auto text-[#4573D9]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            {isAdmin ? (
              <Link href="/admin" title={userEmail} className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold hover:opacity-80">{userInitials}</Link>
            ) : (
              <div title={userEmail} className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold cursor-default">{userInitials}</div>
            )}
            <div className="hidden md:block"><InboxPanel userEmail={userEmail} /></div>
            <button onClick={() => setShowTrash(true)} className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md" title="Trash"><Trash2 size={16} /></button>
            <Link href="/my-tasks" className="hidden sm:flex px-2 py-1 text-xs text-[#6B6F76] border border-[#E8E8E9] rounded hover:bg-[#F5F5F5]">My Tasks</Link>
            <button onClick={handleLogout} className="px-2 py-1 text-xs text-[#6B6F76] border border-[#E8E8E9] rounded hover:bg-[#F5F5F5]">Logout</button>
          </div>
          <button onClick={() => setShowShare(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
            <Share2 size={13} /> Share
          </button>
          <button disabled className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#B0B3B8] rounded-md cursor-not-allowed opacity-50">
            <Settings2 size={13} /> Customize
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-3 sm:px-6 bg-white border-b border-[#E8E8E9] flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as "List"|"Board"|"Calendar"|"Gantt"|"Dashboard")} className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${tab === activeTab ? "font-semibold text-[#151B26] border-b-2 border-[#151B26]" : "text-[#6B6F76] hover:text-[#151B26]"}`}>{tab}</button>
        ))}
        <button className="px-3 py-2.5 text-sm text-[#6B6F76] hover:text-[#151B26]">+</button>
      </div>

      {/* Toolbar — can run wider than a phone screen once every control is visible, so it
          scrolls within itself (like the Tabs row above) instead of pushing the whole page. */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-white border-b border-[#E8E8E9] flex-shrink-0 gap-3 overflow-x-auto">
        {/* Add task split button */}
        <div className="relative flex items-center flex-shrink-0" data-addtask-menu>
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
              onClick={e => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setAddTaskMenuPos({ top: r.bottom + 4, left: r.left });
                setShowAddTaskMenu(v => !v);
              }}
              className="flex items-center px-1.5 py-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-r-md"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          {showAddTaskMenu && addTaskMenuPos && (
            <div className="fixed w-52 bg-white border border-[#E8E8E9] rounded-xl shadow-lg py-1 z-50" style={{ top: addTaskMenuPos.top, left: addTaskMenuPos.left }}>
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
          <span className="text-xs text-[#6B6F76] px-1 whitespace-nowrap" title="Total tasks">
            {filteredTasks.length}{filteredTasks.length !== tasks.length ? ` of ${tasks.length}` : ""} task{tasks.length !== 1 ? "s" : ""}
          </span>
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-[#6B6F76] cursor-pointer select-none whitespace-nowrap" title="Completed tasks are hidden from every view by default">
            <input
              type="checkbox"
              checked={showCompletedTasks}
              onChange={toggleShowCompleted}
              className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer"
            />
            Show completed{!showCompletedTasks && completedHiddenCount > 0 ? ` (${completedHiddenCount})` : ""}
          </label>
          {activeTab === "List" && (
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-[#6B6F76] cursor-pointer select-none whitespace-nowrap" title="Uncheck to list every task in one flat, sortable list instead of grouped by section">
              <input
                type="checkbox"
                checked={showSections}
                onChange={toggleShowSections}
                className="w-3.5 h-3.5 accent-[#4573D9] cursor-pointer"
              />
              Show Sections
            </label>
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
            {showSort && <SortDropdown current={sortKey} dir={sortDir} onChange={handleColSort} onClose={() => setShowSort(false)} />}
          </div>
          <button className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><MoreHorizontal size={14} /> Group</button>
          {showSections && (
            <>
              <button onClick={expandAll} title="Expand all sections" className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded flex-shrink-0 whitespace-nowrap">
                <ChevronsUpDown size={14} /> Expand
              </button>
              <button onClick={collapseAll} title="Collapse all sections" className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded flex-shrink-0 whitespace-nowrap">
                <ChevronsDownUp size={14} /> Collapse
              </button>
            </>
          )}
          <button onClick={() => { setShowColumns(v => !v); setShowCustomize(false); setSelectedTaskId(null); }} className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${showColumns ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}>
            <Settings2 size={14} /> Options
          </button>
          {/* Project-level Jira */}
          {(isAdmin || membersCanExportJira) && (
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowJiraMenu(v => !v)}
              disabled={jiraWorking}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded disabled:opacity-40"
              title="Jira integration"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
              {jiraWorking ? "Working…" : "Jira"}
            </button>
            {showJiraMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-lg shadow-lg py-1 w-60 z-50">
                {/* Per-project Jira key */}
                <div className="px-3 py-2 border-b border-[#F0F1F3]">
                  <p className="text-xs text-[#6B6F76] mb-1.5">Jira space initials (project key)</p>
                  {jiraKeyInput === null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-[#151B26] flex-1">
                        {project?.jira_project_key ?? <span className="text-red-500 italic text-xs font-sans">Not set — export blocked</span>}
                      </span>
                      <button onClick={() => setJiraKeyInput(project?.jira_project_key ?? "")} className="text-xs text-[#4573D9] hover:underline">
                        {project?.jira_project_key ? "Change" : "Set"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={jiraKeyInput}
                        onChange={e => setJiraKeyInput(e.target.value.toUpperCase())}
                        placeholder="e.g. BUG"
                        className="flex-1 px-2 py-1 text-sm font-mono border border-[#E8E8E9] rounded focus:border-[#4573D9] outline-none"
                        onKeyDown={async e => {
                          if (e.key === "Escape") { setJiraKeyInput(null); return; }
                          if (e.key === "Enter") {
                            const val = jiraKeyInput.trim() || null;
                            await fetch("/api/projects/" + projectId + "/jira-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jira_project_key: val }) });
                            if (project) updateProjectLocal({ ...project, jira_project_key: val });
                            setJiraKeyInput(null);
                          }
                        }}
                      />
                      <button
                        onClick={async () => {
                          const val = jiraKeyInput.trim() || null;
                          await fetch("/api/projects/" + projectId + "/jira-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jira_project_key: val }) });
                          if (project) updateProjectLocal({ ...project, jira_project_key: val });
                          setJiraKeyInput(null);
                        }}
                        className="px-2 py-1 bg-[#4573D9] text-white text-xs rounded"
                      >Save</button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowJiraMenu(false);
                    confirmJiraProject(
                      "Export to Jira",
                      (jiraName, jiraKey) => `Everything in "${project?.name}" will be sent to Jira project "${jiraName}" (${jiraKey}).\n\nNew tasks are created as Jira issues, and tasks changed here since the last export are updated — title, status, priority, due date, description, attachments and section label.\n\nTasks that have not changed are skipped.`,
                      async () => {
                        setJiraLoadingMsg("Exporting to Jira…");
                        try {
                          const { rows, skipped, stalled } = await runJiraBatches<JiraExportResult>(
                            "/api/jira/export",
                            { project_id: projectId, skip_completed: jiraSkipCompletedRef.current },
                            (done, total) => `Exporting to Jira… ${done} of ${total}`,
                            batch => batch.filter(r => r.created || r.updated || r.unlinked).length,
                          );
                          const created  = rows.filter(r => r.created).length;
                          const updated  = rows.filter(r => r.updated).length;
                          const status   = rows.filter(r => r.statusPushed).length;
                          const unlinked = rows.filter(r => r.unlinked).length;
                          const degraded = rows.filter(r => r.degraded).length;
                          const failed   = distinctFailures(rows.filter(r => !r.unlinked)).length;
                          const parts: string[] = [];
                          if (created)  parts.push(`${created} created`);
                          if (updated)  parts.push(`${updated} updated`);
                          if (status)   parts.push(`${status} status change${status !== 1 ? "s" : ""} applied`);
                          if (skipped)  parts.push(`${skipped} unchanged`);
                          if (unlinked) parts.push(`${unlinked} no longer in Jira — link removed`);
                          if (degraded) parts.push(`${degraded} created with title only`);
                          if (failed)   parts.push(`${failed} failed`);
                          if (stalled)  parts.push("stopped early — remaining kept failing");
                          alert(`Export complete. ${parts.length ? parts.join(", ") + "." : "Nothing to send."}${describeJiraFailures(rows.filter(r => !r.unlinked))}`);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : "Export failed.");
                        } finally { setJiraLoadingMsg(null); }
                      },
                      true
                    );
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
                  Export to Jira
                </button>
                <button
                  onClick={() => {
                    setShowJiraMenu(false);
                    setJiraConfirm({
                      title: "Sync from Jira",
                      body: `Changes made in Jira will be pulled into "${project?.name}" — status, priority, title, assignee, due date and attachments.\n\nOnly issues actually changed in Jira are touched. Tasks marked Ready for QA, In Review or Blocked keep that status, since Jira has no equivalent.`,
                      action: async () => {
                        setJiraLoadingMsg("Syncing from Jira…");
                        try {
                          // Sync pages by offset: unchanged tasks are not written, so they never
                          // drop out of the candidate set the way exported ones do.
                          const rows: JiraSyncResult[] = [];
                          let offset: number | null = 0;
                          while (offset !== null) {
                            const json = await postJira("/api/jira/sync", { project_id: projectId, offset });
                            if (json.error) { if (!rows.length) { alert(json.error); return; } break; }
                            rows.push(...((json.results ?? []) as JiraSyncResult[]));
                            setJiraLoadingMsg(`Syncing from Jira… ${rows.length} of ${json.total ?? rows.length}`);
                            offset = json.nextOffset ?? null;
                          }
                          const updated  = rows.filter(r => r.updated).length;
                          const checked  = rows.filter(r => r.checked).length;
                          const unlinked = rows.filter(r => r.unlinked).length;
                          const failed   = distinctFailures(rows.filter(r => !r.unlinked)).length;
                          const parts: string[] = [`${updated} task${updated !== 1 ? "s" : ""} updated from Jira`];
                          if (checked - updated > 0) parts.push(`${checked - updated} unchanged`);
                          if (unlinked) parts.push(`${unlinked} no longer in Jira — link removed`);
                          if (failed)   parts.push(`${failed} failed`);
                          alert(`Sync complete. ${parts.join(", ")}.${describeJiraFailures(rows.filter(r => !r.unlinked))}`);
                        } finally { setJiraLoadingMsg(null); }
                      },
                    });
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#151B26] hover:bg-[#FAFBFC] text-left"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
                  Sync from Jira
                </button>
              </div>
            )}
          </div>
          )}
          <button
            onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(""); }}
            className={`p-2 rounded transition-colors ${showSearch ? "text-[#4573D9] bg-[#EEF2FB]" : "text-[#6B6F76] hover:bg-[#F5F5F5]"}`}
            title="Search in project"
          >
            <Search size={14} />
          </button>
          <button
            onClick={() => { const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }); window.dispatchEvent(e); }}
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 text-xs text-[#9EA3AA] border border-[#E8E8E9] rounded hover:bg-[#F5F5F5]"
            title="Global search"
          >
            <Search size={11} /> <kbd className="text-[10px]">⌘K</kbd>
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
          <div ref={moveMenuRef} className="relative">
            <button
              onClick={() => setShowMoveMenu(v => !v)}
              className="flex items-center gap-1 text-white/80 hover:text-white"
            >
              <FolderInput size={13} />
              Move to section
            </button>
            {showMoveMenu && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[6px] shadow-lg z-50 py-1 w-52 max-h-64 overflow-y-auto text-[#151B26]">
                {sections.length === 0 && (
                  <div className="px-3 py-1.5 text-xs text-[#9EA3AA]">No sections yet</div>
                )}
                {[...sections].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                  <button
                    key={s.id}
                    onClick={() => moveSelectedTasksToSection(s.id)}
                    className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-[#FAFBFC] text-left truncate"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(isAdmin || membersCanExportJira) && (
          <button
            onClick={() => {
              const ids = [...selectedIds];
              confirmJiraProject(
                "Export selected tasks to Jira",
                (jiraName, jiraKey) => `This will create a new Jira issue for ${ids.length} selected task${ids.length !== 1 ? "s" : ""} in Jira project "${jiraName}" (${jiraKey}). Tasks already linked to Jira will be skipped.`,
                async () => {
                  setJiraLoadingMsg("Exporting selected tasks to Jira…");
                  try {
                    const { rows, stalled } = await runJiraBatches<JiraExportResult>(
                      "/api/jira/export",
                      { task_ids: ids, skip_completed: jiraSkipCompletedRef.current },
                      (done, total) => `Exporting selected tasks to Jira… ${done} of ${total}`,
                      batch => batch.filter(r => r.created).length,
                    );
                    const created = rows.filter(r => r.created).length;
                    const failed  = distinctFailures(rows).length;
                    const parts: string[] = [`${created} new issue${created !== 1 ? "s" : ""} created`];
                    if (failed)  parts.push(`${failed} failed`);
                    if (stalled) parts.push("stopped early — remaining tasks kept failing");
                    alert(`Export complete. ${parts.join(", ")}.${describeJiraFailures(rows)}`);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "Export failed.");
                  } finally { setJiraLoadingMsg(null); }
                },
                true
              );
            }}
            className="flex items-center gap-1.5 text-white/80 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="currentColor"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="currentColor" opacity=".5"/></svg>
            Export to Jira
          </button>
          )}
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
      {activeTab === "Calendar" && (
        <CalendarView tasks={filteredTasks} onOpenTask={id => setSelectedTaskId(id)} updateTask={updateTask} />
      )}
      {activeTab === "Gantt" && (
        <div className="flex-1 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
          <GanttView tasks={filteredTasks} sections={sections} onOpenTask={id => setSelectedTaskId(id)} statuses={PROJECT_STATUSES} />
        </div>
      )}
      {activeTab === "Dashboard" && (
        <DashboardView tasks={filteredTasks} sections={sections} projectId={projectId} projectName={project?.name} userEmail={userEmail} isAdmin={isAdmin} />
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
          {!showSections && <div className="hidden sm:block w-28 text-xs font-medium text-[#6B6F76] border-r border-[#E8E8E9] pl-3">Section</div>}
          {visibleCols.includes("status")           && <SortHeader label="Status"      sk="status"        sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("assignee")         && <SortHeader label="Assignee"    sk="assignee"      sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("due_date")         && <SortHeader label="Due date"    sk="dueDate"       sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("priority")         && <SortHeader label="Priority"    sk="priority"      sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("task_type")        && <div className="hidden sm:block w-32 text-xs font-medium text-[#6B6F76] border-r border-[#E8E8E9] pl-3">Task Type</div>}
          {visibleCols.includes("created_on")       && <SortHeader label="Created on"  sk="createdAt"     sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("last_modified_on") && <SortHeader label="Last modified" sk="lastModifiedAt" sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          {visibleCols.includes("completed_on")     && <SortHeader label="Completed on" sk="completedAt"  sortKey={sortKey} sortDir={sortDir} onSort={handleColSort} className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3" />}
          <button
            onClick={() => { setShowColumns(v => !v); setShowCustomize(false); setSelectedTaskId(null); }}
            title="Add/remove columns"
            className="w-8 text-xs text-[#4573D9] cursor-pointer hidden sm:block"
          >+</button>
        </div>

        {/* Filter/search info bar */}
        {(filterActive || sortKey !== "none" || searchQuery) && (
          <div className="px-6 py-1.5 bg-[#EEF2FB] border-b border-[#E8E8E9] flex items-center gap-2">
            <span className="text-xs text-[#4573D9]">Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <button onClick={() => { setActiveFilters(DEFAULT_FILTERS); setSortKey("none"); setSearchQuery(""); }} className="text-xs text-[#4573D9] underline">Clear all</button>
          </div>
        )}

        {!showSections ? (
          <>
            {/* Flat task list — sections hidden, filteredTasks is already sorted/filtered as one set */}
            {filteredTasks.map(task => {
              const isSelected = selectedIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`flex items-center px-3 sm:px-6 py-1 border-b border-[#E8E8E9] hover:bg-[#F5F5F5] group cursor-default ${selectedTaskId === task.id || isSelected ? "bg-[#F5F5F5]" : ""}`}
                  onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                >
                  <div
                    onClick={e => toggleSelect(task.id, e)}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mr-2 transition-colors cursor-pointer ${
                      isSelected ? "bg-[#4573D9] border-[#4573D9]" : task.completed ? "bg-[#14A454] border-[#14A454]" : "border-[#B0B3B8] hover:border-[#4573D9] group-hover:border-[#4573D9]"
                    }`}
                  >
                    {isSelected && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="2.5" fill="white" /></svg>}
                    {!isSelected && task.completed && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4.2 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div className="flex-1 text-sm min-w-0 py-1 flex items-center sm:border-r border-[#E8E8E9]">
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 cursor-pointer pr-1" onClick={() => { setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}>
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          value={editingTaskName}
                          onChange={e => setEditingTaskName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); } }}
                          onBlur={() => { if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}
                          className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className={`min-w-0 truncate cursor-text flex items-center gap-1 ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`} onClick={e => { if (window.innerWidth < 640) return; e.stopPropagation(); handleNameClick(task); }}>
                            {task.is_milestone && <span className="text-amber-500 text-[10px] flex-shrink-0">◆</span>}
                            {task.name}
                            {task.jira_has_updates && <span title="Updated in Jira — open to review" className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 inline-block" />}
                          </span>
                          {(task.BT_attachments?.length ?? 0) > 0 && <span className="text-xs text-[#6B6F76] shrink-0" onClick={e => { if (window.innerWidth >= 640) e.stopPropagation(); }}>📎 {task.BT_attachments!.length}</span>}
                          <span className="sm:hidden text-[10px] text-[#6B6F76] bg-[#F3F4F6] px-1.5 py-0.5 rounded w-fit">{sectionNameById.get(task.section_id ?? "") ?? "No section"} · {task.status?.replace(/_/g," ")}</span>
                        </>
                      )}
                    </div>
                    <button
                      className="flex-shrink-0 p-2 -m-1 mr-1 text-[#B0B3B8] hover:text-[#4573D9] hover:bg-[#EEF2FB] rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                      title="Open detail"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="hidden sm:block w-28 border-r border-[#E8E8E9] pl-3 truncate">
                    <span className="text-xs text-[#6B6F76]">{sectionNameById.get(task.section_id ?? "") ?? "No section"}</span>
                  </div>
                  {visibleCols.includes("status") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><StatusBadge compact value={task.status} onChange={v => updateTaskOrBulk(task.id, { status: v })} /></div>}
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
                  {visibleCols.includes("priority") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><PriorityBadge compact value={task.priority ?? "high"} onChange={v => updateTaskOrBulk(task.id, { priority: v })} disabled={lockPriorities && !isAdmin} /></div>}
                  {visibleCols.includes("task_type") && <div className="hidden sm:block w-32 border-r border-[#E8E8E9] pl-3" onClick={e => e.stopPropagation()}><TaskTypeBadge compact value={task.task_type ?? "bug"} onChange={v => updateTaskOrBulk(task.id, { task_type: v })} /></div>}
                  {visibleCols.includes("created_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.created_at)}</span></div>}
                  {visibleCols.includes("last_modified_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.updated_at)}</span></div>}
                  {visibleCols.includes("completed_on") && <div className="hidden sm:block w-40 border-r border-[#E8E8E9] pl-3"><span className="text-xs text-[#6B6F76]">{fmtDateTime(task.completed_at)}</span></div>}
                  <div className="w-8 hidden sm:block" />
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-[#9EA3AA]">No tasks match.</div>
            )}
          </>
        ) : (
        <>
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
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}}
                      onBlur={() => { if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}
                      className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]" onClick={e => e.stopPropagation()} />
                  ) : (
                    <>
                      <span className={`min-w-0 truncate cursor-text flex items-center gap-1 ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}
                        onClick={e => { if (window.innerWidth < 640) return; e.stopPropagation(); handleNameClick(task); }}>
                        {task.is_milestone && <span className="text-amber-500 text-[10px] flex-shrink-0">◆</span>}
                        {task.name}
                        {task.jira_has_updates && <span title="Updated in Jira — open to review" className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 inline-block" />}
                      </span>
                      <span className="sm:hidden text-[10px] text-[#6B6F76] bg-[#F3F4F6] px-1.5 py-0.5 rounded w-fit">{task.status?.replace(/_/g," ")}</span>
                    </>
                  )}
                </div>
                <button
                  className="flex-shrink-0 p-2 -m-1 mr-1 text-[#B0B3B8] hover:text-[#4573D9] hover:bg-[#EEF2FB] rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                  title="Open detail"
                >
                  <ChevronRight size={16} />
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
        {sortedSections.map(section => {
          const sectionTasks = filteredTasks.filter(t => t.section_id === section.id);
          const isSearchActive = searchQuery.trim() !== "" || filteredTasksBase.length !== tasks.length;
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
                    onFocus={e => e.target.select()}
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
                    onClick={() => toggleCollapse(section.id)}
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
                  <button onClick={() => startAddingTask(section.id)} className="p-1 text-[#6B6F76] hover:bg-[#F0F1F3] rounded" title="Add task"><Plus size={13} /></button>
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
                        onClick={() => {
                          setOpenSectionMenu(null);
                          setConfirmDialog({
                            title: "Delete section?",
                            body: `"${section.name}" will be deleted. Its tasks won't be deleted — they'll move to no section.`,
                            action: () => deleteSection(section.id),
                          });
                        }}
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
                              if (e.key === "Enter" || e.key === "Escape") { e.stopPropagation(); if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }
                            }}
                            onBlur={() => { if (!editingTaskName.trim() && !task.description && !(task.BT_attachments?.length)) { permanentlyDeleteTask(task.id); } else { updateTask(task.id, { name: editingTaskName.trim() || task.name }); } setEditingTaskId(null); }}
                            className="flex-1 outline-none bg-transparent border-b border-[#4573D9] text-[#151B26]"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span
                              className={`min-w-0 truncate cursor-text flex items-center gap-1 ${task.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}
                              onClick={e => { if (window.innerWidth < 640) return; e.stopPropagation(); handleNameClick(task); }}
                            >
                              {task.name}
                              {task.jira_has_updates && <span title="Updated in Jira — open to review" className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 inline-block" />}
                            </span>
                            {(task.BT_attachments?.length ?? 0) > 0 && (
                              <span className="text-xs text-[#6B6F76] shrink-0" onClick={e => { if (window.innerWidth >= 640) e.stopPropagation(); }}>📎 {task.BT_attachments!.length}</span>
                            )}
                            <span className="sm:hidden text-[10px] text-[#6B6F76] bg-[#F3F4F6] px-1.5 py-0.5 rounded w-fit">{task.status?.replace(/_/g," ")}</span>
                          </>
                        )}
                      </div>
                      <button
                        className="flex-shrink-0 p-2 -m-1 mr-1 text-[#B0B3B8] hover:text-[#4573D9] hover:bg-[#EEF2FB] rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setSelectedTaskId(task.id); setShowCustomize(false); setShowColumns(false); }}
                        title="Open detail"
                      >
                        <ChevronRight size={16} />
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
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={async () => { const s = await addSection(); if (s) { setRenamingSection(s.id); setSectionNameDraft(s.name); } }}
            className="flex items-center gap-1.5 text-sm text-[#6B6F76] hover:text-[#151B26]"
          >
            <Plus size={14} /> Add section
          </button>
          <button
            onClick={() => setShowBulkSections(true)}
            className="flex items-center gap-1.5 text-sm text-[#6B6F76] hover:text-[#151B26]"
          >
            <Plus size={14} /> Add multiple sections
          </button>
        </div>
        </>
        )}
      </div>}

      {/* Bulk add sections modal */}
      {showBulkSections && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center" onClick={() => setShowBulkSections(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#151B26] mb-2">Add multiple sections</h3>
            <p className="text-sm text-[#6B6F76] mb-3">One section name per line.</p>
            <textarea
              autoFocus
              value={bulkSectionsText}
              onChange={e => setBulkSectionsText(e.target.value)}
              rows={8}
              placeholder={"To Do\nIn Progress\nDone"}
              className="w-full text-sm border border-[#E8E8E9] rounded-lg px-3 py-2 outline-none focus:border-[#4573D9] resize-none"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setShowBulkSections(false); setBulkSectionsText(""); }} className="px-4 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#FAFBFC]">Cancel</button>
              <button
                onClick={async () => {
                  const names = bulkSectionsText.split("\n").map(n => n.trim()).filter(Boolean);
                  if (!names.length) return;
                  await addSections(names);
                  setShowBulkSections(false); setBulkSectionsText("");
                }}
                className="px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]"
              >Create</button>
            </div>
          </div>
        </div>
      )}

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
            updateTaskLocal={updateTaskLocal}
            toggleTask={toggleTask}
            duplicateTask={duplicateTask}
            deleteTask={deleteTask}
            permanentlyDeleteTask={permanentlyDeleteTask}
            addTask={addTask}
            onOpenTask={id => { setSelectedTaskId(id); }}
            addAttachment={addAttachment}
            removeAttachment={removeAttachment}
            addSection={addSection}
            userEmail={userEmail}
            isAdmin={isAdmin}
          />
        ) : null;
      })()}
      {showCustomize && <CustomizePanel onClose={() => setShowCustomize(false)} />}
      {/* Jira confirm modal */}
      {jiraConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setJiraConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
              <h2 className="text-base font-semibold text-[#151B26]">{jiraConfirm.title}</h2>
            </div>
            <p className="text-sm text-[#6B6F76] leading-relaxed mb-4">{jiraConfirm.body}</p>
            {jiraConfirm.showSkipCompleted && (
              <label className="flex items-center gap-2 mb-6 text-sm text-[#151B26] cursor-pointer">
                <input
                  type="checkbox"
                  checked={jiraSkipCompleted}
                  onChange={e => { setJiraSkipCompleted(e.target.checked); jiraSkipCompletedRef.current = e.target.checked; }}
                  className="w-4 h-4"
                />
                Skip completed tasks
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setJiraConfirm(null)} className="px-4 py-2 text-sm text-[#6B6F76] border border-[#E8E8E9] rounded-lg hover:bg-[#F5F5F5]">Cancel</button>
              <button
                onClick={() => { const fn = jiraConfirm.action; setJiraConfirm(null); fn(); }}
                className="px-4 py-2 text-sm text-white bg-[#2684FF] rounded-lg hover:bg-[#1a6fd8]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrash && (
        <TrashPanel
          sections={sections}
          onClose={() => setShowTrash(false)}
          fetchDeletedTasks={fetchDeletedTasks}
          restoreTask={restoreTask}
          permanentlyDeleteTask={permanentlyDeleteTask}
          purgeExpiredTasks={purgeExpiredTasks}
        />
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#151B26] mb-3">{confirmDialog.title}</h2>
            <p className="text-sm text-[#6B6F76] leading-relaxed mb-6">{confirmDialog.body}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-sm text-[#6B6F76] border border-[#E8E8E9] rounded-lg hover:bg-[#F5F5F5]">Cancel</button>
              <button
                onClick={() => { const fn = confirmDialog.action; setConfirmDialog(null); fn(); }}
                className="px-4 py-2 text-sm text-white bg-[#E5534B] rounded-lg hover:bg-[#c9463f]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jira full-page loading overlay */}
      {jiraLoadingMsg && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mb-4 animate-pulse"><path d="M11.571 11.429L6.857 6.714A6 6 0 0112 2a6 6 0 015.143 9.143L12 16.286l-5.143-4.857z" fill="#2684FF"/><path d="M12.429 12.571l4.714 4.715A6 6 0 0112 22a6 6 0 01-5.143-9.143L12 7.714l5.143 4.857z" fill="#2684FF" opacity=".5"/></svg>
          <p className="text-base font-semibold text-[#151B26]">{jiraLoadingMsg}</p>
          <p className="text-sm text-[#6B6F76] mt-1">Please do not close this page.</p>
        </div>
      )}

      {showShare && project && (
        <ShareProjectModal
          projectId={projectId}
          projectName={project.name}
          ownerEmail={userEmail}
          canManage={canManage}
          onClose={() => setShowShare(false)}
          onManageMembers={() => { setShowShare(false); setShowMembers(true); }}
        />
      )}
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
          canExport={canExport}
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
          onSaveTemplate={handleSaveTemplate}
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
          onDelete={() => {
            setConfirmDialog({
              title: `Delete "${project.name}"?`,
              body: "This project has no tasks in it. Deleting it removes the project and its sections permanently — this can't be undone.",
              action: async () => {
                const result = await deleteProject(project.id);
                if (result.ok) router.push("/projects");
                else alert(result.error ?? "Failed to delete project");
              },
            });
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
        <div className="fixed bottom-[calc(var(--bt-tabbar-h)+env(safe-area-inset-bottom)+1rem)] md:bottom-6 left-1/2 -translate-x-1/2 bg-[#151B26] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[200]">
          Link copied to clipboard
        </div>
      )}
      {templateSaved && (
        <div className="fixed bottom-[calc(var(--bt-tabbar-h)+env(safe-area-inset-bottom)+1rem)] md:bottom-6 left-1/2 -translate-x-1/2 bg-[#151B26] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[200]">
          Template saved
        </div>
      )}
    </div>
  );
}
