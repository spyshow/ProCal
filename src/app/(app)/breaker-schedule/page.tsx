'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { CircuitBoard, Filter } from 'lucide-react';
import { computeFeeders, type EquipmentItem } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

type Manufacturer = 'ABB' | 'SCHNEIDER' | 'MIXED';

const MFG_OPTIONS: { value: Manufacturer; label: string }[] = [
  { value: 'MIXED', label: 'Mixed' },
  { value: 'ABB', label: 'ABB' },
  { value: 'SCHNEIDER', label: 'Schneider' },
];

interface BreakerEntry {
  id: string;
  name: string;
  type: string;
  floor: number;
  buildingId: string;
  buildingName: string;
  current: number;
  breakerSize: number;
  cableSize: number;
  breakerModel: string;
  isThreePhase: boolean;
}

export default function BreakerSchedulePage() {
  const { selectedProjectId, preferredManufacturer } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [manufacturer, setManufacturer] = useState<Manufacturer>(
    (preferredManufacturer as Manufacturer) || 'MIXED'
  );

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId]);

  const loadEquipment = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (manufacturer !== 'MIXED') {
        params.set('manufacturer', manufacturer);
      }
      params.set('category', 'MCCB');
      const res = await fetch(`/api/equipment?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) { console.error(err); }
  }, [manufacturer]);

  useEffect(() => {
    setManufacturer((preferredManufacturer as Manufacturer) || 'MIXED');
  }, [preferredManufacturer]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  // Find the smallest equipment entry whose ratedCurrent >= the breaker size.
  const findBreaker = (currentRating: number, category: 'MCCB' | 'ACB'): EquipmentItem | null => {
    const filtered = equipment.filter(
      (e) => e.category === category && e.ratedCurrent >= currentRating
    );
    return filtered.sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0] || null;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CircuitBoard size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  // Build the flat breaker list from the shared feeder helper so this page and
  // the Panel Designer can never disagree on sizing or three-phase classification.
  const breakers: BreakerEntry[] = [];
  for (const bldg of project.buildings) {
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders } = computeFeeders(bldg, project, findBreaker);

    // The helper's MDB feeders already include per-floor apartment/SMDB feeders
    // and building loads. Index them by floor where available.
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
        buildingId: bldg.id,
        buildingName: bldg.name,
        current: f.current,
        breakerSize: f.breakerSize,
        cableSize: f.cableSize,
        breakerModel: f.breakerModel,
        isThreePhase: f.type !== 'APARTMENT',
      });
    }

    // SMDB per-floor apartment feeders (only for sub-panel floors).
    // The helper already prefixes the floor into f.name (e.g. "F1 – Apt A").
    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        breakers.push({
          id: `${bldg.id}-smdb-${breakers.length}`,
          name: f.name,
          type: f.type,
          floor: floorNumber,
          buildingId: bldg.id,
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

  const filteredBreakers = selectedBuilding === 'all'
    ? breakers
    : breakers.filter((b) => b.buildingId === selectedBuilding);

  // Group by type
  const grouped = filteredBreakers.reduce((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {} as Record<string, BreakerEntry[]>);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CircuitBoard size={22} className="text-orange-500" />
            Breaker Schedule
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} — {manufacturer === 'MIXED' ? 'Mixed' : manufacturer} series</p>
        </div>

        {/* Manufacturer Selector */}
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
          {MFG_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setManufacturer(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                manufacturer === value
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Building Filter */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedBuilding('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedBuilding === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            All Buildings
          </button>
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Breaker Tables by Type */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <h3 className="text-sm font-bold text-orange-400 mb-3">{type.replace('_', ' ')}</h3>
          <table className="w-full engineering-table text-xs">
            <thead>
              <tr>
                <th className="text-left">Feeder</th>
                <th className="text-left">Building</th>
                <th className="text-center">Floor</th>
                <th className="text-right">Current (A)</th>
                <th className="text-center">Breaker (A)</th>
                <th className="text-left">Breaker Model</th>
                <th className="text-center">Cable (mm²)</th>
                <th className="text-center">Phase</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800/30">
                  <td className="text-gray-200 font-semibold">{b.name}</td>
                  <td className="text-gray-400">{b.buildingName}</td>
                  <td className="text-center font-mono text-orange-400">F{b.floor}</td>
                  <td className="text-right font-mono">{b.current.toFixed(1)}</td>
                  <td className="text-center font-mono text-blue-400">{b.breakerSize}</td>
                  <td className="text-xs text-gray-300">{b.breakerModel}</td>
                  <td className="text-center font-mono text-green-400">{b.cableSize}</td>
                  <td className="text-center font-mono">{b.isThreePhase ? '3Φ' : '1Φ'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {filteredBreakers.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
          <p className="text-gray-500 text-sm">No breakers to display for this selection.</p>
        </div>
      )}

      {/* Summary */}
      <div className="text-[10px] text-gray-600">
        <p>Total breakers: {filteredBreakers.length} | {manufacturer === 'MIXED' ? 'Mixed' : `${manufacturer} series`}</p>
      </div>
    </div>
  );
}
