"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, Plus, Loader2 } from "lucide-react";

interface Project { id: string; name: string; }
interface User    { id: string; email?: string; }
interface Member  { id: string; project_id: string; user_id: string; role: string; }

export default function ProjectMembersSection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [selProject, setSelProject] = useState("");
  const [selUser, setSelUser]       = useState("");
  const [adding, setAdding]         = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("BT_projects").select("id,name").order("created_at"),
      fetch("/api/admin/users").then(r => r.json()),
    ]).then(([{ data: p }, u]) => {
      setProjects(p ?? []);
      setUsers(u.users ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selProject) { setMembers([]); return; }
    fetch(`/api/admin/members?project_id=${selProject}`)
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []));
  }, [selProject]);

  const addMember = async () => {
    if (!selProject || !selUser) return;
    setAdding(true);
    await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: selProject, user_id: selUser }) });
    setAdding(false);
    const r = await fetch(`/api/admin/members?project_id=${selProject}`);
    const d = await r.json();
    setMembers(d.members ?? []);
  };

  const removeMember = async (userId: string) => {
    await fetch("/api/admin/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: selProject, user_id: userId }) });
    setMembers(m => m.filter(x => x.user_id !== userId));
  };

  const emailOf = (uid: string) => users.find(u => u.id === uid)?.email ?? uid.slice(0,8);

  return (
    <section className="bg-white rounded-xl border border-[#E8E8E9] p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-4">Project Members</h2>
      {loading ? <div className="text-sm text-[#6B6F76]">Loading…</div> : (
        <>
          <div className="flex gap-2 mb-4">
            <select value={selProject} onChange={e => setSelProject(e.target.value)} className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
              <option value="">— Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={selUser} onChange={e => setSelUser(e.target.value)} className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
              <option value="">— Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <button onClick={addMember} disabled={!selProject || !selUser || adding} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
            </button>
          </div>
          {selProject && members.length === 0 && <p className="text-sm text-[#B0B3B8]">No members yet</p>}
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-[#F5F5F5] last:border-0">
                <span className="text-sm text-[#151B26]">{emailOf(m.user_id)}</span>
                <button onClick={() => removeMember(m.user_id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
