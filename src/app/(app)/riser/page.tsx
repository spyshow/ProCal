'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { sizeCableAndBreaker } from '@/lib/calculations/cables';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import { computeFloorRiserVd, type RiserFloorVd } from '@/lib/calculations/riser';
import { PageSkeleton } from '@/components/ui/skeleton';
import type { FloorDesign, Project } from '@/types';

// FloorDesign.riserCableSize is a string ("120 mm²"); the riser calc helper
// returns it parsed to a numeric mm², so Omit both riser fields from the base
// and let RiserFloorVd supply the numeric forms.
interface FloorData extends Omit<FloorDesign, 'riserCableSize' | 'riserCableLength'>, RiserFloorVd {
  floorDemand: number;
  floorConnectedLoad: number;
  floorCurrent: number;
  floorKva: number;
  diversityPct: number;
  actualVoltage: number;
  isWarning: boolean;
  isDanger: boolean;
}

export default function RiserPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading } = useProject();
  const { t, isRtl } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      if (!selectedBuilding && selectedProject.buildings.length > 0) {
        setSelectedBuilding(selectedProject.buildings[0].id);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId, selectedBuilding]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    if (selectedProject?.id === selectedProjectId) {
      setProject(selectedProject);
      if (!selectedBuilding && selectedProject.buildings.length > 0) {
        setSelectedBuilding(selectedProject.buildings[0].id);
      }
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId, selectedProject, selectedBuilding]);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);

  if (loading || (!project && (contextLoading || selectedProjectId))) {
    return <PageSkeleton titleWidth="w-56" rowCount={6} />;
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <GitBranch size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project from the sidebar.</p>
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

  // Per-floor riser ΔV via the shared helper (pure, tested) — see
  // riser.ts. Honest per-apartment branch ΔV (1-phase/230V or 3-phase/400V),
  // SDB riser off maxPhaseCurrent (imbalance-aware per eng-review), and flagged
  // "no data" instead of the fabricated direct-floor riser that gave wrong ΔV.
  const TOTAL_VD_LIMIT = 4; // IEC 60364 total transformer→furthest load
  const floorData: FloorData[] = sortedFloors.map((fd) => {
    const floorDemand = fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0);
    const floorConnectedLoad = fd.items.reduce((s, item) => s + (item.calculatedConnectedLoad || 0), 0);
    const vd = computeFloorRiserVd(fd, project);
    const floorCurrent = vd.riserCurrent; // maxPhaseCurrent — the sizing current for the floor
    const floorKva = floorDemand / project.powerFactor; // ΣkVA (demand already diversified)
    const diversityPct = floorConnectedLoad > 0 ? (floorDemand / floorConnectedLoad) * 100 : 0;
    const actualVoltage = project.voltage * (1 - vd.totalVdPercent / 100);
    return {
      ...fd,
      ...vd,
      floorDemand,
      floorConnectedLoad,
      floorCurrent,
      floorKva,
      diversityPct,
      actualVoltage,
      isWarning: vd.totalVdPercent > TOTAL_VD_LIMIT * 0.8,
      isDanger: vd.totalVdPercent > TOTAL_VD_LIMIT,
    };
  });

  // Band color for a ΔV cell against its IEC limit (4% total / 1% sub-main / 3% final).
  const bandColor = (pct: number, limit: number, hasData: boolean) =>
    !hasData ? '#6b7280' : pct > limit ? '#ef4444' : pct > limit * 0.8 ? '#eab308' : '#60a5fa';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            {t('riser.title', 'Vertical Riser Diagram')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} &mdash; {bldg.name}</p>
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
            {t('sld.exportSvg', 'Export SVG')}
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
              {t('riser.title', 'RISER DIAGRAM')} — {bldg.name}
            </text>
            <text x={busX} y="50" textAnchor="middle" fill="#6b7280" fontSize="11">
              {project.voltage}V · {project.powerFactor} PF · {bldg.earthingSystem || '—'} · {sortedFloors.length} {t('calculator.floorsCount', 'Floors')} · {project.calculationStandard || 'IEC'}
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
                {t('sld.mdb', 'MDB — Main Distribution Board')}
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
              {t('panel.mainBusbar', 'MAIN BUS')} — {project.voltage}V
            </text>

            {/* Floor risers */}
            {floorData.map((fd, i) => {
              const y = svgHeight - footerHeight - mdbHeight - 20 - (i + 1) * floorHeight;
              const cy = y + floorHeight / 2; // this floor's center line
              const isWarning = fd.isWarning;
              const isDanger = fd.isDanger;
              const lineColor = fd.totalNoData ? '#6b7280' : isDanger ? '#ef4444' : isWarning ? '#eab308' : '#60a5fa';

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
                    {t('riser.floor', 'FL')} {fd.floorNumber}
                  </text>

                  {/* SDB Block — placed RIGHT of the main bus, on the orange riser.
                      (Only for hasFloorSubPanels floors.) */}
                  {fd.hasFloorSubPanels && (
                    <g transform={`translate(540, ${cy - 20})`}>
                      <rect x="0" y="0" width="120" height="40" fill="#1f2937" stroke="#374151" strokeWidth="1" rx="3" />
                      <text x="60" y="11" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="600">
                        SDB-{fd.floorNumber}
                      </text>
                      <text x="60" y="22" textAnchor="middle" fill="#6b7280" fontSize="7">
                        {fd.floorDemand.toFixed(1)}kW · {fd.floorKva.toFixed(1)}kVA · DF{fd.diversityPct.toFixed(0)}%
                      </text>
                      <text x="60" y="33" textAnchor="middle" fill="#6b7280" fontSize="7">
                        {fd.riserNoData
                          ? `no riser data · ${fd.floorCurrent.toFixed(0)}A`
                          : `${fd.riserCableSize}mm² · L=${fd.riserCableLength?.toFixed(0)}m · ${fd.floorCurrent.toFixed(0)}A`}
                      </text>
                    </g>
                  )}

                  {/* Bus tap */}
                  <circle cx={busX} cy={cy} r="4" fill="#f97316" />

                  {/* Orange riser: MDB bus → SDB. SDB floors only. */}
                  {fd.hasFloorSubPanels && (
                    <line x1={busX} y1={cy} x2={540} y2={cy} stroke="#f97316" strokeWidth="2" />
                  )}

                  {/* Cable info on the riser (SDB) / branch count (direct). */}
                  <text
                    x={(busX + (fd.hasFloorSubPanels ? 540 : 676)) / 2}
                    y={cy - 8}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {fd.hasRiser
                      ? fd.riserNoData
                        ? 'no riser data'
                        : `${fd.riserCableSize ?? '—'}mm² ${fd.riserCableInsulation || 'XLPE'} · ${fd.riserCableLength?.toFixed(0) ?? '—'}m`
                      : `${fd.items.length} ${t('cableSchedule.circuits', 'apt feeders')}`}
                  </text>

                  {/* Voltage Drop Indicator (transformer→furthest load = total ΔV) */}
                  <g transform={`translate(300, ${cy - 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="24"
                      fill={fd.totalNoData ? '#374151' : isDanger ? '#7f1d1d' : isWarning ? '#713f12' : '#1e3a5f'}
                      stroke={lineColor}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="50"
                      y="10"
                      textAnchor="middle"
                      fill={fd.totalNoData ? '#9ca3af' : isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="8"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {fd.totalNoData ? 'ΔV —' : `ΔV ${fd.totalVdPercent.toFixed(2)}%`}
                    </text>
                    <text
                      x="50"
                      y="20"
                      textAnchor="middle"
                      fill={fd.totalNoData ? '#9ca3af' : isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="7"
                      fontFamily="monospace"
                    >
                      {fd.totalNoData ? 'no data' : `${fd.actualVoltage.toFixed(1)}V`}
                    </text>
                  </g>

                  {/* Downstream blue feeder rail: board → vertical rail → apartments.
                      SDB floors: rail starts at the SDB's right edge (660).
                      Direct floors: rail starts right at the bus tap (no riser. */}
                  {(() => {
                    const railX = 676;
                    const boardEdgeX = fd.hasFloorSubPanels ? 660 : busX;
                    const N = Math.min(fd.items.length, 4);
                    if (N === 0) return null;
                    const firstCY = cy + (0 - (N - 1) / 2) * 26;
                    const lastCY = cy + ((N - 1) - (N - 1) / 2) * 26;
                    return (
                      <>
                        {/* board → rail head */}
                        <line x1={boardEdgeX} y1={cy} x2={railX} y2={cy} stroke="#3b82f6" strokeWidth="2" />
                        {/* vertical rail spanning the apartment stack */}
                        {N > 1 && (
                          <line x1={railX} y1={firstCY} x2={railX} y2={lastCY} stroke="#3b82f6" strokeWidth="2" />
                        )}
                        {/* circuit designation, above the rail */}
                        <text x={railX} y={firstCY - 6} textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="600">
                          W{i + 1}
                        </text>
                        {/* apartment nodes tap off the rail, stacked vertically */}
                        {fd.items.slice(0, 4).map((item, fi) => {
                          const nodeCY = cy + (fi - (N - 1) / 2) * 26;
                          const aptLeft = 684;
                          return (
                            <g key={fi}>
                              <line x1={railX} y1={nodeCY} x2={aptLeft} y2={nodeCY} stroke="#3b82f6" strokeWidth="1.5" />
                              <rect x={aptLeft} y={nodeCY - 11} width="96" height="22" fill="#1f2937" stroke="#3b82f6" strokeWidth="1" rx="3" />
                              <text x={aptLeft + 48} y={nodeCY - 1} textAnchor="middle" fill="#e5e7eb" fontSize="7" fontWeight="600">
                                {item.name}
                              </text>
                              <text x={aptLeft + 48} y={nodeCY + 8} textAnchor="middle" fill="#6b7280" fontSize="6">
                                {item.cableSize} · {(item.calculatedMaxDemand || 0).toFixed(1)}kW
                              </text>
                            </g>
                          );
                        })}
                        {fd.items.length > 4 && (
                          <text x={684 + 48} y={cy + (3 - (N - 1) / 2) * 26 + 16} textAnchor="middle" fill="#6b7280" fontSize="7">
                            +{fd.items.length - 4} more
                          </text>
                        )}
                      </>
                    );
                  })()}
                </g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(60, ${svgHeight - 25})`}>
              <text x="0" y="0" fill="#9ca3af" fontSize="9" fontWeight="600">{t('sld.legend', 'Legend')} (total ΔV, transformer→furthest load):</text>
              <line x1="320" y1="0" x2="340" y2="0" stroke="#60a5fa" strokeWidth="2" />
              <text x="345" y="4" fill="#6b7280" fontSize="8">Normal ({'<'}3.2%)</text>
              <line x1="430" y1="0" x2="450" y2="0" stroke="#eab308" strokeWidth="2" />
              <text x="455" y="4" fill="#6b7280" fontSize="8">Warning</text>
              <line x1="540" y1="0" x2="560" y2="0" stroke="#ef4444" strokeWidth="2" />
              <text x="565" y="4" fill="#6b7280" fontSize="8">Danger ({'>'}4%)</text>
              <line x1="650" y1="0" x2="670" y2="0" stroke="#6b7280" strokeWidth="2" strokeDasharray="3" />
              <text x="675" y="4" fill="#6b7280" fontSize="8">no data</text>
              <text x="760" y="4" fill="#6b7280" fontSize="8">| IEC 60364: Sub-main {'<'}1%, Final {'<'}3%, Total {'<'}4%</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('riser.floorSummary', 'Floor Summary')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-start py-2 px-3 text-gray-400">{t('riser.floor', 'Floor')}</th>
                <th className="text-start py-2 px-3 text-gray-400">{t('riser.panel', 'Panel')}</th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.demand', 'Demand')}</th>
                <th className="text-end py-2 px-3 text-gray-400">ΣkVA</th>
                <th className="text-end py-2 px-3 text-gray-400">DF%</th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.current', 'Current')}</th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.riserVd', 'Riser ΔV')}<span className="block font-normal opacity-70">{'<1%'}</span></th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.branchVd', 'Branch ΔV')}<span className="block font-normal opacity-70">{'<3%'}</span></th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.totalVd', 'Total ΔV')}<span className="block font-normal opacity-70">{'<4%'}</span></th>
                <th className="text-end py-2 px-3 text-gray-400">{t('riser.voltage', 'Voltage')}</th>
                <th className="text-center py-2 px-3 text-gray-400">{t('riser.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {floorData.map((fd) => (
                <tr key={fd.id} className="border-b border-gray-800">
                  <td className="py-2 px-3 text-orange-500 font-semibold">FL {fd.floorNumber}</td>
                  <td className="py-2 px-3 text-gray-300">{fd.hasFloorSubPanels ? `SDB-${fd.floorNumber}` : 'Direct'}</td>
                  <td className="py-2 px-3 text-gray-300 text-end">{fd.floorDemand.toFixed(1)} kW</td>
                  <td className="py-2 px-3 text-gray-300 text-end">{fd.floorKva.toFixed(1)} kVA</td>
                  <td className="py-2 px-3 text-gray-300 text-end">{fd.diversityPct.toFixed(0)}%</td>
                  <td className="py-2 px-3 text-gray-300 text-end">{fd.floorCurrent.toFixed(0)} A</td>
                  <td className="py-2 px-3 text-end" style={{ color: bandColor(fd.riserVdPercent, 1, fd.hasRiser && !fd.riserNoData) }}>
                    {fd.hasRiser ? (fd.riserNoData ? '—' : `${fd.riserVdPercent.toFixed(2)}%`) : '—'}
                  </td>
                  <td className="py-2 px-3 text-end" style={{ color: bandColor(fd.branchVdPercent, 3, !fd.branchNoData) }}>
                    {fd.branchNoData ? '—' : `${fd.branchVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2 px-3 text-end font-semibold" style={{ color: bandColor(fd.totalVdPercent, 4, !fd.totalNoData) }}>
                    {fd.totalNoData ? '—' : `${fd.totalVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-end">{fd.totalNoData ? '—' : `${fd.actualVoltage.toFixed(1)} V`}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      fd.totalNoData ? 'bg-gray-800/50 text-gray-500' :
                      fd.isDanger ? 'bg-red-900/50 text-red-400' :
                      fd.isWarning ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      {fd.totalNoData ? 'NO DATA' : fd.isDanger ? 'DANGER' : fd.isWarning ? 'WARNING' : 'OK'}
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
