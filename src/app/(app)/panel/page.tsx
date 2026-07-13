'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
  Cpu,
  Zap,
  Shield,
  Plug,
  Activity,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import { sizeCableAndBreaker } from '@/lib/calculations/cables';
import { CABLE_CATALOG } from '@/lib/calculations/cablesData';
import { computeFeeders, createFindBreaker, type EquipmentItem, type DefaultFamilies } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

export default function PanelDesignerPage() {
  const { selectedProjectId, preferredManufacturer } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [panelType, setPanelType] = useState<'MDB' | 'SMDB'>('MDB');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId]);

  const loadEquipment = useCallback(async () => {
    try {
      // Load all manufacturers' ACB/MCCB/MCB rows. The family selection overrides
      // preferredManufacturer, and fallback should stay within the chosen
      // family's manufacturer rather than being silently filtered out here.
      const res = await fetch(`/api/equipment?category=ACB,MCCB,MCB`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  const defaultFamilies: DefaultFamilies = {
    ACB: project?.defaultAcbFamilyId ?? undefined,
    MCCB: project?.defaultMccbFamilyId ?? undefined,
    MCB: project?.defaultMcbFamilyId ?? undefined,
  };

  const findBreaker = createFindBreaker(equipment, defaultFamilies, preferredManufacturer);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Cpu size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  const bldg = project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0];

  // Outgoing feeders (MDB + SMDB) via the shared helper. Three-phase is derived
  // per item type through isThreePhaseForItem (matches the API routes), so the
  // panel, breaker-schedule, and cable-schedule all agree. Main-incomer and
  // transformer sizing stay page-local — the breaker schedule has no incomer.
  const { mdbFeeders, smdbFeeders, smdbFloorNumbers } = computeFeeders(bldg, project, findBreaker);

  const activeSmdbFloor = selectedFloor || (smdbFloorNumbers.length > 0 ? smdbFloorNumbers[0] : null);
  const smdbFeedersForActive = activeSmdbFloor ? smdbFeeders(activeSmdbFloor) : [];

  // Use appropriate feeders based on panel type
  const activeFeeders = panelType === 'MDB' ? mdbFeeders : smdbFeedersForActive;

  // MDB Main calculations
  // Total demand in kVA: sum of feeder apparent power (kW / powerFactor).
  const totalDemandKva = mdbFeeders.reduce((s, f) => {
    // kVA = kW / pf; kW = current(A) * voltage(kV) * factor
    // For 3-phase: factor = sqrt(3), line voltage in kV.
    const voltageKv = project.voltage / 1000;
    const kw = project.voltage === 230
      ? f.current * voltageKv * project.powerFactor
      : f.current * Math.sqrt(3) * voltageKv * project.powerFactor;
    return s + kw / project.powerFactor;
  }, 0);
  const mainBreakerCurrent = calculateThreePhaseCurrent(totalDemandKva * 1000, project.voltage);
  const mainSizing = sizeCableAndBreaker(mainBreakerCurrent, true, {
    material: 'copper',
    insulation: 'XLPE',
    ambientTemp: 30,
    groupingCount: 1,
  });
  const transformerSize = sizeTransformer(totalDemandKva);

  const mainMatch = findBreaker(mainSizing.breakerSize, 'ACB', 3);
  const mainBreakerModel = mainMatch.model ?? `ACB ${mainSizing.breakerSize}`;

  const mainCable = CABLE_CATALOG.find((c) => c.size >= mainSizing.cableSize) || CABLE_CATALOG[CABLE_CATALOG.length - 1];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu size={22} className="text-orange-500" />
            {panelType} Panel Designer
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {project.name} — {bldg.name} · {preferredManufacturer} series
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPanelType('MDB')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              panelType === 'MDB' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            MDB
          </button>
          <button
            onClick={() => setPanelType('SMDB')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              panelType === 'SMDB' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            SMDB
          </button>
        </div>
      </div>

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2">
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
      )}

      {/* Floor Selector for SMDB */}
      {panelType === 'SMDB' && smdbFloorNumbers.length > 0 && (
        <div className="flex gap-2">
          {smdbFloorNumbers.map(floorNumber => (
            <button
              key={floorNumber}
              onClick={() => setSelectedFloor(floorNumber)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSmdbFloor === floorNumber ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Floor {floorNumber}
            </button>
          ))}
        </div>
      )}

      {/* Main Incomer */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap size={14} className="text-orange-500" />
          Main Incomer — {panelType}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Total Demand</p>
            <p className="text-lg font-bold text-orange-400 font-mono">{totalDemandKva.toFixed(1)} kVA</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Main Current</p>
            <p className="text-lg font-bold text-blue-400 font-mono">{mainBreakerCurrent.toFixed(0)} A</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Main Breaker</p>
            <p className="text-lg font-bold text-white font-mono">{mainSizing.breakerSize}A</p>
            <p className="text-[10px] text-gray-500">{mainBreakerModel}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Main Cable</p>
            <p className="text-lg font-bold text-green-400 font-mono">{mainSizing.cableSize} mm²</p>
            <p className="text-[10px] text-gray-500">{mainSizing.nominalAmpacity}A capacity</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Transformer</p>
            <p className="text-lg font-bold text-yellow-400 font-mono">{transformerSize} kVA</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Busbar</p>
            <p className="text-lg font-bold text-white font-mono">
              {mainSizing.breakerSize <= 800 ? '800A' : mainSizing.breakerSize <= 1600 ? '1600A' : '3200A'}
            </p>
            <p className="text-[10px] text-gray-500">3-Phase + N + PE</p>
          </div>
        </div>
      </div>

      {/* Panel Visual Layout */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Cpu size={14} className="text-orange-500" />
          Panel Layout — {activeFeeders.length} Outgoing Feeders
        </h2>

        {/* SVG Panel Outline */}
        <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-x-auto">
          <svg
            viewBox={`0 0 800 ${Math.max(600, activeFeeders.length * 36 + 200)}`}
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Panel Box */}
            <rect
              x="40"
              y="20"
              width="720"
              height={activeFeeders.length * 36 + 160}
              fill="none"
              stroke="#374151"
              strokeWidth="2"
              rx="4"
            />

            {/* Panel Title */}
            <text x="400" y="50" textAnchor="middle" fill="#9ca3af" fontSize="14" fontWeight="600">
              {panelType} — {bldg.name}{panelType === 'SMDB' && activeSmdbFloor ? ` — Floor ${activeSmdbFloor}` : ''} — {preferredManufacturer}
            </text>

            {/* Busbar */}
            <rect x="60" y="65" width="680" height="12" fill="#f97316" opacity="0.3" rx="2" />
            <text x="400" y="75" textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="600">
              MAIN BUSBAR — {mainSizing.breakerSize}A — 3Φ + N + PE
            </text>

            {/* Main Incomer */}
            <rect x="80" y="90" width="120" height="40" fill="#1f2937" stroke="#f97316" strokeWidth="1.5" rx="3" />
            <text x="140" y="107" textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="600">INCOMER</text>
            <text x="140" y="121" textAnchor="middle" fill="#9ca3af" fontSize="9">{mainSizing.breakerSize}A {mainBreakerModel}</text>

            {/* SPD */}
            <rect x="240" y="90" width="80" height="40" fill="#1f2937" stroke="#22c55e" strokeWidth="1" rx="3" />
            <text x="280" y="107" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="600">SPD</text>
            <text x="280" y="121" textAnchor="middle" fill="#6b7280" fontSize="8">Type 1+2</text>

            {/* Meter */}
            <rect x="340" y="90" width="100" height="40" fill="#1f2937" stroke="#3b82f6" strokeWidth="1" rx="3" />
            <text x="390" y="107" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="600">POWER METER</text>
            <text x="390" y="121" textAnchor="middle" fill="#6b7280" fontSize="8">kWh / kVA / PF</text>

            {/* CTs */}
            <rect x="460" y="90" width="60" height="40" fill="#1f2937" stroke="#a855f7" strokeWidth="1" rx="3" />
            <text x="490" y="107" textAnchor="middle" fill="#a855f7" fontSize="9" fontWeight="600">CTs</text>
            <text x="490" y="121" textAnchor="middle" fill="#6b7280" fontSize="8">Ratio TBD</text>

            {/* Phase Lamps */}
            <rect x="540" y="90" width="60" height="40" fill="#1f2937" stroke="#eab308" strokeWidth="1" rx="3" />
            <text x="570" y="107" textAnchor="middle" fill="#eab308" fontSize="9" fontWeight="600">L1 L2 L3</text>
            <text x="570" y="121" textAnchor="middle" fill="#6b7280" fontSize="8">Indicators</text>

            {/* Spare */}
            <rect x="620" y="90" width="100" height="40" fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="3" strokeDasharray="4" />
            <text x="670" y="107" textAnchor="middle" fill="#6b7280" fontSize="9">SPARE</text>
            <text x="670" y="121" textAnchor="middle" fill="#4b5563" fontSize="8">Expansion</text>

            {/* Feeders */}
            {activeFeeders.map((feeder, i) => {
              const y = 150 + i * 36;
              const isApartment = feeder.type === 'APARTMENT';
              const color = isApartment ? '#f97316' : /pump/i.test(feeder.type) ? '#22c55e' : /elevator/i.test(feeder.type) ? '#3b82f6' : '#a855f7';

              return (
                <g key={feeder.name + i}>
                  {/* Feeder connection line from busbar */}
                  <line x1="200" y1={78} x2="200" y2={y + 10} stroke="#374151" strokeWidth="1" />
                  <line x1="200" y1={y + 10} x2="80" y2={y + 10} stroke="#374151" strokeWidth="1" />

                  {/* Feeder breaker */}
                  <rect x="80" y={y} width="120" height="24" fill="#1f2937" stroke={color} strokeWidth="1" rx="2" />
                  <text x="140" y={y + 10} textAnchor="middle" fill={color} fontSize="8" fontWeight="600">
                    {feeder.breakerSize}A — {feeder.breakerModel}
                  </text>
                  <text x="140" y={y + 20} textAnchor="middle" fill="#6b7280" fontSize="7">
                    {feeder.name}
                  </text>

                  {/* Cable */}
                  <line x1="200" y1={y + 12} x2="340" y2={y + 12} stroke={color} strokeWidth="1" opacity="0.5" />
                  <text x="270" y={y + 8} textAnchor="middle" fill="#6b7280" fontSize="7">
                    {feeder.cableSize} mm²
                  </text>

                  {/* Current */}
                  <text x="350" y={y + 16} fill="#9ca3af" fontSize="8" fontFamily="monospace">
                    {feeder.current.toFixed(1)}A
                  </text>

                  {/* Status indicator */}
                  <circle cx="400" cy={y + 12} r="4" fill={color} opacity="0.6" />
                </g>
              );
            })}

            {/* Bottom label */}
            <text
              x="400"
              y={activeFeeders.length * 36 + 175}
              textAnchor="middle"
              fill="#4b5563"
              fontSize="10"
            >
              {panelType} Panel — {activeFeeders.length} feeders — Total {totalDemandKva.toFixed(1)} kVA — Transformer sized at {transformerSize} kVA
            </text>
          </svg>
        </div>
      </div>

      {/* Feeder Schedule Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={14} className="text-orange-500" />
          Feeder Schedule
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full engineering-table">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Feeder</th>
                <th className="text-center">Type</th>
                <th className="text-right">Per-Phase Current (A)</th>
                <th className="text-right">Breaker (A)</th>
                <th className="text-center">Breaker Model</th>
                <th className="text-center">Cable (mm²)</th>
              </tr>
            </thead>
            <tbody>
              {activeFeeders.map((f, i) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <td className="font-mono text-gray-500">{i + 1}</td>
                  <td className="text-gray-200">{f.name}</td>
                  <td className="text-center text-xs text-gray-400">{f.type.replace('_', ' ')}</td>
                  <td className="text-right font-mono text-orange-400">{f.current.toFixed(1)}</td>
                  <td className="text-right font-mono text-blue-400">{f.breakerSize}</td>
                  <td className="text-center text-xs text-gray-400 font-mono">{f.breakerModel}</td>
                  <td className="text-center font-mono text-green-400">{f.cableSize}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t border-gray-700 font-bold">
                <td></td>
                <td className="text-white">TOTAL</td>
                <td></td>
                <td className="text-right font-mono text-orange-400">
                  {activeFeeders.reduce((s, f) => s + f.current, 0).toFixed(1)}
                </td>
                <td className="text-right font-mono text-white">{mainSizing.breakerSize}</td>
                <td className="text-center text-xs font-mono text-white">{mainBreakerModel}</td>
                <td className="text-center font-mono text-green-400">{mainSizing.cableSize}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
