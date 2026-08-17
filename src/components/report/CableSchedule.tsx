'use client';

import { isThreePhaseForItem } from '@/lib/calculations/feeders';
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
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <h2 className="text-lg font-bold border-b pb-2">Cable Sizing Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-center">Floor</th>
            <th className="border p-2 text-left">Circuit</th>
            <th className="border p-2 text-center">Phase</th>
            <th className="border p-2 text-right">Current (A)</th>
            <th className="border p-2 text-center">Breaker (A)</th>
            <th className="border p-2 text-center">Cable (mm²)</th>
            <th className="border p-2 text-center">Method</th>
            <th className="border p-2 text-center">Insulation / Material</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="border p-2 text-gray-600">{row.buildingName}</td>
              <td className="border p-2 text-center font-mono text-orange-600">F{row.floor}</td>
              <td className="border p-2 font-semibold">{row.circuit}</td>
              <td className="border p-2 text-center font-mono">{row.phaseLabel}</td>
              <td className="border p-2 text-right font-mono">{row.current.toFixed(1)}</td>
              <td className="border p-2 text-center font-mono text-blue-600">{row.breaker}</td>
              <td className="border p-2 text-center font-mono text-green-600">{row.cable}</td>
              <td className="border p-2 text-center text-xs text-gray-500">{row.method}</td>
              <td className="border p-2 text-center text-xs text-gray-500">
                {row.insulation} · {row.material === 'aluminum' ? 'Al' : 'Cu'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
