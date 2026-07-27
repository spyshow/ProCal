'use client';

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, FolderOpen, Coins, Database, CreditCard, ShieldCheck, RefreshCw } from "lucide-react";

interface Stats {
  users: { total: number; enabled: number; disabled: number; admins: number };
  projects: number;
  creditsHeld: number;
  catalogItems: number;
}

function StatTile({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-2">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Icon size={15} className="text-orange-500" />
        {label}
      </div>
      {value === null ? (
        <div className="h-8 w-16 rounded bg-gray-800 animate-pulse" />
      ) : (
        <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
      )}
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function PlaceholderTile({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-5 space-y-2 opacity-50">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <CreditCard size={15} />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-600">—</div>
      <div className="text-xs text-gray-600">Coming soon</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("non-ok");
      setStats(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const v = (n: number | undefined) => (loading ? null : (n ?? 0));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Live snapshot of ProCal operations.</p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400">Failed to load stats.</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Users size={13} /> Users
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total" value={v(stats?.users.total)} icon={Users} />
          <StatTile label="Enabled" value={v(stats?.users.enabled)} icon={ShieldCheck} />
          <StatTile label="Disabled" value={v(stats?.users.disabled)} icon={Users} />
          <StatTile label="Admins" value={v(stats?.users.admins)} icon={ShieldCheck} />
        </div>
        <Link
          href="/admin/users"
          className="inline-block text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Manage users →
        </Link>
      </section>

      {/* Projects & Catalog */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <FolderOpen size={13} /> Projects &amp; Catalog
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Total Projects" value={v(stats?.projects)} icon={FolderOpen} />
          <StatTile label="Credits Held" value={v(stats?.creditsHeld)} icon={Coins} sub="sum across all users" />
          <StatTile label="Catalog Items" value={v(stats?.catalogItems)} icon={Database} />
        </div>
        <Link
          href="/admin/breakers"
          className="inline-block text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Manage breaker catalog →
        </Link>
      </section>

      {/* Billing — placeholders */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <CreditCard size={13} /> Billing
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceholderTile label="MRR" />
          <PlaceholderTile label="Active Subscriptions" />
          <PlaceholderTile label="Churn Rate" />
        </div>
      </section>
    </div>
  );
}
