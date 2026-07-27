'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { calculateVoltageDrop, sizeCableAndBreaker } from '@/lib/calculations/cables';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import type { FloorItem, FloorDesign, Building, Project } from '@/types';

// riserCableSize is parsed from FloorDesign's string form (e.g. "120 mm²") into
// a numeric mm² here, so it's Omit-ted from the base and redeclared as number.
interface FloorData extends Omit<FloorDesign, 'riserCableSize'> {
  floorDemand: number;
  floorConnectedLoad: number;
  floorCurrent: number;
  vDropPercent: number;
  segmentVdPercent: number;
  actualVoltage: number;
  isWarning: boolean;
  isDanger: boolean;
  circuitNumber: string;
  riserCableSize: number;
  riserCableLength: number;
}

export default function RiserPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

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

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <GitBranch size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project first.</p>
      </div>
    );
  }

  const bldg = project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0];
  const sortedFloors = [...bldg.floorDesigns].sort((a, b) => a.floorNumber - b.floorNumber);

  // Layout constants
  const floorHeight = 100;
  const headerHeight = 140;
  const footerHeight = 100;
  const mdbHeight = 70;
  const svgHeight = sortedFloors.length * floorHeight + headerHeight + footerHeight + mdbHeight + 30;
  const svgWidth = 1100;

  // Riser vertical position for the main bus
  const busX = 500;
  const feederStartX = 620;

  // Calculate total building load for MDB and transformer sizing
  // Use same formulas as panel designer for consistency
  const totalConnectedLoad = sortedFloors.reduce((sum, fd) =>
    sum + fd.items.reduce((s, item) => s + (item.calculatedConnectedLoad || 0), 0), 0);
  const totalDemandKw = sortedFloors.reduce((sum, fd) =>
    sum + fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0), 0);

  // Include building loads (elevator, pumps, etc.) - same as panel designer
  const buildingLoadsDemandKw = (bldg.buildingLoads || []).reduce((sum, bl) => {
    const lib = bl.loadLibraryItem;
    if (!lib || lib.power <= 0 || bl.quantity <= 0) return sum;
    return sum + (lib.power * bl.quantity);
  }, 0);

  // Total demand in kW (floor items + building loads)
  const totalDemandKwWithBuildingLoads = totalDemandKw + buildingLoadsDemandKw;

  // Convert kW to kVA (same as panel designer: kw / powerFactor)
  const totalDemandKva = totalDemandKwWithBuildingLoads / project.powerFactor;

  // Calculate main current using same formula as panel designer
  const totalCurrent = calculateThreePhaseCurrent(totalDemandKva, project.voltage);

  // Size MDB main breaker from total current
  const mdbSizing = sizeCableAndBreaker(totalCurrent, true, {
    material: 'copper',
    insulation: 'XLPE',
    ambientTemp: 30,
    groupingCount: 1,
  });

  // Transformer sizing using same function as panel designer
  const transformerKva = project.transformerSize || sizeTransformer(totalDemandKva, 1.2);
  const transformerImpedance = 5; // Default 5% if not stored

  // Process floor data with correct VD calculation
  // VD is calculated FROM transformer TO each floor (not cumulative from bottom)
  const floorData: FloorData[] = sortedFloors.map((fd, i) => {
    const floorDemand = fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0);
    const floorConnectedLoad = fd.items.reduce((s, item) => s + (item.calculatedConnectedLoad || 0), 0);
    const floorCurrent3Ph = floorDemand / (Math.sqrt(3) * (project.voltage / 1000) * project.powerFactor);

    // Get riser cable length based on floor type
    // SDB floors: use riserCableLength from FloorDesign (user-entered)
    // Direct floors: use average of apartment cable lengths
    let riserCableLength: number;
    if (fd.hasFloorSubPanels && fd.riserCableLength) {
      // SDB floor - use the riser cable length from FloorDesign
      riserCableLength = fd.riserCableLength;
    } else {
      // Direct floor - use average of apartment cable lengths
      const cableLengths = fd.items.map(item => item.cableLength).filter((l): l is number => l != null && l > 0);
      riserCableLength = cableLengths.length > 0
        ? cableLengths.reduce((a, b) => a + b, 0) / cableLengths.length
        : 10; // Default 10m if not set
    }

    // Calculate riser cable size
    // SDB floors: use riserCableSize from FloorDesign if available, otherwise calculate
    // Direct floors: calculate from floor current
    let riserCableSize: number;
    if (fd.hasFloorSubPanels && fd.riserCableSize) {
      // SDB floor - parse the cable size string (e.g., "120 mm²" -> 120)
      const sizeMatch = fd.riserCableSize.match(/(\d+)/);
      riserCableSize = sizeMatch ? parseInt(sizeMatch[1]) : sizeCableAndBreaker(floorCurrent3Ph, true, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 1,
      }).cableSize;
    } else {
      // Direct floor - calculate from floor current
      const riserSizing = sizeCableAndBreaker(floorCurrent3Ph, true, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 1,
      });
      riserCableSize = riserSizing.cableSize;
    }

    // Calculate voltage drop from transformer to this floor
    const vd = calculateVoltageDrop(
      floorCurrent3Ph,
      riserCableLength,
      riserCableSize,
      project.powerFactor,
      true,
      project.voltage
    );

    // Segment VD (just this floor's cable)
    const segmentVdPercent = vd.dropPercent;

    // Cumulative VD from transformer to this floor
    // For simplicity, we use the VD to this floor (not summing segments)
    const vDropPercent = vd.dropPercent;

    // Actual voltage at this floor
    const actualVoltage = project.voltage * (1 - vDropPercent / 100);

    // Color coding per IEC limits
    const maxVd = project.maxVoltageDropLighting || 3; // Default 3% for lighting
    const isWarning = vDropPercent > maxVd * 0.8; // Warning at 80% of limit
    const isDanger = vDropPercent > maxVd;

    // Circuit designation
    const circuitNumber = `${i + 1}`;

    return {
      ...fd,
      floorDemand,
      floorConnectedLoad,
      floorCurrent: floorCurrent3Ph,
      vDropPercent,
      segmentVdPercent,
      actualVoltage,
      isWarning,
      isDanger,
      circuitNumber,
      riserCableSize,
      riserCableLength,
    };
  });

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bldg.name}-riser.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            Vertical Riser Diagram
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} — {bldg.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"
            title="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
          >
            <Download size={14} />
            Export SVG
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

      {/* SVG Riser */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 overflow-auto" style={{ maxHeight: '80vh' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width={svgWidth}
            height={svgHeight}
            xmlns="http://www.w3.org/2000/svg"
            className="bg-gray-950"
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1f2937" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

            {/* Title */}
            <text x={busX} y="30" textAnchor="middle" fill="#9ca3af" fontSize="16" fontWeight="700">
              RISER DIAGRAM — {bldg.name}
            </text>
            <text x={busX} y="50" textAnchor="middle" fill="#6b7280" fontSize="11">
              {project.voltage}V · {project.powerFactor} PF · {sortedFloors.length} Floors · {project.calculationStandard || 'IEC'} Standard
            </text>

            {/* Transformer symbol at bottom */}
            <g transform={`translate(${busX - 60}, ${svgHeight - footerHeight + 10})`}>
              <circle cx="30" cy="30" r="25" fill="none" stroke="#f97316" strokeWidth="2" />
              <circle cx="30" cy="30" r="25" fill="none" stroke="#f97316" strokeWidth="2" transform="translate(30,0)" />
              <text x="30" y="35" textAnchor="middle" fill="#f97316" fontSize="11" fontWeight="600">TR</text>
              <text x="30" y="65" textAnchor="middle" fill="#e5e7eb" fontSize="10" fontWeight="600">
                {transformerKva} kVA
              </text>
              <text x="30" y="80" textAnchor="middle" fill="#9ca3af" fontSize="9">
                {project.voltage}V · {transformerImpedance}% Z
              </text>
            </g>

            {/* MDB Block */}
            <g transform={`translate(${busX - 90}, ${svgHeight - footerHeight - mdbHeight - 40})`}>
              <rect x="0" y="0" width="180" height={mdbHeight} fill="#1f2937" stroke="#f97316" strokeWidth="2" rx="4" />
              <text x="90" y="20" textAnchor="middle" fill="#f97316" fontSize="12" fontWeight="700">
                MDB — Main Distribution Board
              </text>
              <text x="90" y="38" textAnchor="middle" fill="#e5e7eb" fontSize="10" fontWeight="600">
                {mdbSizing.breakerSize}A MCCB · {totalDemandKva.toFixed(1)} kVA
              </text>
              <text x="90" y="54" textAnchor="middle" fill="#9ca3af" fontSize="9">
                {totalCurrent.toFixed(0)}A · {mdbSizing.cableSize}mm²
              </text>
            </g>

            {/* Main bus vertical line */}
            <line
              x1={busX}
              y1={svgHeight - footerHeight - mdbHeight - 40}
              x2={busX}
              y2={headerHeight}
              stroke="#f97316"
              strokeWidth="3"
            />
            <text x={busX} y={headerHeight - 10} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="600">
              MAIN BUS — {project.voltage}V
            </text>

            {/* Floor risers */}
            {floorData.map((fd, i) => {
              const y = svgHeight - footerHeight - mdbHeight - 20 - (i + 1) * floorHeight;
              const isWarning = fd.isWarning;
              const isDanger = fd.isDanger;
              const lineColor = isDanger ? '#ef4444' : isWarning ? '#eab308' : '#60a5fa';

              return (
                <g key={fd.id}>
                  {/* Floor level line */}
                  <line
                    x1="60"
                    y1={y + floorHeight / 2}
                    x2={svgWidth - 60}
                    y2={y + floorHeight / 2}
                    stroke="#1f2937"
                    strokeWidth="1"
                    strokeDasharray="4"
                  />

                  {/* Floor label */}
                  <rect x="60" y={y + floorHeight / 2 - 14} width="70" height="28" fill="#1f2937" stroke="#374151" strokeWidth="1" rx="3" />
                  <text x="95" y={y + floorHeight / 2 + 4} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="700">
                    FL {fd.floorNumber}
                  </text>

                  {/* SDB Block (only if hasFloorSubPanels is true) */}
                  {fd.hasFloorSubPanels && (
                    <g transform={`translate(150, ${y + floorHeight / 2 - 20})`}>
                      <rect x="0" y="0" width="140" height="40" fill="#1f2937" stroke="#374151" strokeWidth="1" rx="3" />
                      <text x="70" y="14" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="600">
                        SDB-{fd.floorNumber}
                      </text>
                      <text x="70" y="26" textAnchor="middle" fill="#6b7280" fontSize="8">
                        {fd.riserCableSize}mm² · L={fd.riserCableLength.toFixed(0)}m
                      </text>
                      <text x="70" y="36" textAnchor="middle" fill="#6b7280" fontSize="7">
                        {fd.floorDemand.toFixed(1)}kW · {fd.floorCurrent.toFixed(0)}A
                      </text>
                    </g>
                  )}

                  {/* Bus tap */}
                  <circle cx={busX} cy={y + floorHeight / 2} r="4" fill="#f97316" />

                  {/* Riser connection to SDB or directly to feeders */}
                  <line
                    x1={busX}
                    y1={y + floorHeight / 2}
                    x2={fd.hasFloorSubPanels ? 150 : feederStartX}
                    y2={y + floorHeight / 2}
                    stroke={lineColor}
                    strokeWidth="2"
                  />

                  {/* Cable info on riser line */}
                  <text
                    x={(busX + (fd.hasFloorSubPanels ? 150 : feederStartX)) / 2}
                    y={y + floorHeight / 2 - 8}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {fd.riserCableSize}mm² Cu XLPE · {fd.riserCableLength.toFixed(0)}m
                  </text>

                  {/* Voltage Drop Indicator */}
                  <g transform={`translate(300, ${y + floorHeight / 2 - 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="24"
                      fill={isDanger ? '#7f1d1d' : isWarning ? '#713f12' : '#1e3a5f'}
                      stroke={lineColor}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="50"
                      y="10"
                      textAnchor="middle"
                      fill={isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="8"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      ΔV {fd.vDropPercent.toFixed(2)}%
                    </text>
                    <text
                      x="50"
                      y="20"
                      textAnchor="middle"
                      fill={isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="7"
                      fontFamily="monospace"
                    >
                      {fd.actualVoltage.toFixed(1)}V
                    </text>
                  </g>

                  {/* Feeder items */}
                  {fd.items.slice(0, 4).map((item, fi) => {
                    const fx = feederStartX + fi * 120;
                    return (
                      <g key={fi}>
                        <rect
                          x={fx}
                          y={y + floorHeight / 2 - 18}
                          width="110"
                          height="36"
                          fill="#1f2937"
                          stroke={lineColor}
                          strokeWidth="1"
                          rx="3"
                        />
                        <text x={fx + 55} y={y + floorHeight / 2 - 4} textAnchor="middle" fill="#e5e7eb" fontSize="8" fontWeight="600">
                          {item.name}
                        </text>
                        <text x={fx + 55} y={y + floorHeight / 2 + 8} textAnchor="middle" fill="#6b7280" fontSize="7">
                          {item.breakerSize} · {item.cableSize}
                        </text>
                        <text x={fx + 55} y={y + floorHeight / 2 + 16} textAnchor="middle" fill="#6b7280" fontSize="6">
                          {(item.calculatedMaxDemand || 0).toFixed(1)}kW
                        </text>
                      </g>
                    );
                  })}
                  {fd.items.length > 4 && (
                    <text
                      x={feederStartX + 4 * 120 + 55}
                      y={y + floorHeight / 2 + 4}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize="8"
                    >
                      +{fd.items.length - 4} more
                    </text>
                  )}

                  {/* Circuit designation */}
                  <text
                    x={feederStartX - 20}
                    y={y + floorHeight / 2 + 4}
                    textAnchor="middle"
                    fill="#f97316"
                    fontSize="8"
                    fontWeight="600"
                  >
                    {fd.circuitNumber}
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(60, ${svgHeight - 25})`}>
              <text x="0" y="0" fill="#9ca3af" fontSize="9" fontWeight="600">Legend:</text>
              <line x1="60" y1="0" x2="80" y2="0" stroke="#60a5fa" strokeWidth="2" />
              <text x="85" y="4" fill="#6b7280" fontSize="8">Normal ({'<'}{project.maxVoltageDropLighting || 3}%)</text>
              <line x1="180" y1="0" x2="200" y2="0" stroke="#eab308" strokeWidth="2" />
              <text x="205" y="4" fill="#6b7280" fontSize="8">Warning</text>
              <line x1="270" y1="0" x2="290" y2="0" stroke="#ef4444" strokeWidth="2" />
              <text x="295" y="4" fill="#6b7280" fontSize="8">Danger ({'>'}{project.maxVoltageDropLighting || 3}%)</text>
              <text x="420" y="4" fill="#6b7280" fontSize="8">| IEC 60364: Total {'<'}4%, Sub-main {'<'}1%, Final {'<'}3%</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Floor Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400">Floor</th>
                <th className="text-left py-2 px-3 text-gray-400">Panel</th>
                <th className="text-right py-2 px-3 text-gray-400">Connected</th>
                <th className="text-right py-2 px-3 text-gray-400">Demand</th>
                <th className="text-right py-2 px-3 text-gray-400">Current</th>
                <th className="text-right py-2 px-3 text-gray-400">Riser Cable</th>
                <th className="text-right py-2 px-3 text-gray-400">Length</th>
                <th className="text-right py-2 px-3 text-gray-400">ΔV</th>
                <th className="text-right py-2 px-3 text-gray-400">Voltage</th>
                <th className="text-center py-2 px-3 text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {floorData.map((fd) => (
                <tr key={fd.id} className="border-b border-gray-800">
                  <td className="py-2 px-3 text-orange-500 font-semibold">FL {fd.floorNumber}</td>
                  <td className="py-2 px-3 text-gray-300">{fd.hasFloorSubPanels ? `SDB-${fd.floorNumber}` : 'Direct'}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.floorConnectedLoad.toFixed(1)} kW</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.floorDemand.toFixed(1)} kW</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.floorCurrent.toFixed(0)} A</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.riserCableSize} mm²</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.riserCableLength.toFixed(0)} m</td>
                  <td className="py-2 px-3 text-right" style={{ color: fd.isDanger ? '#ef4444' : fd.isWarning ? '#eab308' : '#60a5fa' }}>
                    {fd.vDropPercent.toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-right">{fd.actualVoltage.toFixed(1)} V</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      fd.isDanger ? 'bg-red-900/50 text-red-400' :
                      fd.isWarning ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      {fd.isDanger ? 'DANGER' : fd.isWarning ? 'WARNING' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
