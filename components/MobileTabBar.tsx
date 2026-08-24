"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, CheckSquare, Bell, Search } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/auth-browser";
import { supabase } from "@/lib/supabase";

// Routes with their own shell (admin sidebar/header, the public login screen, public
// intake forms, the full-bleed media viewer) don't get the app's mobile tab bar.
const HIDDEN_PREFIXES = ["/admin", "/login", "/forms", "/media"];

const TABS = [
  { href: "/projects", label: "Projects", Icon: FolderKanban },
  { href: "/my-tasks", label: "My Tasks", Icon: CheckSquare },
  { href: "/inbox",    label: "Inbox",    Icon: Bell },
] as const;

// Fixed bottom tab bar, mobile-only — the persistent navigation chrome the app was
// missing (every page previously rolled its own inline header, so switching sections
// felt like following links between web pages rather than tapping between app screens).
export default function MobileTabBar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    createSupabaseBrowser().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    supabase.from("BT_notifications").select("id", { count: "exact", head: true })
      .eq("user_email", userEmail).eq("read", false)
      .then(({ count }) => setUnread(count ?? 0));

    const ch = supabase.channel("tabbar-inbox-unread").on("postgres_changes", {
      event: "INSERT", schema: "public", table: "BT_notifications",
      filter: `user_email=eq.${userEmail}`,
    }, () => setUnread(u => u + 1)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userEmail]);

  if (!userEmail) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[120] bg-white border-t border-[#E8E8E9] flex items-stretch"
      style={{ height: "calc(var(--bt-tabbar-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        const badge = href === "/inbox" ? unread : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${active ? "text-[#4573D9]" : "text-[#6B6F76]"}`}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.25 : 2} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("bt-open-search"))}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[#6B6F76]"
      >
        <Search size={22} />
        <span className="text-[10px] font-medium">Search</span>
      </button>
    </nav>
  );
}
