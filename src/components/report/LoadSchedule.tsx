'use client';

import { useMemo } from 'react';
import type { Project } from '@/types';
import { aggregateLoadRows } from '@/lib/reports/aggregates';
import { phaseBalance } from '@/lib/calculations/phaseBalance';

export interface LoadScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

export default function LoadSchedule({
  project,
  buildingId,
  showHeader = true,
}: LoadScheduleProps) {
  const rows = useMemo(() => {
    const all = aggregateLoadRows(project);
    if (!buildingId) return all;
    return all.filter((r) => r.buildingId === buildingId);
  }, [project, buildingId]);

  // Project or Building-level balance summary
  const summary = useMemo(() => {
    const targetBuildings = buildingId
      ? project.buildings.filter((b) => b.id === buildingId)
      : project.buildings;

    const allItems = targetBuildings.flatMap((b) => [
      ...b.floorDesigns.flatMap((fd) => fd.items),
      ...(b.buildingLoads ?? []),
    ]);

    return phaseBalance(allItems as never, project as never);
  }, [project, buildingId]);

  const totalConnectedKw = rows.reduce((s, r) => s + r.connectedLoadKw, 0);
  const totalDemandKw = summary.totalKw ?? 0;
  const maxCurrentA = summary.maxPhaseCurrent ?? 0;
  const l1Current = summary.phaseCurrent?.[0] ?? 0;
  const l2Current = summary.phaseCurrent?.[1] ?? 0;
  const l3Current = summary.phaseCurrent?.[2] ?? 0;

  return (
    <div className="space-y-4 font-sans text-[var(--foreground-color)]">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1 font-mono">
          <span className="font-semibold text-[var(--foreground-color)]">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-color)] border-l-4 border-amber-500 pl-2.5">
          Load Analysis &amp; Phase Balancing Schedule
        </h2>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          Standard: <span className="font-bold text-[var(--foreground-color)]">{project.calculationStandard ?? 'IEC 60364'}</span>
        </span>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-2.5 my-3">
        <div className="border border-amber-500/30 rounded-xl p-2.5 text-center bg-amber-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Total Connected</span>
          <span className="text-sm font-black text-amber-800 dark:text-amber-300 font-mono">{totalConnectedKw.toFixed(1)} kW</span>
        </div>
        <div className="border border-sky-500/30 rounded-xl p-2.5 text-center bg-sky-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 block">Max Demand</span>
          <span className="text-sm font-black text-sky-800 dark:text-sky-300 font-mono">{totalDemandKw.toFixed(1)} kW</span>
        </div>
        <div className="border border-emerald-500/30 rounded-xl p-2.5 text-center bg-emerald-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Phase Balance (L1/L2/L3)</span>
          <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
            {l1Current.toFixed(0)}A / {l2Current.toFixed(0)}A / {l3Current.toFixed(0)}A
          </span>
        </div>
        <div className="border border-purple-500/30 rounded-xl p-2.5 text-center bg-purple-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 block">Max Phase Current</span>
          <span className="text-sm font-black text-purple-800 dark:text-purple-300 font-mono">{maxCurrentA.toFixed(1)} A</span>
        </div>
      </div>

      {/* Engineering Load Table */}
      <table className="w-full text-center text-xs border border-[var(--border-color)] rounded-lg overflow-hidden shadow-xs">
        <thead>
          <tr className="bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)]">
            <th className="p-2 border-r border-[var(--border-color)] text-center">#</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Building</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Floor</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Load / Circuit</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Type</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Conn. (kW)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">DF</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Demand (kW)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Phase</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">L1 (A)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">L2 (A)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">L3 (A)</th>
            <th className="p-2 text-center">PF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)] text-[var(--foreground-color)]">
          {rows.map((row, idx) => (
            <tr
              key={`${row.buildingId}-${row.floor}-${idx}`}
              className={idx % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--card-bg-subtle)]/50'}
            >
              <td className="p-2 border-r border-[var(--border-color)] font-mono text-[var(--text-muted)] text-center">{idx + 1}</td>
              <td className="p-2 border-r border-[var(--border-color)] font-medium text-center">{row.buildingName}</td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] font-bold text-[var(--foreground-color)] text-center">{row.name}</td>
              <td className="p-2 border-r border-[var(--border-color)] text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[var(--foreground-color)]">
                  {row.type}
                </span>
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--text-muted)]">
                {row.connectedLoadKw.toFixed(1)}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--text-muted)]">
                {row.demandFactor.toFixed(2)}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-[var(--foreground-color)]">
                {row.maxDemandKw.toFixed(1)}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                {row.phase === 3 ? '3Φ' : '1Φ'}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--foreground-color)]">
                {row.currentL1 > 0 ? row.currentL1.toFixed(1) : '—'}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--foreground-color)]">
                {row.currentL2 > 0 ? row.currentL2.toFixed(1) : '—'}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--foreground-color)]">
                {row.currentL3 > 0 ? row.currentL3.toFixed(1) : '—'}
              </td>
              <td className="p-2 text-center font-mono text-[var(--text-muted)]">
                {row.powerFactor.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] font-bold text-xs border-t border-[var(--border-color)]">
            <td colSpan={5} className="p-2 border-r border-[var(--border-color)] uppercase tracking-wider text-center">
              Total System Max Demand:
            </td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
              {totalConnectedKw.toFixed(1)} kW
            </td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">—</td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-amber-600 dark:text-amber-400">
              {totalDemandKw.toFixed(1)} kW
            </td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">3Φ</td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
              {l1Current.toFixed(1)}A
            </td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
              {l2Current.toFixed(1)}A
            </td>
            <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
              {l3Current.toFixed(1)}A
            </td>
            <td className="p-2 text-center font-mono">
              {(project.powerFactor || 0.85).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
