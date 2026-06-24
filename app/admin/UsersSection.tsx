"use client";
import { useEffect, useState } from "react";
import { Trash2, Key, Plus, Loader2 } from "lucide-react";

interface User { id: string; email?: string; created_at: string; }

export default function UsersSection() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail]     = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState("");
  const [pwUserId, setPwUserId]     = useState<string|null>(null);
  const [newPw, setNewPw]           = useState("");
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/admin/users");
    const d = await r.json();
    setUsers(d.users ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError(""); setCreating(true);
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newEmail, password: newPassword }) });
    const d = await r.json();
    setCreating(false);
    if (d.error) { setError(d.error); return; }
    setNewEmail(""); setNewPassword(""); load();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  };

  const changePassword = async () => {
    if (!pwUserId || !newPw) return;
    setSaving(true);
    await fetch(`/api/admin/users/${pwUserId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPw }) });
    setSaving(false); setPwUserId(null); setNewPw("");
  };

  return (
    <section className="bg-white rounded-xl border border-[#E8E8E9] p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-4">Users</h2>

      {/* Create user */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
        <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" type="password" className="flex-1 border border-[#E8E8E9] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#4573D9]" />
        <button onClick={create} disabled={!newEmail || !newPassword || creating} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center justify-center gap-1">
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {/* User list */}
      {loading ? <div className="text-sm text-[#6B6F76]">Loading…</div> : (
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
              <div>
                <p className="text-sm text-[#151B26]">{u.email}</p>
                <p className="text-xs text-[#B0B3B8]">{u.id.slice(0,8)}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setPwUserId(u.id); setNewPw(""); }} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded" title="Change password"><Key size={13} /></button>
                <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Delete user"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Change password modal */}
      {pwUserId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-sm font-semibold mb-3">Change Password</h3>
            <input autoFocus value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="New password" className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9] mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setPwUserId(null); setNewPw(""); }} className="px-3 py-1.5 text-sm text-[#6B6F76] hover:bg-[#F5F5F5] rounded-lg">Cancel</button>
              <button onClick={changePassword} disabled={!newPw || saving} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 size={12} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
