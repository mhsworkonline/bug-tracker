"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Loader2, ChevronDown } from "lucide-react";

interface Member { id: string; email: string; name?: string | null; role: "lead" | "member" }
interface User   { id: string; email?: string; name?: string }

interface Props {
  projectId: string;
  canManage: boolean;
  onClose: () => void;
}

export default function MembersPanel({ projectId, canManage, onClose }: Props) {
  const [members, setMembers]   = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selUser, setSelUser]   = useState("");
  const [selRole, setSelRole]   = useState<"lead" | "member">("member");
  const [adding, setAdding]     = useState(false);

  const load = useCallback(async () => {
    const [mRes, uRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/members`).then(r => r.json()),
      canManage ? fetch("/api/admin/users").then(r => r.json()) : Promise.resolve({ users: [] }),
    ]);
    setMembers(mRes.members ?? []);
    setAllUsers(uRes.users ?? []);
    setLoading(false);
  }, [projectId, canManage]);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!selUser) return;
    setAdding(true);
    await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: selUser, role: selRole }),
    });
    setSelUser(""); setAdding(false);
    await load();
  };

  const changeRole = async (userId: string, role: "lead" | "member") => {
    await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/projects/${projectId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setMembers(prev => prev.filter(m => m.id !== userId));
  };

  const nonMembers = allUsers.filter(u => u.email !== "admin@bugtracker.com" && !members.find(m => m.id === u.id));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E9]">
          <h2 className="text-base font-semibold text-[#151B26]">Project members</h2>
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={16} /></button>
        </div>

        {canManage && (
          <div className="px-5 py-3 border-b border-[#E8E8E9] flex gap-2">
            <select value={selUser} onChange={e => setSelUser(e.target.value)}
              className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
              <option value="">— Add user</option>
              {nonMembers.map(u => <option key={u.id} value={u.id}>{u.name ? `${u.name} (${u.email})` : u.email}</option>)}
            </select>
            <select value={selRole} onChange={e => setSelRole(e.target.value as "lead" | "member")}
              className="border border-[#E8E8E9] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#4573D9]">
              <option value="member">Member</option>
              <option value="lead">Project Lead</option>
            </select>
            <button onClick={addMember} disabled={!selUser || adding}
              className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />} Add
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-[#6B6F76] text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-[#B0B3B8] py-6 text-center">No members yet.</p>
          ) : (
            <div className="divide-y divide-[#F5F5F5]">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {m.name && <p className="text-sm font-medium text-[#151B26] truncate">{m.name}</p>}
                      <p className="text-xs text-[#6B6F76] truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canManage ? (
                      <div className="relative">
                        <select value={m.role} onChange={e => changeRole(m.id, e.target.value as "lead" | "member")}
                          className="appearance-none text-xs border border-[#E8E8E9] rounded px-2 py-1 pr-5 outline-none focus:border-[#4573D9] bg-white cursor-pointer">
                          <option value="member">Member</option>
                          <option value="lead">Project Lead</option>
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6B6F76] pointer-events-none" />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "lead" ? "bg-[#EEF2FB] text-[#4573D9]" : "bg-[#F5F5F5] text-[#6B6F76]"}`}>
                        {m.role === "lead" ? "Project Lead" : "Member"}
                      </span>
                    )}
                    {canManage && (
                      <button onClick={() => removeMember(m.id)}
                        className="p-1 text-red-400 hover:bg-red-50 rounded ml-1"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
