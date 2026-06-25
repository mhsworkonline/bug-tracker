"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown, Send, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface Update {
  id: string;
  user_email: string | null;
  status: string;
  note: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  on_track:  { label: "On track",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle size={13} className="text-emerald-500" /> },
  at_risk:   { label: "At risk",    color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",     icon: <AlertTriangle size={13} className="text-amber-500" /> },
  off_track: { label: "Off track",  color: "text-red-600",     bg: "bg-red-50 border-red-200",         icon: <XCircle size={13} className="text-red-500" /> },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props { projectId: string; userEmail?: string; isAdmin?: boolean; }

export default function ProjectStatusUpdates({ projectId, userEmail, isAdmin }: Props) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftStatus, setDraftStatus] = useState("on_track");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("BT_project_updates").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setUpdates((data as Update[]) ?? []));
  }, [projectId]);

  const submit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    const { data } = await supabase.from("BT_project_updates")
      .insert({ project_id: projectId, user_email: userEmail ?? null, status: draftStatus, note: draft.trim() })
      .select().single();
    if (data) setUpdates(prev => [data as Update, ...prev]);
    setDraft(""); setComposing(false); setSubmitting(false);
  };

  const visible = showAll ? updates : updates.slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#151B26]">Status Updates</h3>
        {isAdmin && (
          <button onClick={() => setComposing(v => !v)} className="text-xs text-[#4573D9] hover:underline">+ Post update</button>
        )}
      </div>

      {composing && isAdmin && (
        <div className="border border-[#E8E8E9] rounded-lg p-3 mb-4 flex flex-col gap-2">
          <select value={draftStatus} onChange={e => setDraftStatus(e.target.value)} className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1.5 bg-white outline-none focus:border-[#4573D9]">
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="What's the current status? Any blockers?" rows={3} className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1.5 outline-none focus:border-[#4573D9] resize-none" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting || !draft.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded hover:bg-[#3F65C4] disabled:opacity-50">
              <Send size={12} /> Post
            </button>
            <button onClick={() => { setComposing(false); setDraft(""); }} className="px-3 py-1.5 border border-[#E8E8E9] text-sm rounded hover:bg-[#F5F5F5]">Cancel</button>
          </div>
        </div>
      )}

      {updates.length === 0 && (
        <p className="text-xs text-[#9EA3AA]">No status updates yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map(u => {
          const s = STATUS_MAP[u.status] ?? STATUS_MAP.on_track;
          return (
            <div key={u.id} className={`border rounded-lg p-3 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {s.icon}
                <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                <span className="text-[10px] text-[#9EA3AA] ml-auto">{fmt(u.created_at)}</span>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{u.note}</p>
              {u.user_email && <p className="text-[10px] text-[#9EA3AA] mt-1.5">— {u.user_email}</p>}
            </div>
          );
        })}
      </div>

      {updates.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 flex items-center gap-1 text-xs text-[#6B6F76] hover:text-[#151B26]">
          <ChevronDown size={12} className={showAll ? "rotate-180" : ""} />
          {showAll ? "Show less" : `Show ${updates.length - 3} more`}
        </button>
      )}
    </div>
  );
}
