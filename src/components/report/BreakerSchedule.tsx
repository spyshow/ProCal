'use client';

import { useEffect, useState } from 'react';
import { computeFeeders, type EquipmentItem, type FindBreaker, type FoundBreaker } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

export interface BreakerScheduleProps {
  project: Project;
  buildingId?: string;
  manufacturer?: string;
  showHeader?: boolean;
}

interface BreakerRow {
  id: string;
  name: string;
  type: string;
  floor: number;
  buildingName: string;
  current: number;
  breakerSize: number;
  cableSize: number;
  breakerModel: string;
  isThreePhase: boolean;
}

/**
 * Printable breaker schedule.
 *
 * Uses the shared `computeFeeders` helper so the printed schedule always agrees
 * with the Panel Designer and Breaker Schedule page.
 */
export default function BreakerSchedule({
  project,
  buildingId,
  manufacturer,
  showHeader = true,
}: BreakerScheduleProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (manufacturer && manufacturer !== 'MIXED') {
      params.set('manufacturer', manufacturer);
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
  }, [manufacturer]);

  const findBreaker: FindBreaker = (currentRating, category, poles, _options) => {
    const matchesPoles = (e: EquipmentItem) =>
      poles === 1 ? e.poles <= 2 : e.poles === 3;
    const filtered = equipment.filter(
      (e) => e.category === category && matchesPoles(e) && e.ratedCurrent >= currentRating
    );
    const match = filtered.sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0];
    if (match) {
      return {
        model: `${match.manufacturer} ${match.series} ${match.model}`,
        manufacturer: match.manufacturer,
        familyName: match.familyName,
        ratedCurrent: match.ratedCurrent,
        fallback: false,
      };
    }
    return {
      model: null,
      manufacturer: null,
      familyName: null,
      ratedCurrent: null,
      fallback: true,
    };
  };

  const breakers: BreakerRow[] = [];

  for (const bldg of project.buildings) {
    if (buildingId && bldg.id !== buildingId) continue;
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders } = computeFeeders(bldg, project, findBreaker);

    const feederFloor = (feederName: string): number => {
      const m = feederName.match(/^F(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    for (const f of mdbFeeders) {
      breakers.push({
        id: `${bldg.id}-mdb-${breakers.length}`,
        name: f.name,
        type: f.type,
        floor: feederFloor(f.name),
        buildingName: bldg.name,
        current: f.current,
        breakerSize: f.breakerSize,
        cableSize: f.cableSize,
        breakerModel: f.breakerModel,
        isThreePhase: f.type !== 'APARTMENT',
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        breakers.push({
          id: `${bldg.id}-smdb-${breakers.length}`,
          name: f.name,
          type: f.type,
          floor: floorNumber,
          buildingName: bldg.name,
          current: f.current,
          breakerSize: f.breakerSize,
          cableSize: f.cableSize,
          breakerModel: f.breakerModel,
          isThreePhase: f.type !== 'APARTMENT',
        });
      }
    }
  }

  const grouped = breakers.reduce<Record<string, BreakerRow[]>>((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <h2 className="text-lg font-bold border-b pb-2">Breaker Schedule</h2>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-sm font-bold text-orange-600">{type.replace('_', ' ')}</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Feeder</th>
                <th className="border p-2 text-left">Building</th>
                <th className="border p-2 text-center">Floor</th>
                <th className="border p-2 text-right">Current (A)</th>
                <th className="border p-2 text-center">Breaker (A)</th>
                <th className="border p-2 text-left">Breaker Model</th>
                <th className="border p-2 text-center">Cable</th>
                <th className="border p-2 text-center">Phase</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="border p-2 font-semibold">{b.name}</td>
                  <td className="border p-2 text-gray-600">{b.buildingName}</td>
                  <td className="border p-2 text-center font-mono text-orange-600">F{b.floor}</td>
                  <td className="border p-2 text-right font-mono">{b.current.toFixed(1)}</td>
                  <td className="border p-2 text-center font-mono text-blue-600">{b.breakerSize}</td>
                  <td className="border p-2 text-xs text-gray-600">{b.breakerModel}</td>
                  <td className="border p-2 text-center font-mono text-green-600">{b.cableSize}</td>
                  <td className="border p-2 text-center font-mono">{b.isThreePhase ? '3Φ' : '1Φ'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {breakers.length === 0 && (
        <p className="text-sm text-gray-500">No breakers to display for this selection.</p>
      )}
    </div>
  );
}
