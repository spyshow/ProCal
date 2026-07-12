'use client';

import type { FloorItem, Project } from '@/types';

export interface VDScheduleProps {
  project: Project;
  buildingId?: string;
}

interface VDRow {
  id: string;
  circuit: string;
  current: number;
  cable: string;
  length: number;
  vd: number;
  status: 'OK' | 'WARNING' | 'FAIL';
}

const cableLengthFallback = (floor: number) => 10 + (floor - 1) * 5;

/**
 * Printable voltage-drop schedule.
 *
 * Shows estimated voltage drop for every circuit and flags it against the
 * IEC 60364-5-52 limits used elsewhere in the app (3% lighting, 5% power).
 */
export default function VDSchedule({ project, buildingId }: VDScheduleProps) {
  const rows: VDRow[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        const vd = item.voltageDrop ?? 0;
        const status = vd <= 3 ? 'OK' : vd <= 5 ? 'WARNING' : 'FAIL';
        rows.push({
          id: item.id || `${b.id}-${fd.floorNumber}-${item.name}`,
          circuit: item.name,
          current: item.calculatedCurrent,
          cable: item.cableSize,
          length: item.cableLength ?? cableLengthFallback(fd.floorNumber),
          vd,
          status,
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold border-b pb-2">Voltage Drop Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Circuit</th>
            <th className="border p-2 text-right">Per-Phase Current (A)</th>
            <th className="border p-2 text-center">Cable (mm²)</th>
            <th className="border p-2 text-right">Est. Length (m)</th>
            <th className="border p-2 text-right">VDrop (%)</th>
            <th className="border p-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="border p-2 font-semibold">{row.circuit}</td>
              <td className="border p-2 text-right font-mono">{row.current.toFixed(1)}</td>
              <td className="border p-2 text-center font-mono">{row.cable}</td>
              <td className="border p-2 text-right font-mono">{row.length}</td>
              <td className="border p-2 text-right font-mono">{row.vd.toFixed(2)}%</td>
              <td
                className={`border p-2 text-center font-semibold ${
                  row.status === 'OK'
                    ? 'text-green-600'
                    : row.status === 'WARNING'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        IEC 60364-5-52 limits: 3% for lighting, 5% for power loads.
      </p>
    </div>
  );
}
