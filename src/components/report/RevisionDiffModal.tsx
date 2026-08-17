'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, FileDiff, Loader2, ArrowRight, PlusCircle, MinusCircle, PencilLine } from 'lucide-react';
import type { ProjectRevision } from '@/types';
import type { SnapshotProject } from '@/lib/revisions';
import { diffProjectSnapshots, summarizeChanges, type RevisionDiffChange } from '@/lib/revisions-diff';

export interface RevisionDiffModalProps {
  projectId: string;
  /** The revision whose snapshot is the comparison target. */
  targetRevision: ProjectRevision;
  /** All revisions of the project — any of them can act as the base. */
  revisions: ProjectRevision[];
  onClose: () => void;
}

const KIND_META: Record<RevisionDiffChange['kind'], { label: string; icon: typeof PlusCircle; chip: string; row: string }> = {
  added: {
    label: 'Added',
    icon: PlusCircle,
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    row: 'text-emerald-300',
  },
  removed: {
    label: 'Removed',
    icon: MinusCircle,
    chip: 'bg-red-500/15 text-red-400 border-red-500/40',
    row: 'text-red-300',
  },
  changed: {
    label: 'Changed',
    icon: PencilLine,
    chip: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    row: 'text-amber-300',
  },
};

const CATEGORY_BADGE: Record<string, string> = {
  project: 'Project',
  building: 'Building',
  floor: 'Floor',
  item: 'Circuit',
  buildingLoad: 'Load',
  template: 'Template',
  room: 'Room',
  loadLibraryItem: 'Load Library',
};

function parseSnapshot(json: string | null | undefined): SnapshotProject | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as SnapshotProject) : null;
  } catch {
    return null;
  }
}

export default function RevisionDiffModal({
  projectId,
  targetRevision,
  revisions,
  onClose,
}: RevisionDiffModalProps) {
  // baseRevId: "live" = the current project state, otherwise a revision id.
  const [baseRevId, setBaseRevId] = useState<string>('live');
  const [liveSnapshot, setLiveSnapshot] = useState<SnapshotProject | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setLiveSnapshot(data as SnapshotProject | null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const baseSnapshot = useMemo(() => {
    if (baseRevId === 'live') return liveSnapshot;
    const rev = revisions.find((r) => r.id === baseRevId);
    return rev ? parseSnapshot(rev.snapshotJson) : null;
  }, [baseRevId, liveSnapshot, revisions]);

  const targetSnapshot = useMemo(() => parseSnapshot(targetRevision.snapshotJson), [targetRevision]);

  const { changes, summary, baseLabel } = useMemo(() => {
    if (!baseSnapshot || !targetSnapshot) {
      return { changes: [] as RevisionDiffChange[], summary: null, baseLabel: '' };
    }
    const changes = diffProjectSnapshots(baseSnapshot, targetSnapshot);
    const baseLabel =
      baseRevId === 'live'
        ? 'Current live state'
        : revisions.find((r) => r.id === baseRevId)?.rev ?? 'Unknown';
    return { changes, summary: summarizeChanges(changes), baseLabel };
  }, [baseSnapshot, targetSnapshot, baseRevId, revisions]);

  const groups: { kind: RevisionDiffChange['kind']; items: RevisionDiffChange[] }[] = (
    ['added', 'removed', 'changed'] as const
  )
    .map((kind) => ({ kind, items: changes.filter((c) => c.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <FileDiff size={16} className="text-orange-500" />
            Revision Diff — {targetRevision.rev}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {/* Base selector */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-400">Compared against</span>
            <select
              value={baseRevId}
              onChange={(e) => setBaseRevId(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500"
            >
              <option value="live">Current live state</option>
              {revisions
                .filter((r) => r.id !== targetRevision.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rev} — {r.description}
                  </option>
                ))}
            </select>
            <span className="text-gray-500">
              {baseLabel} <ArrowRight size={12} className="mx-1 inline" /> {targetRevision.rev}
            </span>
          </div>

          {/* Context line */}
          <p className="text-xs text-gray-400">
            {baseRevId === 'live'
              ? `Restoring ${targetRevision.rev} would apply the changes below.`
              : `Changes from ${baseLabel} to ${targetRevision.rev} (${targetRevision.description}).`}
          </p>

          {loadingLive && baseRevId === 'live' ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading live project state…
            </p>
          ) : summary && summary.added + summary.removed + summary.changed === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-300">
              No differences — {baseRevId === 'live' ? 'the live project already matches this revision.' : 'these two snapshots are identical.'}
            </div>
          ) : summary ? (
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['added', summary.added],
                  ['removed', summary.removed],
                  ['changed', summary.changed],
                ] as const
              ).map(([kind, count]) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                return (
                  <span
                    key={kind}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chip}`}
                  >
                    <Icon size={12} />
                    {meta.label}: {count}
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* Change list */}
          {groups.length > 0 && (
            <div className="space-y-5">
              {groups.map(({ kind, items }) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                return (
                  <div key={kind}>
                    <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${meta.row}`}>
                      <Icon size={13} />
                      {meta.label} — {items.length}
                    </h3>
                    <ul className="divide-y divide-gray-800/70 rounded-lg border border-gray-800 bg-gray-950/60">
                      {items.map((c, i) => (
                        <li key={i} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {CATEGORY_BADGE[c.category] ?? c.category}
                            </span>
                            <span className="text-sm font-semibold text-white">{c.label}</span>
                          </div>
                          {c.kind === 'changed' ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 pl-1 text-xs">
                              <span className="text-gray-400">{c.field}</span>
                              <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-300 line-through decoration-red-400/70">
                                {c.from}
                              </span>
                              <ArrowRight size={12} className="text-gray-500" />
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-300">
                                {c.to}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-1 pl-1 text-xs text-gray-400">{c.detail}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
