'use client';

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, FolderOpen, Coins, Database, CreditCard, ShieldCheck, RefreshCw, MessageSquareWarning } from "lucide-react";

interface WeeklyPoint {
  week: string;
  count: number;
}

interface Stats {
  users: { total: number; enabled: number; disabled: number; admins: number };
  projects: number;
  creditsHeld: number;
  catalogItems: number;
  openLeads?: number;
  totalLeads?: number;
  usersTrend?: WeeklyPoint[];
  projectsTrend?: WeeklyPoint[];
}

/** Inline SVG sparkline — no charting dependency. */
function Sparkline({ data, color = "#f97316" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 96;
  const h = 24;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (v / max) * h}`);
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" aria-hidden="true" preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  sub,
  highlight,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-2 ${highlight ? 'border-orange-500/40 bg-orange-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Icon size={15} className="text-orange-500" />
        {label}
      </div>
      {value === null ? (
        <div className="h-8 w-16 rounded bg-gray-800 animate-pulse" />
      ) : (
        <div className={`text-2xl font-bold ${highlight ? 'text-orange-300' : 'text-white'}`}>{value.toLocaleString()}</div>
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

      {/* User Messages & Reports */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <MessageSquareWarning size={13} /> User Messages &amp; Error Reports
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Open Messages & Issues"
            value={v(stats?.openLeads)}
            icon={MessageSquareWarning}
            sub="Awaiting admin review"
            highlight={(stats?.openLeads ?? 0) > 0}
          />
          <StatTile
            label="Total Submitted Reports"
            value={v(stats?.totalLeads)}
            icon={MessageSquareWarning}
            sub="All-time reports & inquiries"
          />
        </div>
        <Link
          href="/admin/feedback"
          className="inline-block text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
        >
          View all messages &amp; diagnostics →
        </Link>
      </section>

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

      {/* Signups / Projects trend */}
      {!loading && (stats?.usersTrend || stats?.projectsTrend) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw size={13} /> Growth — last 12 weeks
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users size={15} className="text-orange-500" />
                New signups per week
              </div>
              <Sparkline data={(stats?.usersTrend ?? []).map((p) => p.count)} />
              <div className="text-xs text-gray-500">
                Total this window: {(stats?.usersTrend ?? []).reduce((s, p) => s + p.count, 0)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <FolderOpen size={15} className="text-orange-500" />
                New projects per week
              </div>
              <Sparkline data={(stats?.projectsTrend ?? []).map((p) => p.count)} color="#38bdf8" />
              <div className="text-xs text-gray-500">
                Total this window: {(stats?.projectsTrend ?? []).reduce((s, p) => s + p.count, 0)}
              </div>
            </div>
          </div>
        </section>
      )}

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

