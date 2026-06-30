"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Users, Activity, Settings, ChevronDown,
  Tag, HardDrive, Puzzle, ShieldCheck, FolderOpen,
} from "lucide-react";
import { useState, useEffect } from "react";

const SETTINGS_TABS = [
  { key: "general",      label: "General",          icon: ShieldCheck },
  { key: "labels",       label: "Labels",            icon: Tag },
  { key: "storage",      label: "Storage & Export",  icon: HardDrive },
  { key: "integrations", label: "Integrations",      icon: Puzzle },
];

export default function AdminSidebar() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const activeTab    = searchParams.get("tab") ?? "general";

  const isSettings   = pathname === "/admin/settings";
  const [settingsOpen, setSettingsOpen] = useState(isSettings);

  // Keep settings open when navigating to settings
  useEffect(() => { if (isSettings) setSettingsOpen(true); }, [isSettings]);

  const navItem = (href: string, icon: React.ReactNode, label: string, exact = false) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
          active
            ? "bg-[#EEF2FB] text-[#4573D9] font-medium"
            : "text-[#6B6F76] hover:bg-[#F5F5F5] hover:text-[#151B26]"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[#E8E8E9] bg-white min-h-full flex flex-col">
      <nav className="flex flex-col gap-0.5 p-3 flex-1">

        {/* Back */}
        <Link
          href="/projects"
          className="flex items-center gap-2 px-3 py-2 text-xs text-[#9EA3AA] hover:text-[#6B6F76] mb-1"
        >
          <FolderOpen size={13} /> Browse projects
        </Link>

        <div className="my-1 border-t border-[#F0F1F3]" />

        {navItem("/admin", <LayoutDashboard size={15} />, "Overview", true)}
        {navItem("/admin/users", <Users size={15} />, "Members")}
        {navItem("/admin/activity", <Activity size={15} />, "Activity Log")}

        <div className="my-1 border-t border-[#F0F1F3]" />

        {/* Settings group */}
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors ${
            isSettings
              ? "text-[#151B26] font-medium"
              : "text-[#6B6F76] hover:bg-[#F5F5F5] hover:text-[#151B26]"
          }`}
        >
          <Settings size={15} />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown
            size={13}
            className={`transition-transform text-[#9EA3AA] ${settingsOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </button>

        {settingsOpen && (
          <div className="ml-3 pl-3 border-l border-[#E8E8E9] flex flex-col gap-0.5 mt-0.5">
            {SETTINGS_TABS.map(t => {
              const Icon = t.icon;
              const active = isSettings && activeTab === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/admin/settings?tab=${t.key}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-[#EEF2FB] text-[#4573D9] font-medium"
                      : "text-[#6B6F76] hover:bg-[#F5F5F5] hover:text-[#151B26]"
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
