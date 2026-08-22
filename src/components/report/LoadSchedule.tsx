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
    <div className="space-y-4 font-sans text-slate-900">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-mono">
          <span className="font-semibold text-slate-900">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
          Load Analysis &amp; Phase Balancing Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">{project.calculationStandard ?? 'IEC 60364'}</span>
        </span>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-2.5 my-3">
        <div className="border border-amber-200 rounded-xl p-2.5 text-center bg-amber-50/60">
          <span className="text-[10px] font-bold uppercase text-amber-800 block">Total Connected</span>
          <span className="text-sm font-black text-amber-950">{totalConnectedKw.toFixed(1)} kVA</span>
        </div>
        <div className="border border-sky-200 rounded-xl p-2.5 text-center bg-sky-50/60">
          <span className="text-[10px] font-bold uppercase text-sky-800 block">Max Demand</span>
          <span className="text-sm font-black text-sky-950">{totalDemandKw.toFixed(1)} kVA</span>
        </div>
        <div className="border border-emerald-200 rounded-xl p-2.5 text-center bg-emerald-50/60">
          <span className="text-[10px] font-bold uppercase text-emerald-800 block">Phase Balance (L1/L2/L3)</span>
          <span className="text-xs font-mono font-bold text-emerald-950">
            {l1Current.toFixed(0)}A / {l2Current.toFixed(0)}A / {l3Current.toFixed(0)}A
          </span>
        </div>
        <div className="border border-purple-200 rounded-xl p-2.5 text-center bg-purple-50/60">
          <span className="text-[10px] font-bold uppercase text-purple-800 block">Max Phase Current</span>
          <span className="text-sm font-black text-purple-950">{maxCurrentA.toFixed(1)} A</span>
        </div>
      </div>

      {/* Engineering Load Table */}
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800">Load / Circuit</th>
            <th className="p-2 border-r border-slate-800 text-center">Type</th>
            <th className="p-2 border-r border-slate-800 text-right">Conn. (kVA)</th>
            <th className="p-2 border-r border-slate-800 text-center">DF</th>
            <th className="p-2 border-r border-slate-800 text-right">Demand (kVA)</th>
            <th className="p-2 border-r border-slate-800 text-center">Phase</th>
            <th className="p-2 border-r border-slate-800 text-right">L1 (A)</th>
            <th className="p-2 border-r border-slate-800 text-right">L2 (A)</th>
            <th className="p-2 border-r border-slate-800 text-right">L3 (A)</th>
            <th className="p-2 text-center">PF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {rows.map((row, idx) => (
            <tr
              key={`${row.buildingId}-${row.floor}-${idx}`}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{idx + 1}</td>
              <td className="p-2 border-r border-slate-200 font-medium">{row.buildingName}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.name}</td>
              <td className="p-2 border-r border-slate-200 text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  {row.type}
                </span>
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-700">
                {row.connectedLoadKw.toFixed(1)}
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-600">
                {row.demandFactor.toFixed(2)}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                {row.maxDemandKw.toFixed(1)}
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">
                {row.phase === 3 ? '3Φ' : '1Φ'}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-800">
                {row.currentL1 > 0 ? row.currentL1.toFixed(1) : '—'}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-800">
                {row.currentL2 > 0 ? row.currentL2.toFixed(1) : '—'}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-800">
                {row.currentL3 > 0 ? row.currentL3.toFixed(1) : '—'}
              </td>
              <td className="p-2 text-center font-mono text-slate-600">
                {row.powerFactor.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white font-bold text-xs">
            <td colSpan={5} className="p-2 border-r border-slate-800 uppercase tracking-wider text-right">
              Total System Max Demand:
            </td>
            <td className="p-2 border-r border-slate-800 text-right font-mono">
              {totalConnectedKw.toFixed(1)} kVA
            </td>
            <td className="p-2 border-r border-slate-800 text-center font-mono">—</td>
            <td className="p-2 border-r border-slate-800 text-right font-mono text-amber-400">
              {totalDemandKw.toFixed(1)} kVA
            </td>
            <td className="p-2 border-r border-slate-800 text-center font-mono">3Φ</td>
            <td className="p-2 border-r border-slate-800 text-right font-mono">
              {l1Current.toFixed(1)}A
            </td>
            <td className="p-2 border-r border-slate-800 text-right font-mono">
              {l2Current.toFixed(1)}A
            </td>
            <td className="p-2 border-r border-slate-800 text-right font-mono">
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
