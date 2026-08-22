'use client';

import { useMemo } from 'react';
import type { Project } from '@/types';
import { sizeTransformer } from '@/lib/calculations/loads';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { calculateShortCircuitCurrent, getTypicalImpedance } from '@/lib/calculations/shortCircuit';
import { aggregateShortCircuitRows } from '@/lib/reports/aggregates';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { createFindBreaker } from '@/lib/calculations/feeders';
import { ShieldCheck, Zap } from 'lucide-react';

export interface ShortCircuitScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

export default function ShortCircuitSchedule({
  project,
  buildingId,
  showHeader = true,
}: ShortCircuitScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project.preferredManufacturer]);
  const { equipment } = useEquipmentCatalog(query);

  const findBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        project.preferredManufacturer
      ),
    [equipment, project]
  );

  const rows = useMemo(() => {
    const all = aggregateShortCircuitRows(project, findBreaker);
    if (!buildingId) return all;
    return all.filter((r) => r.buildingId === buildingId);
  }, [project, buildingId, findBreaker]);

  // Overall transformer source short-circuit metrics
  const scSummary = useMemo(() => {
    const allItems = project.buildings.flatMap((b) => [
      ...b.floorDesigns.flatMap((fd) => fd.items),
      ...(b.buildingLoads ?? []),
    ]);
    const balance = phaseBalance(allItems as any, project as any);
    const pf = project.powerFactor || 0.85;
    const demandKva = balance.totalKw / pf;
    const perPhaseKva: [number, number, number] = [
      balance.phaseKw[0] / pf,
      balance.phaseKw[1] / pf,
      balance.phaseKw[2] / pf,
    ];
    const transformerKva = project.transformerSize || sizeTransformer(demandKva || 500, 1.2, perPhaseKva);

    return calculateShortCircuitCurrent({
      ratedPower: transformerKva,
      voltagePrimary: 11000,
      voltageSecondary: project.voltage,
      impedancePercent: getTypicalImpedance(transformerKva),
      earthingSystem: 'TN-S',
    });
  }, [project]);

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
          Short-Circuit Fault Analysis Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">IEC 60909 / IEC 60076</span>
        </span>
      </div>

      {/* Transformer Source Fault Level Cards */}
      <div className="grid grid-cols-4 gap-2.5 my-3">
        <div className="border border-red-200 rounded-xl p-2.5 text-center bg-red-50/60">
          <span className="text-[10px] font-bold uppercase text-red-800 block">3Φ Symmetrical Isc</span>
          <span className="text-sm font-black text-red-950 font-mono">{scSummary.threePhaseIsc.toFixed(2)} kA</span>
        </div>
        <div className="border border-amber-200 rounded-xl p-2.5 text-center bg-amber-50/60">
          <span className="text-[10px] font-bold uppercase text-amber-800 block">2Φ Phase-to-Phase Isc</span>
          <span className="text-sm font-black text-amber-950 font-mono">{scSummary.twoPhaseIsc.toFixed(2)} kA</span>
        </div>
        <div className="border border-sky-200 rounded-xl p-2.5 text-center bg-sky-50/60">
          <span className="text-[10px] font-bold uppercase text-sky-800 block">Peak Dynamic Stress (Ip)</span>
          <span className="text-sm font-black text-sky-950 font-mono">{scSummary.peakCurrent.toFixed(2)} kA</span>
        </div>
        <div className="border border-purple-200 rounded-xl p-2.5 text-center bg-purple-50/60">
          <span className="text-[10px] font-bold uppercase text-purple-800 block">Secondary Fault Level</span>
          <span className="text-sm font-black text-purple-950 font-mono">{scSummary.faultMVA.toFixed(2)} MVA</span>
        </div>
      </div>

      {/* Downstream Distribution Short-Circuit Table */}
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Feeder / Panel Bus</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800 text-center">Type</th>
            <th className="p-2 border-r border-slate-800 text-center">Cable</th>
            <th className="p-2 border-r border-slate-800 text-right">3Φ Isc (kA)</th>
            <th className="p-2 border-r border-slate-800 text-right">2Φ Isc (kA)</th>
            <th className="p-2 border-r border-slate-800 text-right">Breaker Icu</th>
            <th className="p-2 text-center">Protection Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {rows.map((row, idx) => (
            <tr
              key={`${row.buildingId}-${row.floor}-${idx}`}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{idx + 1}</td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900 flex items-center gap-1.5">
                <Zap size={12} className="text-amber-500 shrink-0" />
                <span>{row.feeder}</span>
              </td>
              <td className="p-2 border-r border-slate-200">{row.buildingName}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-slate-200 text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  {row.type}
                </span>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">
                {row.cableSizeMm2 > 0 ? `${row.cableSizeMm2} mm²` : 'Busbar'}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-red-600">
                {row.threePhaseIscKa.toFixed(2)} kA
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-amber-700">
                {row.twoPhaseIscKa.toFixed(2)} kA
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                {row.breakerIcuKa ? `${row.breakerIcuKa} kA` : '—'}
              </td>
              <td className="p-2 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    row.status === 'SAFE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : row.status === 'MARGINAL'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  <ShieldCheck size={10} />
                  {row.status} (Icu &ge; Isc)
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
