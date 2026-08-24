"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, Link, ChevronDown, Check, Loader2 } from "lucide-react";
import Sheet from "@/components/Sheet";

interface Share {
  id: string;
  email: string;
  role: "editor" | "viewer" | "admin";
  notify_new_tasks: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  name?: string | null;
  role: "lead" | "member";
}

interface Props {
  projectId: string;
  projectName: string;
  ownerEmail?: string;
  canManage?: boolean;
  onClose: () => void;
  onManageMembers?: () => void;
}

const ROLES = ["editor", "viewer"] as const;

export default function ShareProjectModal({ projectId, projectName, ownerEmail, canManage, onClose, onManageMembers }: Props) {
  const [shares, setShares]       = useState<Share[]>([]);
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [invite, setInvite]       = useState("");
  const [role, setRole]           = useState<"editor" | "viewer">("editor");
  const [notifyNew, setNotifyNew] = useState(false);
  const [inviting, setInviting]   = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied]       = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  useEffect(() => {
    supabase.from("BT_project_shares").select("*").eq("project_id", projectId)
      .then(({ data }) => setShares((data as Share[]) ?? []));
    fetch(`/api/projects/${projectId}/members`).then(r => r.json())
      .then(d => setMembers(d.members ?? []));
  }, [projectId]);

  const handleInvite = async () => {
    const email = invite.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Enter a valid email address."); return;
    }
    if (email === ownerEmail) { setInviteError("You are already the project admin."); return; }
    if (shares.find(s => s.email === email)) { setInviteError("This person already has access."); return; }
    setInviting(true); setInviteError("");
    const { data, error } = await supabase.from("BT_project_shares")
      .insert({ project_id: projectId, email, role, notify_new_tasks: notifyNew })
      .select().single();
    if (error) { setInviteError("Failed to invite. Try again."); setInviting(false); return; }
    setShares(prev => [...prev, data as Share]);
    setInvite(""); setInviting(false);
  };

  const updateRole = async (id: string, newRole: "editor" | "viewer") => {
    setShares(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s));
    await supabase.from("BT_project_shares").update({ role: newRole }).eq("id", id);
  };

  const removeShare = async (id: string) => {
    setShares(prev => prev.filter(s => s.id !== id));
    await supabase.from("BT_project_shares").delete().eq("id", id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet onClose={onClose} maxWidth="max-w-lg" zIndex={200}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E9] flex-shrink-0">
        <h2 className="text-base font-semibold text-[#151B26]">Share {projectName}</h2>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="5" r="1.5" fill="currentColor"/><circle cx="11" cy="8" r="1.5" fill="currentColor"/></svg></button>
          <button onClick={onClose} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={16} /></button>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
          {/* Invite */}
          <div>
            <p className="text-sm font-semibold text-[#151B26] mb-2">Invite with email</p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border border-[#4573D9] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#4573D9]/20">
                <input
                  value={invite}
                  onChange={e => { setInvite(e.target.value); setInviteError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                  placeholder="Add members by name or email..."
                  className="flex-1 text-sm px-3 py-2 outline-none"
                />
                <div className="relative border-l border-[#E8E8E9]">
                  <button onClick={() => setShowRoleMenu(v => !v)} className="flex items-center gap-1 px-3 py-2 text-sm text-[#151B26] hover:bg-[#F5F5F5]">
                    {role.charAt(0).toUpperCase() + role.slice(1)} <ChevronDown size={12} />
                  </button>
                  {showRoleMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-lg shadow-lg py-1 z-10 w-28">
                      {ROLES.map(r => (
                        <button key={r} onClick={() => { setRole(r); setShowRoleMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#151B26] hover:bg-[#FAFBFC]">
                          {r === role && <Check size={12} className="text-[#4573D9]" />}
                          <span className={r !== role ? "ml-4" : ""}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleInvite} disabled={inviting || !invite.trim()}
                className="px-4 py-2 border border-[#E8E8E9] text-sm text-[#151B26] rounded-lg hover:bg-[#F5F5F5] disabled:opacity-40 flex items-center gap-1.5">
                {inviting ? <Loader2 size={13} className="animate-spin" /> : null} Invite
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-500 mt-1">{inviteError}</p>}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={notifyNew} onChange={e => setNotifyNew(e.target.checked)} className="w-3.5 h-3.5 accent-[#4573D9]" />
              <span className="text-xs text-[#6B6F76]">Notify when tasks are added to the project</span>
            </label>
          </div>

          {/* Who has access */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#151B26]">Who has access</p>
              {canManage && onManageMembers && (
                <button onClick={onManageMembers} className="text-xs text-[#4573D9] hover:underline">Manage roles</button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {/* Owner */}
              {ownerEmail && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {ownerEmail.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#151B26] truncate">{ownerEmail.split("@")[0]}</div>
                    <div className="text-xs text-[#9EA3AA] truncate">{ownerEmail}</div>
                  </div>
                  <span className="text-sm text-[#6B6F76] flex items-center gap-1">Project admin <ChevronDown size={12} /></span>
                </div>
              )}
              {/* Team members (added via Members) */}
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#14A454] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#151B26] truncate">{m.name || m.email}</div>
                    {m.name && <div className="text-xs text-[#9EA3AA] truncate">{m.email}</div>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#6B6F76] flex-shrink-0">
                    {m.role === "lead" ? "Project Lead" : "Member"}
                  </span>
                </div>
              ))}
              {/* Invited by email */}
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-[#4573D9] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {s.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#151B26] truncate">{s.email}</div>
                  </div>
                  <RoleDropdown role={s.role} onChange={r => updateRole(s.id, r)} onRemove={() => removeShare(s.id)} />
                </div>
              ))}
              {shares.length === 0 && members.length === 0 && !ownerEmail && (
                <p className="text-xs text-[#9EA3AA]">Only you have access.</p>
              )}
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#E8E8E9] flex justify-end flex-shrink-0">
        <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2 border border-[#E8E8E9] rounded-lg text-sm text-[#151B26] hover:bg-[#F5F5F5]">
          <Link size={13} /> {copied ? "Copied!" : "Copy project link"}
        </button>
      </div>
    </Sheet>
  );
}

function RoleDropdown({ role, onChange, onRemove }: { role: string; onChange: (r: "editor" | "viewer") => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-sm text-[#6B6F76] hover:text-[#151B26]">
        {role.charAt(0).toUpperCase() + role.slice(1)} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-lg shadow-lg py-1 z-10 w-36">
          {ROLES.map(r => (
            <button key={r} onClick={() => { onChange(r); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#151B26] hover:bg-[#FAFBFC]">
              {r === role && <Check size={12} className="text-[#4573D9]" />}
              <span className={r !== role ? "ml-4" : ""}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
            </button>
          ))}
          <div className="border-t border-[#E8E8E9] mt-1 pt-1">
            <button onClick={() => { onRemove(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-[#FFF5F5]">Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}
