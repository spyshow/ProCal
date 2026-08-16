'use client';

import { useEffect, useState } from "react";
import { Users, UserPlus, Pencil, X } from "lucide-react";

type User = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  credits: number;
  disabled: boolean;
  createdAt: string;
  _count: { projects: number };
};

const EMPTY_CREATE = { username: "", name: "", email: "", password: "", role: "USER", credits: 0 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 w-full";
const SELECT = INPUT;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "USER", credits: 0, disabled: false });
  const [saving, setSaving] = useState(false);

  async function load(q = "") {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`);
    if (res.ok) setUsers(await res.json());
    else setError(`Failed to load users (${res.status})`);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email || "", role: u.role, credits: u.credits, disabled: u.disabled });
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      const created: User = await res.json();
      setUsers((prev) => [created, ...prev]);
      setCreateForm(EMPTY_CREATE);
      setShowCreate(false);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Create failed (${res.status})`);
    }
    setCreating(false);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)));
      setEditUser(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Update failed (${res.status})`);
    }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-orange-500" />
            Users
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage roles, credits, and access.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      <input
        type="search"
        placeholder="Search by username, name, or email…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
        className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500"
      />

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm text-gray-300">
            <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase">
              <tr>
                {["User", "Email", "Role", "Credits", "Projects", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className={u.disabled ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-200">{u.name}</div>
                    <div className="text-xs text-gray-500">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    {u.email || <span className="text-gray-600 italic">No email</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${u.role === "ADMIN" ? "bg-orange-500/20 text-orange-400" : "bg-gray-800 text-gray-400"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u.credits}</td>
                  <td className="px-4 py-3 text-gray-400">{u._count.projects}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${u.disabled ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                      {u.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(u)} className="text-gray-500 hover:text-orange-400 transition-colors">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Add User" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <Field label="Username">
              <input required className={INPUT} placeholder="e.g. jsmith" value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
            </Field>
            <Field label="Full Name">
              <input required className={INPUT} placeholder="e.g. John Smith" value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            </Field>
            <Field label="Email Address">
              <input type="email" className={INPUT} placeholder="e.g. jsmith@example.com" value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </Field>
            <Field label="Password (min 6 characters)">
              <input required type="password" className={INPUT} placeholder="••••••" value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={SELECT} value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                <option value="USER">USER — standard access</option>
                <option value="ADMIN">ADMIN — full admin access</option>
              </select>
            </Field>
            <Field label="Starting Credits">
              <input type="number" min={0} className={INPUT} value={createForm.credits}
                onChange={(e) => setCreateForm({ ...createForm, credits: parseInt(e.target.value) || 0 })} />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {creating ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={submitEdit} className="space-y-4">
            <Field label="Full Name">
              <input required className={INPUT} value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Email Address">
              <input type="email" className={INPUT} placeholder="e.g. name@example.com" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={SELECT} value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="USER">USER — standard access</option>
                <option value="ADMIN">ADMIN — full admin access</option>
              </select>
            </Field>
            <Field label="Credits">
              <input type="number" min={0} className={INPUT} value={editForm.credits}
                onChange={(e) => setEditForm({ ...editForm, credits: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Account Status">
              <select className={SELECT} value={editForm.disabled ? "disabled" : "active"}
                onChange={(e) => setEditForm({ ...editForm, disabled: e.target.value === "disabled" })}>
                <option value="active">Active — user can log in</option>
                <option value="disabled">Disabled — user cannot log in</option>
              </select>
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

