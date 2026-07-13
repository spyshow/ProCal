'use client';

import type { FloorItem, Project } from '@/types';

export interface MDBScheduleProps {
  project: Project;
  buildingId?: string;
}

interface MDBRow {
  idx: number;
  building: string;
  floor: number;
  feeder: string;
  type: string;
  demand: number;
  current: number;
  breaker: string;
  cable: string;
  isSubPanel?: boolean;
}

/**
 * Printable Main Distribution Board feeder schedule.
 *
 * Lists every outgoing MDB feeder. Floors with sub-panels receive a dedicated
 * SMDB feeder row, followed by their individual downstream loads.
 */
export default function MDBSchedule({ project, buildingId }: MDBScheduleProps) {
  const allItems: (FloorItem & { floor: number; building: string; hasFloorSubPanels?: boolean })[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        allItems.push({
          ...item,
          floor: fd.floorNumber,
          building: b.name,
          hasFloorSubPanels: fd.hasFloorSubPanels,
        });
      }
    }
  }

  // Group by building+floor for sub-panel logic
  const floorGroups: Record<
    string,
    { building: string; floor: number; hasSubPanel: boolean; items: typeof allItems }
  > = {};

  for (const item of allItems) {
    const key = `${item.building}-F${item.floor}`;
    if (!floorGroups[key]) {
      floorGroups[key] = {
        building: item.building,
        floor: item.floor,
        hasSubPanel: !!item.hasFloorSubPanels,
        items: [],
      };
    }
    floorGroups[key].items.push(item);
  }

  let mdbIndex = 0;
  const mdbRows: MDBRow[] = [];

  for (const fg of Object.values(floorGroups).sort((a, b) => b.floor - a.floor)) {
    if (fg.hasSubPanel && fg.items.length > 0) {
      const floorDemand = fg.items.reduce((s, i) => s + i.calculatedMaxDemand, 0);
      const floorCurrent = fg.items.reduce((s, i) => s + i.calculatedCurrent, 0);
      mdbIndex += 1;
      mdbRows.push({
        idx: mdbIndex,
        building: fg.building,
        floor: fg.floor,
        feeder: `Floor ${fg.floor} Sub-Panel`,
        type: 'SUB_PANEL',
        demand: floorDemand,
        current: floorCurrent,
        breaker: `${Math.ceil(floorCurrent)}A`,
        cable: fg.items[0]?.cableSize || '',
        isSubPanel: true,
      });
    }

    for (const item of fg.items) {
      mdbIndex += 1;
      mdbRows.push({
        idx: mdbIndex,
        building: item.building,
        floor: item.floor,
        feeder: item.name,
        type: item.type,
        demand: item.calculatedMaxDemand,
        current: item.calculatedCurrent,
        breaker: item.breakerSize,
        cable: item.cableSize,
      });
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold border-b pb-2">MDB Feeder Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">#</th>
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-left">Floor</th>
            <th className="border p-2 text-left">Feeder</th>
            <th className="border p-2 text-center">Type</th>
            <th className="border p-2 text-right">Demand (kW)</th>
            <th className="border p-2 text-right">Per-Phase Current (A)</th>
            <th className="border p-2 text-center">Breaker</th>
            <th className="border p-2 text-center">Cable</th>
          </tr>
        </thead>
        <tbody>
          {mdbRows.map((row) => (
            <tr
              key={row.idx}
              className={row.isSubPanel ? 'bg-orange-50 font-semibold' : 'hover:bg-gray-50'}
            >
              <td className="border p-2 font-mono text-gray-500">{row.idx}</td>
              <td className="border p-2">{row.building}</td>
              <td className="border p-2 text-center font-mono">F{row.floor}</td>
              <td className="border p-2 font-semibold">{row.feeder}</td>
              <td className="border p-2 text-center text-xs">{row.type.replace('_', ' ')}</td>
              <td className="border p-2 text-right font-mono">{row.demand.toFixed(2)}</td>
              <td className="border p-2 text-right font-mono text-orange-600">
                {row.current.toFixed(1)}
              </td>
              <td className="border p-2 text-center font-mono text-blue-600">{row.breaker}</td>
              <td className="border p-2 text-center font-mono text-green-600">{row.cable}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
