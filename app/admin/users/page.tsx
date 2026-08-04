"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, Key, Plus, Loader2, Users, Search, X, ChevronDown } from "lucide-react";

interface User    { id: string; email?: string; name?: string; created_at: string; }
interface Project { id: string; name: string; }
interface Member  { id: string; project_id: string; user_id: string; role: "lead" | "member"; }

const ROLES: { value: "member" | "lead"; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "lead",   label: "Project Lead" },
];

export default function UsersPage() {
  const [users, setUsers]       = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");

  // Create user form
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Edit member modal
  const [editingId, setEditingId] = useState<string | null>(null);

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
      loadMembers(),
      supabase.from("BT_projects").select("id,name").order("created_at"),
    ]).then(([, , projectsRes]) => {
      setProjects(projectsRes.data ?? []);
      setLoading(false);
    });
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
    if (!confirm("Delete this member? This removes their account and all project memberships.")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setUsers(u => u.filter(x => x.id !== id));
    setMembers(m => m.filter(x => x.user_id !== id));
    setEditingId(null);
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q));
  }, [users, query]);

  const projectsOf = (userId: string) =>
    members.filter(m => m.user_id === userId)
      .map(m => ({ member: m, project: projects.find(p => p.id === m.project_id) }))
      .filter((x): x is { member: Member; project: Project } => !!x.project);

  const editingUser = users.find(u => u.id === editingId) ?? null;

  return (
    <div>
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center gap-3">
        <Users size={16} className="text-[#6B6F76]" />
        <h1 className="text-base font-semibold text-[#151B26]">Members</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-[#6B6F76] text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">

          {/* Create user */}
          <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[#151B26] mb-4">Add a new member</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
              <button onClick={createUser} disabled={!name || !email || !password || creating} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center justify-center gap-1">
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create member
              </button>
            </div>
            {createErr && <p className="text-sm text-red-500">{createErr}</p>}
            <p className="text-xs text-[#9EA3AA] mt-2">You can assign them to projects after creating the account — click their name below.</p>
          </section>

          {/* Members list */}
          <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-base font-semibold text-[#151B26]">All members ({users.length})</h2>
            </div>
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B3B8]" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email…"
                className="w-full border border-[#E8E8E9] rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
            </div>
            {filteredUsers.length === 0 && <p className="text-sm text-[#B0B3B8] text-center py-4">No members found.</p>}
            <div className="flex flex-col divide-y divide-[#F5F5F5]">
              {filteredUsers.map(u => {
                const projs = projectsOf(u.id);
                const initials = (u.name || u.email || "??").slice(0, 2).toUpperCase();
                return (
                  <button key={u.id} onClick={() => setEditingId(u.id)}
                    className="flex items-center gap-3 py-2.5 text-left hover:bg-[#FAFBFC] -mx-2 px-2 rounded-md transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#4573D9] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      {u.name && <p className="text-sm font-medium text-[#151B26] truncate">{u.name}</p>}
                      <p className="text-sm text-[#6B6F76] truncate">{u.email}</p>
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[45%]">
                      {projs.length === 0
                        ? <span className="text-xs text-[#B0B3B8]">No projects</span>
                        : projs.slice(0, 3).map(({ member, project }) => (
                            <span key={member.id} className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#6B6F76] truncate max-w-[120px]">{project.name}</span>
                          ))
                      }
                      {projs.length > 3 && <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#6B6F76]">+{projs.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Edit member modal — single place to edit everything about a member */}
      {editingUser && (
        <EditMemberModal
          user={editingUser}
          projects={projects}
          memberships={projectsOf(editingUser.id)}
          onClose={() => setEditingId(null)}
          onUserUpdated={loadUsers}
          onMembersChanged={loadMembers}
          onDelete={() => deleteUser(editingUser.id)}
        />
      )}
    </div>
  );
}

function EditMemberModal({
  user, projects, memberships, onClose, onUserUpdated, onMembersChanged, onDelete,
}: {
  user: User;
  projects: Project[];
  memberships: { member: Member; project: Project }[];
  onClose: () => void;
  onUserUpdated: () => Promise<void>;
  onMembersChanged: () => Promise<void>;
  onDelete: () => void;
}) {
  const [editName, setEditName]   = useState(user.name ?? "");
  const [editEmail, setEditEmail] = useState(user.email ?? "");
  const [newPw, setNewPw]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");
  const [saved, setSaved]         = useState(false);

  const [addProjectId, setAddProjectId] = useState("");
  const [addRole, setAddRole]           = useState<"member" | "lead">("member");
  const [adding, setAdding]             = useState(false);

  const assignedIds = new Set(memberships.map(m => m.project.id));
  const availableProjects = projects.filter(p => !assignedIds.has(p.id));

  const saveProfile = async () => {
    setSaving(true); setSaveErr(""); setSaved(false);
    const body: Record<string, string> = { name: editName, email: editEmail };
    if (newPw) body.password = newPw;
    const r = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    setSaving(false);
    if (d.error) { setSaveErr(d.error); return; }
    setNewPw("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await onUserUpdated();
  };

  const addMembership = async () => {
    if (!addProjectId) return;
    setAdding(true);
    await fetch("/api/admin/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: addProjectId, user_id: user.id, role: addRole }),
    });
    setAdding(false); setAddProjectId(""); setAddRole("member");
    await onMembersChanged();
  };

  const changeRole = async (projectId: string, role: "member" | "lead") => {
    await fetch("/api/admin/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_id: user.id, role }),
    });
    await onMembersChanged();
  };

  const removeMembership = async (projectId: string) => {
    await fetch("/api/admin/members", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, user_id: user.id }),
    });
    await onMembersChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full sm:w-[480px] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E9] sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-[#151B26]">Edit member</h2>
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Profile */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[#6B6F76]">Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name"
              className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />

            <label className="text-xs font-medium text-[#6B6F76] mt-1">Email</label>
            <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" placeholder="Email"
              className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />

            <label className="text-xs font-medium text-[#6B6F76] mt-1 flex items-center gap-1"><Key size={11} /> New password (optional)</label>
            <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="Leave blank to keep current password"
              className="border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />

            {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
            <div className="flex items-center gap-2 mt-1">
              <button onClick={saveProfile} disabled={saving || !editName && !editEmail}
                className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 size={12} className="animate-spin" />} Save changes
              </button>
              {saved && <span className="text-xs text-[#14A454]">Saved</span>}
            </div>
          </div>

          <div className="border-t border-[#F0F1F3] pt-4">
            <h3 className="text-sm font-semibold text-[#151B26] mb-3">Projects & roles</h3>

            {memberships.length === 0 && <p className="text-xs text-[#B0B3B8] mb-3">Not assigned to any project yet.</p>}
            <div className="flex flex-col gap-2 mb-3">
              {memberships.map(({ member, project }) => (
                <div key={member.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-[#F5F5F5] last:border-0">
                  <span className="text-sm text-[#151B26] truncate">{project.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="relative">
                      <select value={member.role} onChange={e => changeRole(project.id, e.target.value as "member" | "lead")}
                        className="appearance-none text-xs border border-[#E8E8E9] rounded px-2 py-1 pr-5 outline-none focus:border-[#4573D9] bg-white cursor-pointer">
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6B6F76] pointer-events-none" />
                    </div>
                    <button onClick={() => removeMembership(project.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>

            {availableProjects.length > 0 && (
              <div className="flex gap-2">
                <select value={addProjectId} onChange={e => setAddProjectId(e.target.value)}
                  className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]">
                  <option value="">— Add to project</option>
                  {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={addRole} onChange={e => setAddRole(e.target.value as "member" | "lead")}
                  className="border border-[#E8E8E9] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#4573D9]">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button onClick={addMembership} disabled={!addProjectId || adding}
                  className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                  {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[#F0F1F3] pt-4">
            <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg -mx-3">
              <Trash2 size={13} /> Delete member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
