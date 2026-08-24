'use client';

import { useEffect, useState } from 'react';
import { X, History, Loader2, Plus, RotateCcw, FileDiff, Trash2 } from 'lucide-react';
import type { ProjectRevision } from '@/types';
import RevisionDiffModal from '@/components/report/RevisionDiffModal';

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
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [diffTarget, setDiffTarget] = useState<ProjectRevision | null>(null);
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

  if (diffTarget) {
    return (
      <RevisionDiffModal
        projectId={projectId}
        targetRevision={diffTarget}
        revisions={revisions}
        onClose={() => setDiffTarget(null)}
      />
    );
  }

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

  const reload = async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/revisions?t=${Date.now()}`, { cache: 'no-store' });
      const data = await r.json();
      if (Array.isArray(data)) setRevisions(data);
    } catch {
      /* ignore — the issue/restore call already surfaced errors */
    }
  };

  const handleRestore = async (r: ProjectRevision) => {
    const confirmed = window.confirm(
      `Restore the project to ${r.rev} (${r.description})?\n\n` +
      `The current design will first be snapshotted as a new revision, so the restore can be undone.`
    );
    if (!confirmed) return;
    setRestoringId(r.id);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions/${r.id}/restore`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to restore revision');
        return;
      }
      await reload(); // the auto pre-restore revision is now in the list
      onChanged?.();
    } catch {
      setError('Network error while restoring revision');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (r: ProjectRevision) => {
    const confirmed = window.confirm(
      `Delete revision ${r.rev} (${r.description})?\n\nThis permanently removes it from the report cover and history. It cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(r.id);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions/${r.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to delete revision');
        return;
      }
      setRevisions((prev) => prev.filter((x) => x.id !== r.id));
      onChanged?.();
    } catch {
      setError('Network error while deleting revision');
    } finally {
      setDeletingId(null);
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
              <table className="w-full text-sm text-center">
                <thead>
                  <tr className="border-b border-gray-800 text-center text-xs uppercase text-gray-400">
                    <th className="py-1.5 px-2 text-center">Rev</th>
                    <th className="py-1.5 px-2 text-center">Date</th>
                    <th className="py-1.5 px-2 text-center">Description</th>
                    <th className="py-1.5 px-2 text-center">By</th>
                    <th className="py-1.5 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/60">
                      <td className="py-2 px-2 font-mono font-bold text-orange-400 text-center">{r.rev}</td>
                      <td className="py-2 px-2 text-gray-300 text-center">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-2 text-gray-300 text-center">{r.description}</td>
                      <td className="py-2 px-2 text-gray-400 text-center">{r.createdByUsername}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDiffTarget(r)}
                            disabled={restoringId === r.id || saving}
                            title={`Preview what changed vs ${r.rev}`}
                            aria-label={`Diff ${r.rev}`}
                            className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 hover:border-sky-500 hover:text-sky-400 disabled:opacity-40"
                          >
                            <FileDiff size={12} />
                            Diff
                          </button>
                          <button
                            onClick={() => handleRestore(r)}
                            disabled={restoringId === r.id || saving}
                            title={`Restore the project to ${r.rev}`}
                            aria-label={`Restore ${r.rev}`}
                            className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-300 hover:border-orange-500 hover:text-orange-400 disabled:opacity-40"
                          >
                            {restoringId === r.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                            {restoringId === r.id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === r.id || saving}
                            title={`Delete revision ${r.rev}`}
                            aria-label={`Delete ${r.rev}`}
                            className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold text-gray-400 hover:border-red-500 hover:text-red-400 disabled:opacity-40"
                          >
                            {deletingId === r.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            {deletingId === r.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
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
