"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bell, CheckCheck, MessageSquare, UserCheck, AlertCircle, AtSign } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  project_id: string | null;
  task_id: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  task_assigned: <UserCheck size={16} className="text-[#4573D9]" />,
  comment:       <MessageSquare size={16} className="text-[#8B5CF6]" />,
  mention:       <AtSign size={16} className="text-emerald-500" />,
  default:       <AlertCircle size={16} className="text-[#6B6F76]" />,
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Full-screen counterpart to InboxPanel's dropdown — same data and actions, but as its
// own page (/inbox) so it can be a real MobileTabBar destination with normal back-button
// behavior, instead of a popover anchored to a bell icon.
export default function InboxClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  const load = async () => {
    const { data } = await supabase.from("BT_notifications").select("*").eq("user_email", userEmail).order("created_at", { ascending: false }).limit(50);
    setNotifs((data as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userEmail) return;
    const ch = supabase.channel("inbox-page").on("postgres_changes", {
      event: "INSERT", schema: "public", table: "BT_notifications",
      filter: `user_email=eq.${userEmail}`,
    }, payload => setNotifs(prev => [payload.new as Notification, ...prev])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userEmail]);

  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("BT_notifications").update({ read: true }).eq("user_email", userEmail).eq("read", false);
  };

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("BT_notifications").update({ read: true }).eq("id", id);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.project_id) router.push(`/projects/${n.project_id}`);
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] pb-[calc(var(--bt-tabbar-h)+env(safe-area-inset-bottom))] md:pb-0">
      <div className="sticky top-0 z-10 bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center justify-between" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <h1 className="text-base font-semibold text-[#151B26]">
          Inbox {unread > 0 && <span className="text-[#4573D9]">({unread})</span>}
        </h1>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[#6B6F76] hover:text-[#151B26] px-2 py-1 rounded hover:bg-[#F5F5F5]">
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#6B6F76]">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="py-20 text-center">
            <Bell size={28} className="text-[#E8E8E9] mx-auto mb-2" />
            <p className="text-sm text-[#6B6F76]">No notifications yet</p>
          </div>
        ) : (
          notifs.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full flex items-start gap-3 px-4 sm:px-8 py-4 text-left hover:bg-white border-b border-[#F0F1F3] transition-colors ${!n.read ? "bg-[#F8FAFF]" : ""}`}
            >
              <div className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.default}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm leading-snug ${!n.read ? "font-medium text-[#151B26]" : "text-[#6B6F76]"}`}>{n.title}</div>
                {n.body && <div className="text-xs text-[#9EA3AA] mt-0.5">{n.body}</div>}
                <div className="text-[11px] text-[#B0B3B8] mt-1">{fmtRelative(n.created_at)}</div>
              </div>
              {!n.read && <span className="w-2 h-2 bg-[#4573D9] rounded-full flex-shrink-0 mt-1.5" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
