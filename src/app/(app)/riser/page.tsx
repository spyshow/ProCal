'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
  GitBranch,
  Building2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { calculateVoltageDrop } from '@/lib/calculations/cables';
import type { FloorItem, FloorDesign, Building, Project } from '@/types';

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
  const floorHeight = 80;
  const headerHeight = 120;
  const footerHeight = 60;
  const svgHeight = sortedFloors.length * floorHeight + headerHeight + footerHeight;
  const svgWidth = 900;

  // Riser vertical position for the main bus
  const busX = 450;
  const feederStartX = 560;

  // Voltage drop accumulation (simplified: using average cable length per floor)
  const avgCableLength = 15; // meters between floors
  let cumulativeVDrop = 0;
  const floorData = sortedFloors.map((fd, i) => {
    const floorDemand = fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0);
    const floorCurrent3Ph = floorDemand / (Math.sqrt(3) * (project.voltage / 1000) * project.powerFactor);

    // Get cable size as number for VD calculation
    const cableSizeMatch = fd.items[0]?.cableSize?.match(/(\d+)/);
    const cableSizeSqMm = cableSizeMatch ? parseInt(cableSizeMatch[1]) : 16;

    const vd = calculateVoltageDrop(
      floorCurrent3Ph,
      avgCableLength,
      cableSizeSqMm,
      project.powerFactor,
      true,
      project.voltage
    );
    cumulativeVDrop += vd.dropPercent;
    const isWarning = cumulativeVDrop > 3;
    const isDanger = cumulativeVDrop > 5;

    return {
      ...fd,
      floorDemand,
      floorCurrent: floorCurrent3Ph,
      vDropPercent: cumulativeVDrop,
      isWarning,
      isDanger,
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
              {project.voltage}V · {project.powerFactor} PF · {sortedFloors.length} Floors
            </text>

            {/* Transformer symbol at bottom */}
            <g transform={`translate(${busX - 40}, ${svgHeight - footerHeight})`}>
              <circle cx="20" cy="20" r="18" fill="none" stroke="#f97316" strokeWidth="2" />
              <circle cx="20" cy="20" r="18" fill="none" stroke="#f97316" strokeWidth="2" transform="translate(20,0)" />
              <text x="20" y="25" textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="600">TR</text>
              <text x="20" y="50" textAnchor="middle" fill="#6b7280" fontSize="9">Transformer</text>
            </g>

            {/* Main bus vertical line */}
            <line
              x1={busX}
              y1={svgHeight - footerHeight}
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
              const y = svgHeight - footerHeight - (i + 1) * floorHeight;
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
                  <rect x="60" y={y + floorHeight / 2 - 12} width="60" height="24" fill="#1f2937" stroke="#374151" strokeWidth="1" rx="3" />
                  <text x="90" y={y + floorHeight / 2 + 4} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="700">
                    FL {fd.floorNumber}
                  </text>

                  {/* Bus tap */}
                  <circle cx={busX} cy={y + floorHeight / 2} r="4" fill="#f97316" />

                  {/* Riser connection to feeders */}
                  <line
                    x1={busX}
                    y1={y + floorHeight / 2}
                    x2={feederStartX}
                    y2={y + floorHeight / 2}
                    stroke={lineColor}
                    strokeWidth="2"
                  />

                  {/* Feeder items */}
                  {fd.items.map((item, fi) => {
                    const fx = feederStartX + fi * 120;
                    return (
                      <g key={fi}>
                        <rect
                          x={fx}
                          y={y + floorHeight / 2 - 16}
                          width="110"
                          height="32"
                          fill="#1f2937"
                          stroke={lineColor}
                          strokeWidth="1"
                          rx="3"
                        />
                        <text x={fx + 55} y={y + floorHeight / 2 - 3} textAnchor="middle" fill="#e5e7eb" fontSize="8" fontWeight="600">
                          {item.name}
                        </text>
                        <text x={fx + 55} y={y + floorHeight / 2 + 8} textAnchor="middle" fill="#6b7280" fontSize="7">
                          {item.breakerSize} · {item.cableSize}
                        </text>
                      </g>
                    );
                  })}

                  {/* Voltage Drop Indicator */}
                  <g>
                    <rect
                      x="140"
                      y={y + floorHeight / 2 - 10}
                      width="80"
                      height="20"
                      fill={isDanger ? '#7f1d1d' : isWarning ? '#713f12' : '#1e3a5f'}
                      stroke={lineColor}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="180"
                      y={y + floorHeight / 2 + 4}
                      textAnchor="middle"
                      fill={isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="8"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      ΔV {fd.vDropPercent.toFixed(1)}%
                    </text>
                  </g>

                  {/* Demand load label */}
                  <text
                    x={busX - 60}
                    y={y + floorHeight / 2 + 4}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {fd.floorDemand.toFixed(1)} kW · {fd.floorCurrent.toFixed(0)}A
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(60, ${svgHeight - 30})`}>
              <line x1="0" y1="0" x2="20" y2="0" stroke="#60a5fa" strokeWidth="2" />
              <text x="25" y="4" fill="#6b7280" fontSize="8">Normal (&lt;3%)</text>
              <line x1="100" y1="0" x2="120" y2="0" stroke="#eab308" strokeWidth="2" />
              <text x="125" y="4" fill="#6b7280" fontSize="8">Warning (3-5%)</text>
              <line x1="210" y1="0" x2="230" y2="0" stroke="#ef4444" strokeWidth="2" />
              <text x="235" y="4" fill="#6b7280" fontSize="8">Danger (&gt;5%)</text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
