'use client';

import { isThreePhaseForItem, computeFeeders } from '@/lib/calculations/feeders';
import { parseCableSize, formatCableSizeFor, calculateCableAmpacity } from '@/lib/calculations/cables';
import { codeOf } from '@/lib/calculations/codes';
import { TraceableCell } from '@/components/common/TraceableCell';
import {
  buildDesignCurrentTrace,
  buildBreakerSizingTrace,
  buildCableAmpacityTrace,
} from '@/lib/calculations/trace-engine';
import type { Project } from '@/types';

export interface CableScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface CableRow {
  id: string;
  buildingName: string;
  floor: number;
  circuit: string;
  phaseLabel: string;
  current: number;
  breaker: string;
  cable: string;
  method: string;
  insulation: string;
  material: string;
  isMainIncomer?: boolean;
}

/**
 * Printable cable sizing schedule.
 *
 * Lists each circuit with its phase configuration, design current, breaker,
 * selected cable size, installation method and insulation.
 */
export default function CableSchedule({ project, buildingId, showHeader = true }: CableScheduleProps) {
  const rows: CableRow[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;

    // 1. Main Incomer Feeder Cable
    const { mainIncomerSettings, mainBreakerIn, mainCableSize, mainParallelRuns, mainIncomerCurrent } = computeFeeders(b, project, () => ({
      model: null,
      manufacturer: null,
      familyName: null,
      ratedCurrent: null,
      fallback: true,
      fallbackType: 'GENERIC_SPEC',
    }));

    rows.push({
      id: `${b.id}-main-incomer-cable`,
      buildingName: b.name,
      floor: 0,
      circuit: project.buildings.length > 1 ? `${b.name} – Main Incomer Feeder` : 'Main Incomer Feeder',
      phaseLabel: '3Φ',
      current: mainIncomerCurrent || mainIncomerSettings.ir,
      breaker: `${mainBreakerIn}A`,
      // Metric parallel notation; the AWG display conversion happens once, at
      // the render site below. Trace parsing also expects metric here.
      cable: mainParallelRuns > 1 ? `${mainParallelRuns} × ${mainCableSize} mm²` : `${mainCableSize} mm²`,
      method: 'E',
      insulation: 'XLPE',
      material: 'copper',
      isMainIncomer: true,
    });

    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        const isThreePhase = isThreePhaseForItem(item);
        rows.push({
          id: item.id || `${b.id}-${fd.floorNumber}-${item.name}`,
          buildingName: b.name,
          floor: fd.floorNumber,
          circuit: item.name,
          phaseLabel: isThreePhase ? '3Φ' : '1Φ',
          current: item.calculatedCurrent,
          breaker: item.breakerSize,
          cable: item.cableSize,
          method: item.installMethod || 'C',
          insulation: item.cableInsulation || 'XLPE',
          material: item.cableMaterial || 'copper',
        });
      }
    }
    for (const bl of b.buildingLoads || []) {
      const lib = bl.loadLibraryItem;
      if (!lib) continue;
      const isThreePhase = lib.phase === 3;
      const totalKw = lib.power * bl.quantity;
      const current = isThreePhase
        ? totalKw / (Math.sqrt(3) * (lib.voltage / 1000) * lib.powerFactor)
        : totalKw / ((lib.voltage / 1000) * lib.powerFactor);
      rows.push({
        id: bl.id,
        buildingName: b.name,
        floor: 0,
        circuit: lib.name,
        phaseLabel: isThreePhase ? '3Φ' : '1Φ',
        current,
        breaker: (bl as any).breakerSize || '32A',
        cable: bl.cableSize || '4 mm²',
        method: bl.installMethod || 'C',
        insulation: bl.cableInsulation || 'XLPE',
        material: bl.cableMaterial || 'copper',
      });
    }
  }

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
          Cable Sizing, Derating &amp; Installation Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">IEC 60364-5-52 / BS 7671</span>
        </span>
      </div>
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800">Circuit / Feeder</th>
            <th className="p-2 border-r border-slate-800 text-center">Phase</th>
            <th className="p-2 border-r border-slate-800 text-center">Design Ib (A)</th>
            <th className="p-2 border-r border-slate-800 text-center">Breaker (In)</th>
            <th className="p-2 border-r border-slate-800 text-center">Cable Size</th>
            <th className="p-2 border-r border-slate-800 text-center">Install Method</th>
            <th className="p-2 text-center">Insulation &amp; Material</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className={
                row.isMainIncomer
                  ? 'bg-amber-50/90 font-bold border-b-2 border-amber-300'
                  : idx % 2 === 0
                  ? 'bg-white'
                  : 'bg-slate-50/80'
              }
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{idx + 1}</td>
              <td className="p-2 border-r border-slate-200 font-medium">{row.buildingName}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.circuit}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">
                {row.phaseLabel}
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const is3Ph = row.phaseLabel.includes('3Φ') || row.phaseLabel.includes('3Ph');
                    const voltage = is3Ph ? (project.voltage || 400) : (project.voltage ? project.voltage / Math.sqrt(3) : 230);
                    const powerKw = is3Ph
                      ? (Math.sqrt(3) * (project.voltage || 400) * row.current * (project.powerFactor || 0.85)) / 1000
                      : ((project.voltage ? project.voltage / Math.sqrt(3) : 230) * row.current * (project.powerFactor || 0.85)) / 1000;
                    return buildDesignCurrentTrace({
                      loadName: `${row.buildingName} - ${row.circuit}`,
                      powerKw,
                      powerFactor: project.powerFactor || 0.85,
                      voltageV: Math.round(voltage),
                      isThreePhase: is3Ph,
                      calculatedCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.current.toFixed(1)} A
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const breakerNumeric = parseInt(row.breaker.replace(/\D/g, ''), 10) || Math.ceil(row.current);
                    return buildBreakerSizingTrace({
                      circuitName: `${row.buildingName} - ${row.circuit}`,
                      designCurrentA: row.current,
                      selectedTripA: breakerNumeric,
                      frameSizeA: breakerNumeric >= 630 ? breakerNumeric : breakerNumeric > 160 ? 250 : 160,
                      breakingCapacityKa: breakerNumeric >= 630 ? 65 : 36,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.breaker}
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const parsed = parseCableSize(row.cable);
                    const cableSize = parsed ? parsed.size : 16;
                    const runs = parsed ? parsed.runs : 1;
                    const mat = (row.material as 'copper' | 'aluminum') || 'copper';
                    const ins = (row.insulation as 'PVC' | 'XLPE') || 'XLPE';
                    const is3Ph = row.phaseLabel.includes('3Φ') || row.phaseLabel.includes('L1,L2,L3') || row.phaseLabel === '3P';
                    const amp = calculateCableAmpacity(cableSize, is3Ph, {
                      material: mat,
                      insulation: ins,
                      ambientTemp: project.ambientTemp || 30,
                      groupingCount: project.groupingCount || 1,
                      installMethod: row.method,
                      parallelRuns: runs,
                      code: codeOf(project.calculationStandard),
                    });
                    return buildCableAmpacityTrace({
                      circuitName: `${row.buildingName} - ${row.circuit}`,
                      cableSizeMm2: cableSize,
                      parallelRuns: runs,
                      material: mat,
                      insulation: ins,
                      installMethod: `Method ${row.method}`,
                      ambientTempC: project.ambientTemp || 30,
                      groupingCount: project.groupingCount || 1,
                      tempFactor: amp.tempFactor ?? 1.0,
                      groupFactor: amp.groupFactor ?? 1.0,
                      nominalAmpacityPerRun: amp.singleNominalAmpacity,
                      deratedAmpacityPerRun: amp.singleDeratedAmpacity,
                      totalDeratedAmpacity: amp.deratedAmpacity,
                      breakerSizeA: parseInt(row.breaker.replace(/\D/g, ''), 10) || undefined,
                      designCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {formatCableSizeFor(row.cable, project.calculationStandard)}
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center text-xs font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  Method {row.method}
                </span>
              </td>
              <td className="p-2 text-center text-xs font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-800">
                  {row.insulation} / {row.material === 'aluminum' ? 'Al' : 'Cu'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
