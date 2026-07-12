'use client';

import { isThreePhaseForItem } from '@/lib/calculations/feeders';
import type { FloorItem, Project } from '@/types';

export interface CableScheduleProps {
  project: Project;
  buildingId?: string;
}

interface CableRow {
  id: string;
  circuit: string;
  phaseLabel: string;
  current: number;
  breaker: string;
  cable: string;
  method: string;
  insulation: string;
}

/**
 * Printable cable sizing schedule.
 *
 * Lists each circuit with its phase configuration, design current, breaker,
 * selected cable size, installation method and insulation.
 */
export default function CableSchedule({ project, buildingId }: CableScheduleProps) {
  const rows: CableRow[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        const isThreePhase = isThreePhaseForItem(item);
        rows.push({
          id: item.id || `${b.id}-${fd.floorNumber}-${item.name}`,
          circuit: item.name,
          phaseLabel: isThreePhase ? '3Φ' : '1Φ',
          current: item.calculatedCurrent,
          breaker: item.breakerSize,
          cable: item.cableSize,
          method: (item as any).installMethod || 'C',
          insulation: (item as any).cableInsulation || 'XLPE',
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold border-b pb-2">Cable Sizing Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Circuit</th>
            <th className="border p-2 text-center">Phase</th>
            <th className="border p-2 text-right">Per-Phase Current (A)</th>
            <th className="border p-2 text-center">Breaker (A)</th>
            <th className="border p-2 text-center">Cable (mm²)</th>
            <th className="border p-2 text-center">Method</th>
            <th className="border p-2 text-center">Insulation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="border p-2 font-semibold">{row.circuit}</td>
              <td className="border p-2 text-center font-mono">{row.phaseLabel}</td>
              <td className="border p-2 text-right font-mono">{row.current.toFixed(1)}</td>
              <td className="border p-2 text-center font-mono text-blue-600">{row.breaker}</td>
              <td className="border p-2 text-center font-mono text-green-600">{row.cable}</td>
              <td className="border p-2 text-center text-xs text-gray-500">{row.method}</td>
              <td className="border p-2 text-center text-xs text-gray-500">{row.insulation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
