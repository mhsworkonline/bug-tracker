"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, Users, Plus, LogOut } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/auth-browser";

export default function AdminHeader() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    createSupabaseBrowser().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const handleLogout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center justify-between">
      <Link href="/projects" className="text-xl font-bold text-[#151B26] hover:text-[#4573D9] transition-colors">
        Browse projects
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        {email && (
          <div className="flex items-center gap-2 mr-1 sm:mr-2">
            <Link href="/admin" className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 hover:opacity-80 transition-opacity" title="Admin dashboard">
              {email.slice(0, 2).toUpperCase()}
            </Link>
            <span className="hidden sm:block text-sm text-[#6B6F76]">{email}</span>
          </div>
        )}
        <Link href="/admin/settings" className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md" title="Settings">
          <Settings size={16} />
        </Link>
        <Link href="/admin/users" className="hidden sm:flex items-center gap-1.5 px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#F5F5F5]">
          <Users size={14} /> Users
        </Link>
        <Link href="/projects/new" className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#4573D9] text-white text-sm rounded-md hover:bg-[#3F65C4]">
          <Plus size={14} /> <span className="hidden sm:inline">Create project</span><span className="sm:hidden">New</span>
        </Link>
        <button onClick={handleLogout} className="p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
