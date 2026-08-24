'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, CheckCircle2, Clock, Loader2 } from 'lucide-react';

type LeadUser = { id: string; username: string; name: string; email: string | null };

type Lead = {
  id: string;
  userId: string;
  email: string | null;
  message: string;
  requestedCredits: number | null;
  status: string;
  createdAt: string;
  closedAt: string | null;
  user: LeadUser;
};

type StatusFilter = 'OPEN' | 'CLOSED' | 'ALL';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('OPEN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closingId, setClosingId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store' });
      if (res.status === 401) { setError('Unauthorized'); return; }
      if (res.status === 403) { setError('Admin access required'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeads(await res.json());
    } catch {
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleToggleClose = async (lead: Lead) => {
    const next = lead.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    setClosingId(lead.id);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not update lead');
        return;
      }
      // Re-fetch the full list rather than splice one row — simpler and avoids
      // an optimistic-updater drift on closedAt/status.
      await loadLeads();
    } catch {
      setError('Network error updating lead');
    } finally {
      setClosingId(null);
    }
  };

  const filtered = filter === 'ALL' ? leads : leads.filter((l) => l.status === filter);
  const openCount = leads.filter((l) => l.status === 'OPEN').length;

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" size={16} /> Loading leads…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing Leads</h1>
          <p className="text-sm text-gray-400 mt-1">{openCount} open credit request{openCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {(['OPEN', 'CLOSED', 'ALL'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                filter === f
                  ? 'border-orange-500 bg-orange-600/20 text-orange-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/40">
          <Mail size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No {filter !== 'ALL' ? filter.toLowerCase() : ''} leads.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40">
          <table className="engineering-table w-full text-center">
            <thead>
              <tr>
                <th className="text-center">Submitted</th>
                <th className="text-center">User</th>
                <th className="text-center">Email</th>
                <th className="text-center">Credits</th>
                <th className="text-center">Message</th>
                <th className="text-center">Status</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td className="text-gray-500 whitespace-nowrap text-center">
                    {new Date(lead.createdAt).toLocaleDateString()}{' '}
                    <span className="text-gray-600">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="text-center">
                    <span className="text-gray-200 font-medium">{lead.user.name}</span>
                    <span className="block text-xs text-gray-500">{lead.user.username}</span>
                  </td>
                  <td className="text-gray-400 text-center">
                    {/* JSX children, NOT dangerouslySetInnerHTML — user-supplied, never interpreted as HTML */}
                    {lead.email ?? lead.user.email ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="text-orange-300 font-mono text-center">
                    {lead.requestedCredits != null ? lead.requestedCredits : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="max-w-md text-gray-300 text-center">
                    {/* Same: children keep this inert even if it contains < or & */}
                    <span className="block max-h-20 overflow-y-auto custom-scrollbar">{lead.message}</span>
                  </td>
                  <td className="text-center">
                    {lead.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Clock size={13} /> Open</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={13} /> Closed</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-center">
                    <button
                      onClick={() => handleToggleClose(lead)}
                      disabled={closingId === lead.id}
                      className={[
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        lead.status === 'OPEN'
                          ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30 border border-green-600/30'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700',
                        closingId === lead.id ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {closingId === lead.id ? '…' : lead.status === 'OPEN' ? 'Mark closed' : 'Reopen'}
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
