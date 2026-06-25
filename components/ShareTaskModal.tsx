"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, Link, Lock, ChevronDown, Loader2, ClipboardList } from "lucide-react";

interface Follower { id: string; user_email: string; }

interface Props {
  taskId: string;
  taskName: string;
  projectId: string;
  projectName: string;
  userEmail?: string;
  onClose: () => void;
}

export default function ShareTaskModal({ taskId, taskName, projectId, projectName, userEmail, onClose }: Props) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [invite, setInvite]       = useState("");
  const [inviting, setInviting]   = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied]       = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("BT_task_followers").select("id, user_email").eq("task_id", taskId)
      .then(({ data }) => setFollowers((data as Follower[]) ?? []));
  }, [taskId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleInvite = async () => {
    const email = invite.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Enter a valid email."); return;
    }
    if (followers.find(f => f.user_email === email)) {
      setInviteError("Already has access."); return;
    }
    setInviting(true); setInviteError("");
    const { data } = await supabase.from("BT_task_followers")
      .insert({ task_id: taskId, user_email: email }).select().single();
    if (data) {
      setFollowers(prev => [...prev, data as Follower]);
      import("@/lib/notify").then(({ notify }) =>
        notify(email, "task_assigned", `You were added to "${taskName}"`, `Added by ${userEmail ?? "someone"}`, projectId, taskId)
      );
    }
    setInvite(""); setInviting(false);
  };

  const leaveOrRemove = async (id: string) => {
    setFollowers(prev => prev.filter(f => f.id !== id));
    await supabase.from("BT_task_followers").delete().eq("id", id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/tasks/${taskId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-black/30 z-[300] flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E9]">
          <h2 className="text-base font-semibold text-[#151B26] truncate pr-4">Share {taskName}</h2>
          <button onClick={onClose} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Invite */}
          <div>
            <p className="text-sm font-semibold text-[#151B26] mb-2">Invite with email</p>
            <div className="flex gap-2">
              <input
                value={invite}
                onChange={e => { setInvite(e.target.value); setInviteError(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                placeholder="Add members by name or email..."
                className="flex-1 text-sm border border-[#4573D9] rounded-lg px-3 py-2 outline-none"
              />
              <button onClick={handleInvite} disabled={inviting || !invite.trim()}
                className="px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-lg hover:bg-[#F5F5F5] disabled:opacity-40 flex items-center gap-1.5">
                {inviting && <Loader2 size={13} className="animate-spin" />} Invite
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-500 mt-1">{inviteError}</p>}
          </div>

          {/* Access settings */}
          <div>
            <p className="text-sm font-semibold text-[#151B26] mb-2">Access settings</p>
            <div className="flex items-center justify-between border border-[#E8E8E9] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-[#151B26]">
                <Lock size={14} className="text-[#6B6F76]" />
                Members of this task and connected projects
              </div>
              <ChevronDown size={14} className="text-[#6B6F76]" />
            </div>
          </div>

          {/* Who has access */}
          <div>
            <p className="text-sm font-semibold text-[#151B26] mb-3">Who has access</p>
            <div className="flex flex-col gap-3">
              {/* Project row */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] border border-[#E8E8E9] flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={14} className="text-[#6B6F76]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#151B26]">{projectName}</div>
                  <div className="text-xs text-[#9EA3AA]">Private</div>
                </div>
              </div>

              {/* Current user */}
              {userEmail && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {userEmail.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#151B26]">{userEmail.split("@")[0].toUpperCase()}</div>
                    <div className="text-xs text-[#9EA3AA]">{userEmail}</div>
                  </div>
                </div>
              )}

              {/* Followers */}
              {followers.filter(f => f.user_email !== userEmail).map(f => (
                <div key={f.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#4573D9] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {f.user_email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#151B26] truncate">{f.user_email}</div>
                  </div>
                  <button onClick={() => leaveOrRemove(f.id)} className="px-3 py-1 text-xs border border-[#E8E8E9] rounded-md text-[#6B6F76] hover:bg-[#F5F5F5] flex-shrink-0">
                    Remove
                  </button>
                </div>
              ))}

              {/* Current user's follower record — "Leave task" */}
              {followers.find(f => f.user_email === userEmail) && (
                <div className="flex justify-end">
                  <button onClick={() => { const f = followers.find(x => x.user_email === userEmail); if (f) leaveOrRemove(f.id); }}
                    className="px-3 py-1 text-xs border border-[#E8E8E9] rounded-md text-[#6B6F76] hover:bg-[#F5F5F5]">
                    Leave task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E8E9] flex justify-end">
          <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2 border border-[#E8E8E9] rounded-lg text-sm text-[#151B26] hover:bg-[#F5F5F5]">
            <Link size={13} /> {copied ? "Copied!" : "Copy task link"}
          </button>
        </div>
      </div>
    </div>
  );
}
