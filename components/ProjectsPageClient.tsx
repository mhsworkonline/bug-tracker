"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, ChevronDown, Loader2, Settings, LogOut, Users, FileSpreadsheet, X, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import ProjectsTable, { type ProjectSort, type SortableColumn } from "@/components/ProjectsTable";
import { createSupabaseBrowser } from "@/lib/auth-browser";
import { useAdminSettings } from "@/lib/adminSettingsContext";
import { exportProjectsToExcel } from "@/lib/exportUtils";
import { fetchProjectsExportData } from "@/lib/fetchProjectExportData";
import { searchTasksAcrossProjects, type TaskSearchHit } from "@/lib/searchAcrossProjects";

interface Props {
  isAdmin: boolean;
  userEmail?: string;
  allowedProjectIds: string[] | null;
}

export default function ProjectsPageClient({ isAdmin, userEmail, allowedProjectIds }: Props) {
  const router = useRouter();
  const { projects, loading } = useStore();
  const { taskTypes, membersCanExportExcel, statusByKey } = useAdminSettings();
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [taskResults, setTaskResults] = useState<TaskSearchHit[]>([]);
  const [searchingTasks, setSearchingTasks] = useState(false);

  const canExport = isAdmin || membersCanExportExcel;

  const [sort, setSort] = useState<ProjectSort | null>({ column: "updated_at", direction: "desc" });

  const visible = projects.filter(p => {
    if (!isAdmin && p.is_active === false) return false;
    if (allowedProjectIds !== null && !allowedProjectIds.includes(p.id)) return false;
    return p.name.toLowerCase().includes(query.toLowerCase());
  });

  const sorted = useMemo(() => {
    if (!sort) return visible;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      if (sort.column === "name")
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;
      // updated_at (falls back to created_at for rows never modified)
      const av = new Date(a.updated_at ?? a.created_at).getTime();
      const bv = new Date(b.updated_at ?? b.created_at).getTime();
      return (av - bv) * dir;
    });
  }, [visible, sort]);

  const toggleSort = (column: SortableColumn) => {
    setSort(prev => {
      if (prev?.column !== column) return { column, direction: column === "updated_at" ? "desc" : "asc" };
      return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  // Cross-project task search — same query box, respects the same allow-list as the project list above.
  useEffect(() => {
    if (!query.trim()) { setTaskResults([]); setSearchingTasks(false); return; }
    setSearchingTasks(true);
    const t = setTimeout(async () => {
      const hits = await searchTasksAcrossProjects(query, allowedProjectIds, 20);
      setTaskResults(hits);
      setSearchingTasks(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, allowedProjectIds]);

  const projectById = (id: string) => projects.find(p => p.id === id);

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkExport = async () => {
    const selectedProjects = visible.filter(p => selected.has(p.id));
    if (!selectedProjects.length) return;
    setExporting(true);
    try {
      const dataByProject = await fetchProjectsExportData(selectedProjects.map(p => p.id));
      await exportProjectsToExcel(selectedProjects, dataByProject, taskTypes);
      exitSelectMode();
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className={`max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 ${selectMode && selected.size > 0 ? "pb-20" : ""}`}>
        <div className="flex items-center justify-between mb-6 gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#151B26]">Browse projects</h1>
          <div className="flex items-center gap-1 sm:gap-2">
            {userEmail && (
              <div className="flex items-center gap-2 mr-1 sm:mr-2">
                {isAdmin ? (
                  <Link href="/admin" className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 hover:opacity-80 transition-opacity" title="Admin dashboard">
                    {userEmail.slice(0, 2).toUpperCase()}
                  </Link>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {userEmail.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:block text-sm text-[#6B6F76]">{userEmail}</span>
              </div>
            )}
            {isAdmin && (
              <Link href="/admin" className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md" title="Admin settings">
                <Settings size={16} />
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/users" className="hidden sm:flex items-center gap-1.5 px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]">
                <Users size={14} /> Users
              </Link>
            )}
            {isAdmin && (
              <Link href="/projects/new" className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
                <Plus size={14} /> <span className="hidden sm:inline">Create project</span><span className="sm:hidden">New</span>
              </Link>
            )}
            {canExport && visible.length > 0 && (
              selectMode ? (
                <button onClick={exitSelectMode} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]">
                  <X size={14} /> Cancel
                </button>
              ) : (
                <button onClick={() => setSelectMode(true)} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]" title="Export projects to Excel">
                  <FileSpreadsheet size={14} /> <span className="hidden sm:inline">Export</span>
                </button>
              )
            )}
            <button onClick={handleLogout} className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6F76] pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a project"
            className="w-full pl-9 pr-4 py-2 border border-[#E8E8E9] rounded-md text-sm outline-none focus:border-[#4573D9] text-[#151B26] placeholder-[#6B6F76]"
          />
        </div>

        {!isAdmin && allowedProjectIds !== null && allowedProjectIds.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-3"><Plus size={20} className="text-[#6B6F76]" /></div>
            <p className="text-[#151B26] font-medium mb-1">No projects yet</p>
            <p className="text-sm text-[#6B6F76]">Ask your admin to assign you to a project.</p>
          </div>
        )}

        {query.trim() && (searchingTasks || taskResults.length > 0) && (
          <div className="mb-5 border border-[#E8E8E9] rounded-[6px] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFBFC] border-b border-[#E8E8E9]">
              <span className="text-xs font-medium text-[#6B6F76]">Matching tasks</span>
              {searchingTasks && <Loader2 size={12} className="animate-spin text-[#B0B3B8]" />}
            </div>
            {taskResults.map((t, i) => {
              const proj = projectById(t.project_id);
              const status = statusByKey(t.status);
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.project_id}/tasks/${t.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#FAFBFC] transition-colors ${i < taskResults.length - 1 ? "border-b border-[#F0F1F3]" : ""}`}
                >
                  {t.completed
                    ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                    : <Circle size={15} className="text-[#C8C9CC] flex-shrink-0" />}
                  <span className={`flex-1 min-w-0 text-sm truncate ${t.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}>{t.name}</span>
                  {proj && (
                    <span className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-xs text-[#6B6F76]">
                      <span className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] font-bold" style={{ background: proj.icon_bg }}>
                        {proj.name[0]?.toUpperCase()}
                      </span>
                      {proj.name}
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.text }}>
                    {status.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[#6B6F76] text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading projects…
          </div>
        ) : query.trim() && visible.length === 0 && taskResults.length === 0 && !searchingTasks ? (
          <div className="border border-[#E8E8E9] rounded-[6px] px-6 py-12 text-center text-sm text-[#6B6F76]">
            No projects or tasks match &quot;{query}&quot;.
          </div>
        ) : (
          <ProjectsTable
            projects={sorted}
            isAdmin={isAdmin}
            selectMode={selectMode}
            selected={selected}
            sort={sort}
            onSort={toggleSort}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E8E8E9] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-4 py-3 sm:px-8" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-[#151B26]">{selected.size} project{selected.size === 1 ? "" : "s"} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={exitSelectMode} disabled={exporting} className="px-3 sm:px-4 py-2 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleBulkExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] disabled:opacity-60"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                {exporting ? "Exporting…" : `Export ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
