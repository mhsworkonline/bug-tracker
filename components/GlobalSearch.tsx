"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Search, FolderOpen, CheckCircle2, Circle, X } from "lucide-react";

interface Result {
  type: "project" | "task";
  id: string;
  name: string;
  subtitle?: string;
  projectId?: string;
  completed?: boolean;
  color?: string;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started", in_progress: "In progress",
  ready_for_qa: "Ready for QA", in_review: "In review", done: "Done", blocked: "Blocked",
};

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Open on Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setResults([]); setCursor(0); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const [{ data: projects }, { data: tasks }] = await Promise.all([
      supabase.from("BT_projects").select("id, name, icon_bg").ilike("name", `%${q}%`).limit(5),
      supabase.from("BT_tasks").select("id, name, status, completed, project_id").ilike("name", `%${q}%`).limit(10),
    ]);

    const projectIds = [...new Set((tasks ?? []).map(t => t.project_id))];
    let projMap: Record<string, string> = {};
    if (projectIds.length) {
      const { data: ps } = await supabase.from("BT_projects").select("id, name").in("id", projectIds);
      for (const p of ps ?? []) projMap[p.id] = p.name;
    }

    const r: Result[] = [
      ...(projects ?? []).map(p => ({ type: "project" as const, id: p.id, name: p.name, color: p.icon_bg })),
      ...(tasks ?? []).map(t => ({ type: "task" as const, id: t.id, name: t.name, projectId: t.project_id, subtitle: projMap[t.project_id] ?? "", completed: t.completed, subtitle2: STATUS_LABELS[t.status] ?? t.status })),
    ];
    setResults(r);
    setCursor(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  const navigate = (r: Result) => {
    if (r.type === "project") router.push(`/projects/${r.id}`);
    else router.push(`/projects/${r.projectId}/tasks/${r.id}`);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && results[cursor]) navigate(results[cursor]);
  };

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F5] border border-[#E8E8E9] rounded-lg text-sm text-[#6B6F76] hover:bg-[#EFEFEF] transition-colors"
      title="Search (Ctrl+K)"
    >
      <Search size={13} /> Search <kbd className="text-[10px] bg-white border border-[#E8E8E9] px-1 rounded ml-1">⌘K</kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#E8E8E9] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E8E8E9]">
          <Search size={16} className="text-[#6B6F76] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search tasks and projects…"
            className="flex-1 text-sm text-[#151B26] outline-none placeholder-[#9EA3AA]"
          />
          {loading && <div className="w-4 h-4 border-2 border-[#4573D9] border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          <button onClick={() => setOpen(false)} className="p-1 text-[#6B6F76] hover:text-[#151B26] rounded"><X size={14} /></button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && query && !loading && (
            <p className="text-sm text-[#6B6F76] text-center py-8">No results for "{query}"</p>
          )}
          {results.length === 0 && !query && (
            <p className="text-sm text-[#6B6F76] text-center py-8">Type to search tasks and projects</p>
          )}

          {results.length > 0 && (() => {
            const projects = results.filter(r => r.type === "project");
            const tasks = results.filter(r => r.type === "task");
            let idx = -1;
            return (
              <>
                {projects.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-[#9EA3AA] uppercase tracking-wide bg-[#FAFBFC] border-b border-[#F0F1F3]">Projects</div>
                    {projects.map(r => { idx++; const i = idx; return (
                      <div
                        key={r.id}
                        onClick={() => navigate(r)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${cursor === i ? "bg-[#EEF2FB]" : "hover:bg-[#FAFBFC]"}`}
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: r.color }}>
                          {r.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#151B26] truncate">{r.name}</div>
                        </div>
                        <FolderOpen size={14} className="text-[#B0B3B8] flex-shrink-0" />
                      </div>
                    ); })}
                  </>
                )}
                {tasks.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-[#9EA3AA] uppercase tracking-wide bg-[#FAFBFC] border-b border-[#F0F1F3]">Tasks</div>
                    {tasks.map(r => { idx++; const i = idx; return (
                      <div
                        key={r.id}
                        onClick={() => navigate(r)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${cursor === i ? "bg-[#EEF2FB]" : "hover:bg-[#FAFBFC]"}`}
                      >
                        <div className="flex-shrink-0">
                          {r.completed
                            ? <CheckCircle2 size={15} className="text-green-500" />
                            : <Circle size={15} className="text-[#C8C9CC]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate ${r.completed ? "line-through text-[#6B6F76]" : "text-[#151B26]"}`}>{r.name}</div>
                          {r.subtitle && <div className="text-xs text-[#9EA3AA] truncate">{r.subtitle}</div>}
                        </div>
                      </div>
                    ); })}
                  </>
                )}
              </>
            );
          })()}
        </div>

        <div className="px-4 py-2 border-t border-[#E8E8E9] flex items-center gap-3 text-[10px] text-[#B0B3B8]">
          <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
