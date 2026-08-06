import { useEffect, useState } from 'react';
import { computeFeeders, createFindBreaker, type EquipmentItem, type FindBreaker } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

export interface MDBScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
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
 * Uses `computeFeeders` to list every outgoing MDB feeder, SMDB sub-panel feeder,
 * and downstream circuit breaker matching the rest of the application.
 */
export default function MDBSchedule({ project, buildingId, showHeader = true }: MDBScheduleProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }

    fetch(`/api/equipment?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setEquipment(data);
      })
      .catch(() => {
        if (!cancelled) setEquipment([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.preferredManufacturer]);

  const findBreaker: FindBreaker = createFindBreaker(
    equipment,
    {
      ACB: project.defaultAcbFamilyId ?? undefined,
      MCCB: project.defaultMccbFamilyId ?? undefined,
      MCB: project.defaultMcbFamilyId ?? undefined,
    },
    project.preferredManufacturer
  );

  let mdbIndex = 0;
  const mdbRows: MDBRow[] = [];

  for (const bldg of project.buildings) {
    if (buildingId && bldg.id !== buildingId) continue;
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders } = computeFeeders(bldg, project, findBreaker);

    const feederFloor = (feederName: string): number => {
      const m = feederName.match(/^F(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const currentToKw = (current: number) =>
      (Math.sqrt(3) * (project.voltage / 1000) * current * project.powerFactor);

    for (const f of mdbFeeders) {
      mdbIndex += 1;
      const floor = feederFloor(f.name);
      mdbRows.push({
        idx: mdbIndex,
        building: bldg.name,
        floor,
        feeder: f.name,
        type: f.type,
        demand: currentToKw(f.current),
        current: f.current,
        breaker: `${f.breakerSize}A`,
        cable: `${f.cableSize} mm²`,
        isSubPanel: f.type === 'SMDB',
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        mdbIndex += 1;
        mdbRows.push({
          idx: mdbIndex,
          building: bldg.name,
          floor: floorNumber,
          feeder: f.name,
          type: f.type,
          demand: currentToKw(f.current),
          current: f.current,
          breaker: `${f.breakerSize}A`,
          cable: `${f.cableSize} mm²`,
          isSubPanel: false,
        });
      }
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
      <h2 className="text-lg font-bold border-b pb-2">MDB Feeder Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">#</th>
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-center">Floor</th>
            <th className="border p-2 text-left">Feeder</th>
            <th className="border p-2 text-center">Type</th>
            <th className="border p-2 text-right">Demand (kW)</th>
            <th className="border p-2 text-right">Current (A)</th>
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
