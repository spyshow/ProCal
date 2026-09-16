'use client';

import { useMemo } from 'react';
import type { Project } from '@/types';
import { sizeTransformer } from '@/lib/calculations/loads';
import { formatCableSizeFor } from '@/lib/calculations/cables';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { calculateShortCircuitCurrent, getTypicalImpedance } from '@/lib/calculations/shortCircuit';
import { aggregateShortCircuitRows } from '@/lib/reports/aggregates';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { createFindBreaker, type FindBreaker, type EquipmentItem } from '@/lib/calculations/feeders';
import { ShieldCheck, Zap } from 'lucide-react';
import { TraceableCell } from '@/components/common/TraceableCell';
import { buildShortCircuitTrace } from '@/lib/calculations/trace-engine';

export interface ShortCircuitScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
  equipment?: EquipmentItem[];
  findBreaker?: FindBreaker;
}

export default function ShortCircuitSchedule({
  project,
  buildingId,
  showHeader = true,
  equipment: preloadedEquipment,
  findBreaker: preloadedFindBreaker,
}: ShortCircuitScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project.preferredManufacturer]);
  const { equipment: fetchedEquipment } = useEquipmentCatalog(query);
  const equipment = preloadedEquipment || fetchedEquipment;

  const findBreaker = useMemo(
    () =>
      preloadedFindBreaker ||
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        project.preferredManufacturer
      ),
    [preloadedFindBreaker, equipment, project]
  );

  const rows = useMemo(() => {
    const all = aggregateShortCircuitRows(project, findBreaker);
    if (!buildingId) return all;
    return all.filter((r) => r.buildingId === buildingId);
  }, [project, buildingId, findBreaker]);

  // Overall transformer source short-circuit metrics
  const scSummary = useMemo(() => {
    const relevantBuildings = buildingId
      ? project.buildings.filter((b) => b.id === buildingId)
      : project.buildings;
    const allItems = relevantBuildings.flatMap((b) => [
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
    const bldgTx = buildingId ? relevantBuildings[0]?.transformer : undefined;
    const transformerKva = bldgTx || project.transformerSize || (demandKva > 0 ? sizeTransformer(demandKva, 1.2, perPhaseKva) : 500);

    const sc = calculateShortCircuitCurrent({
      ratedPower: transformerKva,
      voltagePrimary: 11000,
      voltageSecondary: project.voltage,
      impedancePercent: getTypicalImpedance(transformerKva),
      earthingSystem: 'TN-S',
    });
    return { ...sc, transformerKva };
  }, [project, buildingId]);

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
          Short-Circuit Fault Analysis Schedule
        </h2>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          Standard: <span className="font-bold text-[var(--foreground-color)]">IEC 60909 / IEC 60076</span>
        </span>
      </div>

      {/* Transformer Source Fault Level Cards */}
      <div className="grid grid-cols-4 gap-2.5 my-3">
        <div className="border border-red-500/30 rounded-xl p-2.5 text-center bg-red-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-400 block">3Φ Symmetrical Isc</span>
          <TraceableCell
            getTrace={() =>
              buildShortCircuitTrace({
                locationName: "Main Transformer Secondary (3-Phase)",
                transformerKva: scSummary.transformerKva,
                transformerZPercent: getTypicalImpedance(scSummary.transformerKva),
                voltageSecondaryV: project.voltage || 400,
                threePhaseIscKa: scSummary.threePhaseIsc,
                peakCurrentKa: scSummary.peakCurrent,
                calculationStandard: project.calculationStandard,
              })
            }
          >
            <span className="text-sm font-black text-red-800 dark:text-red-300 font-mono">{scSummary.threePhaseIsc.toFixed(2)} kA</span>
          </TraceableCell>
        </div>
        <div className="border border-amber-500/30 rounded-xl p-2.5 text-center bg-amber-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">2Φ Phase-to-Phase Isc</span>
          <TraceableCell
            getTrace={() =>
              buildShortCircuitTrace({
                locationName: "Main Transformer Secondary (2-Phase)",
                transformerKva: scSummary.transformerKva,
                transformerZPercent: getTypicalImpedance(scSummary.transformerKva),
                voltageSecondaryV: project.voltage || 400,
                threePhaseIscKa: scSummary.twoPhaseIsc,
                calculationStandard: project.calculationStandard,
              })
            }
          >
            <span className="text-sm font-black text-amber-800 dark:text-amber-300 font-mono">{scSummary.twoPhaseIsc.toFixed(2)} kA</span>
          </TraceableCell>
        </div>
        <div className="border border-sky-500/30 rounded-xl p-2.5 text-center bg-sky-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 block">Peak Dynamic Stress (Ip)</span>
          <TraceableCell
            getTrace={() =>
              buildShortCircuitTrace({
                locationName: "Peak Electrodynamic Stress",
                transformerKva: scSummary.transformerKva,
                transformerZPercent: getTypicalImpedance(scSummary.transformerKva),
                voltageSecondaryV: project.voltage || 400,
                threePhaseIscKa: scSummary.threePhaseIsc,
                peakCurrentKa: scSummary.peakCurrent,
                calculationStandard: project.calculationStandard,
              })
            }
          >
            <span className="text-sm font-black text-sky-800 dark:text-sky-300 font-mono">{scSummary.peakCurrent.toFixed(2)} kA</span>
          </TraceableCell>
        </div>
        <div className="border border-purple-500/30 rounded-xl p-2.5 text-center bg-purple-500/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 block">Secondary Fault Level</span>
          <span className="text-sm font-black text-purple-800 dark:text-purple-300 font-mono">{scSummary.faultMVA.toFixed(2)} MVA</span>
        </div>
      </div>

      {/* Downstream Distribution Short-Circuit Table */}
      <table className="w-full text-center text-xs border border-[var(--border-color)] rounded-lg overflow-hidden shadow-xs">
        <thead>
          <tr className="bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)]">
            <th className="p-2 border-r border-[var(--border-color)] text-center">#</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Feeder / Panel Bus</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Building</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Floor</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Type</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Cable</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">3Φ Isc (kA)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">2Φ Isc (kA)</th>
            <th className="p-2 border-r border-[var(--border-color)] text-center">Breaker Icu</th>
            <th className="p-2 text-center">Protection Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)] text-[var(--foreground-color)]">
          {rows.map((row, idx) => (
            <tr
              key={`${row.buildingId}-${row.floor}-${idx}`}
              className={idx % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--card-bg-subtle)]/50'}
            >
              <td className="p-2 border-r border-[var(--border-color)] font-mono text-[var(--text-muted)] text-center">{idx + 1}</td>
              <td className="p-2 border-r border-[var(--border-color)] font-bold text-[var(--foreground-color)] text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Zap size={12} className="text-amber-500 shrink-0" />
                  <span>{row.feeder}</span>
                </div>
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center">{row.buildingName}</td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[var(--foreground-color)]">
                  {row.type}
                </span>
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--text-muted)]">
                {row.cableSizeMm2 > 0 ? formatCableSizeFor(row.cableSizeMm2, project.calculationStandard) : 'Busbar'}
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-red-600 dark:text-red-400">
                <TraceableCell
                  getTrace={() => {
                    const trafoKva = row.transformerKva || scSummary.transformerKva;
                    return buildShortCircuitTrace({
                      locationName: `${row.buildingName} - ${row.feeder} (3-Phase Fault)`,
                      transformerKva: trafoKva,
                      transformerZPercent: getTypicalImpedance(trafoKva),
                      voltageSecondaryV: project.voltage || 400,
                      threePhaseIscKa: row.threePhaseIscKa,
                      peakCurrentKa: row.threePhaseIscKa * 2.1,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.threePhaseIscKa.toFixed(2)} kA
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                <TraceableCell
                  getTrace={() => {
                    const trafoKva = row.transformerKva || scSummary.transformerKva;
                    return buildShortCircuitTrace({
                      locationName: `${row.buildingName} - ${row.feeder} (2-Phase Fault)`,
                      transformerKva: trafoKva,
                      transformerZPercent: getTypicalImpedance(trafoKva),
                      voltageSecondaryV: project.voltage || 400,
                      threePhaseIscKa: row.twoPhaseIscKa,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.twoPhaseIscKa.toFixed(2)} kA
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-[var(--foreground-color)]">
                {row.breakerIcuKa ? `${row.breakerIcuKa} kA` : '—'}
              </td>
              <td className="p-2 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    row.status === 'SAFE'
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40 dark:border-emerald-500/30'
                      : row.status === 'MARGINAL'
                      ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-600/40 dark:border-amber-500/30'
                      : 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-600/40 dark:border-rose-500/30'
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
