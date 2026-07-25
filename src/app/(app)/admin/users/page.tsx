'use client';

import { useEffect, useState } from "react";
import { Users, ShieldCheck, ShieldOff, Plus, Minus, UserPlus, X } from "lucide-react";

type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  credits: number;
  disabled: boolean;
  createdAt: string;
  _count: { projects: number };
};

const EMPTY_FORM = { username: "", name: "", password: "", role: "USER", credits: 0 };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  async function load(q = "") {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`);
    if (res.ok) setUsers(await res.json());
    else setError(`Failed to load users (${res.status})`);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function patch(id: string, data: Partial<Pick<User, "role" | "credits" | "disabled">>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    } else {
      setError(`Update failed (${res.status})`);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const user: User = await res.json();
      setUsers((prev) => [user, ...prev]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Create failed (${res.status})`);
    }
    setCreating(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users size={22} className="text-orange-500" />
              Users
            </h1>
            <p className="text-sm text-gray-400 mt-1">Manage roles, credits, and access.</p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            {showCreate ? <X size={16} /> : <UserPlus size={16} />}
            {showCreate ? "Cancel" : "Add User"}
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={create} className="grid gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input required placeholder="Username" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input required placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input required type="password" placeholder="Password (min 6)" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <div className="flex gap-2">
            <input type="number" min={0} placeholder="Credits" value={form.credits}
              onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            <button type="submit" disabled={creating}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {creating ? "…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <input
        type="search"
        placeholder="Search by username or name…"
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
                {["User", "Role", "Credits", "Projects", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className={u.disabled ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-200">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        u.role === "ADMIN"
                          ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {u.role === "ADMIN" ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                      {u.role}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => patch(u.id, { credits: Math.max(0, u.credits - 1) })}
                        disabled={u.credits === 0}
                        className="rounded p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center">{u.credits}</span>
                      <button
                        onClick={() => patch(u.id, { credits: u.credits + 1 })}
                        className="rounded p-1 text-gray-500 hover:text-gray-300"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u._count.projects}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      u.disabled ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                    }`}>
                      {u.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(u.id, { disabled: !u.disabled })}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
