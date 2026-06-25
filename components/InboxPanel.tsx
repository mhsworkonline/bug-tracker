"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bell, CheckCheck, X, MessageSquare, UserCheck, AlertCircle } from "lucide-react";

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
  task_assigned: <UserCheck size={14} className="text-[#4573D9]" />,
  comment:       <MessageSquare size={14} className="text-[#8B5CF6]" />,
  default:       <AlertCircle size={14} className="text-[#6B6F76]" />,
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

export default function InboxPanel({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [notifs, setNotifs]         = useState<Notification[]>([]);
  const [unread, setUnread]         = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!userEmail) return;
    const { data } = await supabase.from("BT_notifications").select("*").eq("user_email", userEmail).order("created_at", { ascending: false }).limit(30);
    const rows = (data as Notification[]) ?? [];
    setNotifs(rows);
    setUnread(rows.filter(n => !n.read).length);
  };

  useEffect(() => { load(); }, [userEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    if (!userEmail) return;
    const ch = supabase.channel("inbox").on("postgres_changes", {
      event: "INSERT", schema: "public", table: "BT_notifications",
      filter: `user_email=eq.${userEmail}`,
    }, payload => {
      setNotifs(prev => [payload.new as Notification, ...prev]);
      setUnread(u => u + 1);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userEmail]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const markAllRead = async () => {
    if (!userEmail) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    await supabase.from("BT_notifications").update({ read: true }).eq("user_email", userEmail).eq("read", false);
  };

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(u => Math.max(0, u - 1));
    await supabase.from("BT_notifications").update({ read: true }).eq("id", id);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.project_id) router.push(`/projects/${n.project_id}`);
    setOpen(false);
  };

  if (!userEmail) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        className="relative p-2 text-[#6B6F76] hover:bg-[#F5F5F5] rounded-md"
        title="Inbox"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#E8E8E9] rounded-xl shadow-xl z-[150] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E9]">
            <span className="font-semibold text-sm text-[#151B26]">Inbox {unread > 0 && <span className="text-[#4573D9]">({unread})</span>}</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[#6B6F76] hover:text-[#151B26] px-2 py-1 rounded hover:bg-[#F5F5F5]">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-[#6B6F76] hover:text-[#151B26] rounded hover:bg-[#F5F5F5]"><X size={14} /></button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {notifs.length === 0 && (
              <div className="py-12 text-center">
                <Bell size={24} className="text-[#E8E8E9] mx-auto mb-2" />
                <p className="text-sm text-[#6B6F76]">No notifications yet</p>
              </div>
            )}
            {notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#FAFBFC] border-b border-[#F0F1F3] last:border-0 transition-colors ${!n.read ? "bg-[#F8FAFF]" : ""}`}
              >
                <div className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.default}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm leading-snug truncate ${!n.read ? "font-medium text-[#151B26]" : "text-[#6B6F76]"}`}>{n.title}</div>
                  {n.body && <div className="text-xs text-[#9EA3AA] mt-0.5 truncate">{n.body}</div>}
                  <div className="text-[10px] text-[#B0B3B8] mt-1">{fmtRelative(n.created_at)}</div>
                </div>
                {!n.read && <span className="w-2 h-2 bg-[#4573D9] rounded-full flex-shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
