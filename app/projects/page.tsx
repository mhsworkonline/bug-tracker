"use client";

import { useState } from "react";
import { Search, Plus, ChevronDown, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import ProjectsTable from "@/components/ProjectsTable";

export default function ProjectsPage() {
  const { projects, loading } = useStore();
  const [query, setQuery] = useState("");

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#151B26]">Browse projects</h1>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md transition-colors" title="Admin settings">
              <Settings size={16} />
            </Link>
            <Link href="/projects/new" className="flex items-center gap-1.5 px-4 py-2 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4] transition-colors">
              <Plus size={14} /> Create project
            </Link>
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6F76] pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a project"
            className="w-full pl-9 pr-4 py-2 border border-[#E8E8E9] rounded-md text-sm outline-none focus:border-[#4573D9] text-[#151B26] placeholder-[#6B6F76]"
          />
        </div>

        <div className="flex gap-2 mb-6">
          {["Owner", "Members", "Status"].map((f) => (
            <button key={f} className="flex items-center gap-1 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-full hover:bg-[#FAFBFC] transition-colors">
              {f} <ChevronDown size={13} />
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[#6B6F76] text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading projects…
          </div>
        ) : (
          <ProjectsTable projects={filtered} />
        )}
      </div>
    </div>
  );
}
