'use client';

import { useEffect, useState } from 'react';
import { X, History, Loader2, Plus } from 'lucide-react';
import type { ProjectRevision } from '@/types';

export interface RevisionsPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a revision is successfully issued (parent may refetch). */
  onChanged?: () => void;
}

export default function RevisionsPanel({ projectId, open, onClose, onChanged }: RevisionsPanelProps) {
  const [revisions, setRevisions] = useState<ProjectRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetch(`/api/projects/${projectId}/revisions?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRevisions(data);
      })
      .catch(() => setError('Failed to load revisions'))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  if (!open) return null;

  const handleIssue = async () => {
    if (!description.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to issue revision');
        return;
      }
      const created = await res.json();
      setRevisions((prev) => [...prev, created]);
      setDescription('');
      onChanged?.();
    } catch {
      setError('Network error while issuing revision');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...revisions].reverse(); // newest first

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <History size={16} className="text-orange-500" />
            Project Revisions
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Issue a new revision */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
              Issue current design as revision
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Issued for Construction — updated cable schedule"
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleIssue}
              disabled={saving || !description.trim()}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Issuing…' : 'Issue Revision'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Revision list */}
          <div className="border-t border-gray-800 pt-3">
            {loading ? (
              <p className="py-4 text-center text-sm text-gray-500">Loading revisions…</p>
            ) : sorted.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                No revisions issued yet. Issue one to snapshot the current design on the report cover.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs uppercase text-gray-400">
                    <th className="py-1.5 pr-2">Rev</th>
                    <th className="py-1.5 pr-2">Date</th>
                    <th className="py-1.5 pr-2">Description</th>
                    <th className="py-1.5">By</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 font-mono font-bold text-orange-400">{r.rev}</td>
                      <td className="py-2 pr-2 text-gray-300">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-2 text-gray-300">{r.description}</td>
                      <td className="py-2 text-gray-400">{r.createdByUsername}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
