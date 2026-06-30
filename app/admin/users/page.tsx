"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, Key, Plus, Loader2, Users, Pencil } from "lucide-react";

interface User    { id: string; email?: string; name?: string; created_at: string; }
interface Project { id: string; name: string; }
interface Member  { id: string; project_id: string; user_id: string; }

export default function UsersPage() {
  const [users, setUsers]       = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);

  // Create user form
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Password change
  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [newPw, setNewPw]       = useState("");
  const [saving, setSaving]     = useState(false);

  // Name edit
  const [nameUserId, setNameUserId] = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [savingName, setSavingName] = useState(false);

  // Project assignment
  const [selProject, setSelProject] = useState("");
  const [selUser, setSelUser]       = useState("");
  const [adding, setAdding]         = useState(false);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    const d = await r.json();
    setUsers(d.users ?? []);
  }, []);

  const loadMembers = useCallback(async () => {
    const r = await fetch("/api/admin/members");
    const d = await r.json();
    setMembers(d.members ?? []);
  }, []);

  useEffect(() => {
    Promise.all([
      loadUsers(),
      supabase.from("BT_projects").select("id,name").order("created_at").then(({ data }) => setProjects(data ?? [])),
      loadMembers(),
    ]).then(() => setLoading(false));
  }, [loadUsers, loadMembers]);

  const createUser = async () => {
    setCreateErr(""); setCreating(true);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const d = await r.json();
    setCreating(false);
    if (d.error) { setCreateErr(d.error); return; }
    setName(""); setEmail(""); setPassword("");
    await loadUsers();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setUsers(u => u.filter(x => x.id !== id));
    setMembers(m => m.filter(x => x.user_id !== id));
  };

  const changePassword = async () => {
    if (!pwUserId || !newPw) return;
    setSaving(true);
    await fetch(`/api/admin/users/${pwUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPw }) });
    setSaving(false); setPwUserId(null); setNewPw("");
  };

  const saveName = async () => {
    if (!nameUserId) return;
    setSavingName(true);
    await fetch(`/api/admin/users/${nameUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName }) });
    setSavingName(false); setNameUserId(null);
    await loadUsers();
  };

  const addMember = async () => {
    if (!selProject || !selUser) return;
    setAdding(true);
    await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: selProject, user_id: selUser }) });
    setAdding(false);
    await loadMembers();
  };

  const removeMember = async (projectId: string, userId: string) => {
    await fetch("/api/admin/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, user_id: userId }) });
    setMembers(m => m.filter(x => !(x.project_id === projectId && x.user_id === userId)));
  };

  const emailOf = (uid: string) => users.find(u => u.id === uid)?.email ?? uid.slice(0, 8);
  const nameOf  = (uid: string) => users.find(u => u.id === uid)?.name;
  const projectName = (pid: string) => projects.find(p => p.id === pid)?.name ?? pid.slice(0, 8);

  return (
    <div>
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center gap-3">
        <Users size={16} className="text-[#6B6F76]" />
        <h1 className="text-base font-semibold text-[#151B26]">Members</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-[#6B6F76] text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">

          {/* Create user */}
          <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[#151B26] mb-4">Create User</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <button onClick={createUser} disabled={!name || !email || !password || creating} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center justify-center gap-1">
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create user
              </button>
            </div>
            {createErr && <p className="text-sm text-red-500">{createErr}</p>}
          </section>

          {/* Users list */}
          <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[#151B26] mb-4">Users ({users.length})</h2>
            <div className="flex flex-col divide-y divide-[#F5F5F5]">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2.5">
                  <div>
                    {u.name && <p className="text-sm font-medium text-[#151B26]">{u.name}</p>}
                    <p className="text-sm text-[#6B6F76]">{u.email}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setNameUserId(u.id); setEditName(u.name ?? ""); }} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded" title="Edit name"><Pencil size={13} /></button>
                    <button onClick={() => { setPwUserId(u.id); setNewPw(""); }} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded" title="Change password"><Key size={13} /></button>
                    <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Project members */}
          <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[#151B26] mb-4">Project Members</h2>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <select value={selProject} onChange={e => setSelProject(e.target.value)} className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
                <option value="">— Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={selUser} onChange={e => setSelUser(e.target.value)} className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
                <option value="">— User</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name ? `${u.name} (${u.email})` : u.email}</option>)}
              </select>
              <button onClick={addMember} disabled={!selProject || !selUser || adding} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
                {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
              </button>
            </div>
            {members.length === 0 && <p className="text-sm text-[#B0B3B8]">No members assigned yet</p>}
            <div className="flex flex-col divide-y divide-[#F5F5F5]">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-[#151B26]">{nameOf(m.user_id) ?? emailOf(m.user_id)}</span>
                    <span className="text-xs text-[#B0B3B8] ml-2">→ {projectName(m.project_id)}</span>
                  </div>
                  <button onClick={() => removeMember(m.project_id, m.user_id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Edit name modal */}
      {nameUserId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[calc(100vw-2rem)] sm:w-80">
            <h3 className="text-sm font-semibold mb-3">Edit Name</h3>
            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name"
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setNameUserId(null); }}
              className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9] mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNameUserId(null)} className="px-3 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded-lg">Cancel</button>
              <button onClick={saveName} disabled={savingName} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1">
                {savingName && <Loader2 size={12} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {pwUserId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[calc(100vw-2rem)] sm:w-80">
            <h3 className="text-sm font-semibold mb-3">Change Password</h3>
            <input autoFocus value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="New password"
              className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9] mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPwUserId(null)} className="px-3 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded-lg">Cancel</button>
              <button onClick={changePassword} disabled={!newPw || saving} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 size={12} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
