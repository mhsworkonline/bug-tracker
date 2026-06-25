"use client";
import { useState } from "react";
import { Search, Plus, ChevronDown, Loader2, Settings, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import ProjectsTable from "@/components/ProjectsTable";
import { createSupabaseBrowser } from "@/lib/auth-browser";

interface Props {
  isAdmin: boolean;
  userEmail?: string;
  allowedProjectIds: string[] | null;
}

export default function ProjectsPageClient({ isAdmin, userEmail, allowedProjectIds }: Props) {
  const router = useRouter();
  const { projects, loading } = useStore();
  const [query, setQuery] = useState("");

  const visible = projects.filter(p => {
    if (!isAdmin && p.is_active === false) return false;
    if (allowedProjectIds !== null && !allowedProjectIds.includes(p.id)) return false;
    return p.name.toLowerCase().includes(query.toLowerCase());
  });

  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
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

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-[#6B6F76] text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading projects…
          </div>
        ) : (
          <ProjectsTable projects={visible} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
