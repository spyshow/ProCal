'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { sizeCableAndBreaker, formatCableSizeFor } from '@/lib/calculations/cables';
import { codeOf } from '@/lib/calculations/codes';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { computeFeeders, createFindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { computeFloorRiserVd, type RiserFloorVd } from '@/lib/calculations/riser';
import { PageSkeleton } from '@/components/ui/skeleton';
import type { FloorDesign, Project } from '@/types';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';

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
  const { selectedProjectId, selectedProject, loading: contextLoading, canView, canEdit } = useProject();
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

  if (!project && (loading || contextLoading || selectedProjectId)) {
    return <PageSkeleton titleWidth="w-56" rowCount={6} />;
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
        <GitBranch size={40} className="text-[var(--text-muted)] mb-3" />
        <p className="text-[var(--text-muted)] text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project?.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project?.preferredManufacturer]);
  const { equipment } = useEquipmentCatalog(query);

  const findBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project?.defaultAcbFamilyId ?? undefined,
          MCCB: project?.defaultMccbFamilyId ?? undefined,
          MCB: project?.defaultMcbFamilyId ?? undefined,
        },
        project?.preferredManufacturer
      ),
    [equipment, project]
  );

  const bldg = project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0];
  const sortedFloors = [...bldg.floorDesigns].sort((a, b) => a.floorNumber - b.floorNumber);
  const feedersData = computeFeeders(bldg as any, project as any, findBreaker);

  // Layout constants
  const ITEM_SPACING = 28;
  const headerHeight = 100;
  const footerHeight = 220;
  const mdbHeight = 72;
  const svgWidth = 1100;
  const busX = 460;

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
    code: codeOf((project as Project).calculationStandard),
  });

  // Transformer sizing: use building-specific rating if set, or auto-size for this building's demand.
  // Auto-size uses the worst-loaded winding (max phase × 3) so an unbalanced
  // building is not under-provisioned — same rule as panel/page.tsx and computeFeeders.
  const transformerPf = project.powerFactor || 0.85;
  const overallBalance = phaseBalance(
    [...sortedFloors.flatMap((fd) => fd.items), ...(bldg.buildingLoads || [])],
    project as never
  );
  const perPhaseKva: [number, number, number] = [
    overallBalance.phaseKw[0] / transformerPf,
    overallBalance.phaseKw[1] / transformerPf,
    overallBalance.phaseKw[2] / transformerPf,
  ];
  const transformerKva = bldg.transformer || (project.buildings.length === 1 && project.transformerSize ? project.transformerSize : null) || sizeTransformer(totalDemandKva, 1.2, perPhaseKva);
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
  // Dynamic floor heights: calculate vertical height per floor so all apartment circuit nodes
  // fit without clipping or overlapping adjacent floor bounds
  const floorHeights = floorData.map((fd) =>
    Math.max(120, (fd.items.length - 1) * ITEM_SPACING + 64)
  );
  const totalFloorsHeight = floorHeights.reduce((sum, h) => sum + h, 0);
  const svgHeight = Math.max(700, totalFloorsHeight + headerHeight + footerHeight + mdbHeight + 40);

  // Vertical position for each floor's center line (stacked upward from ground floor above MDB)
  const floorsBaseY = svgHeight - footerHeight - mdbHeight - 20;
  const floorCyList: number[] = [];
  let currentFloorOffset = 0;
  for (let i = 0; i < floorHeights.length; i++) {
    floorCyList.push(floorsBaseY - currentFloorOffset - floorHeights[i] / 2);
    currentFloorOffset += floorHeights[i];
  }

  // Band color for a ΔV cell against its IEC limit (4% total / 1% sub-main / 3% final).
  const bandColor = (pct: number, limit: number, hasData: boolean) =>
    !hasData ? '#6b7280' : pct > limit ? '#ef4444' : pct > limit * 0.8 ? '#f59e0b' : '#3b82f6';

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

  if (selectedProject && !canView('riserDiagram')) {
    return <AccessRestricted pageTitle={t('nav.riserDiagram', 'Riser Diagram')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 6 */}
      <WorkflowStepper currentStep={6} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="riserDiagram" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="riserDiagram" pageTitle="Riser Diagram" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground-color)] flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            {t('riser.title', 'Vertical Riser Diagram')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{project.name} &mdash; {bldg.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download size={14} className="text-white" />
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                selectedBuilding === b.id
                  ? 'bg-orange-600 text-white text-white-force shadow-xs'
                  : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* SVG Riser */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 overflow-auto shadow-xs" style={{ maxHeight: '80vh' }}>
        <div className="w-fit min-w-full flex justify-center py-1">
          <div
            style={{
              width: Math.round(svgWidth * zoom),
              height: Math.round(svgHeight * zoom),
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              <svg
                ref={svgRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                width={svgWidth}
                height={svgHeight}
                xmlns="http://www.w3.org/2000/svg"
                className="bg-[var(--card-bg-subtle)] rounded-lg shadow-md border border-[var(--border-color)]"
              >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-color)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

            {/* Title */}
            <text x={busX} y="30" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="16" fontWeight="700">
              {t('riser.title', 'RISER DIAGRAM')} — {bldg.name}
            </text>
            <text x={busX} y="50" textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="11">
              {project.voltage}V · {project.powerFactor} PF · {bldg.earthingSystem || '—'} · {sortedFloors.length} {t('calculator.floorsCount', 'Floors')} · {project.calculationStandard || 'IEC'}
            </text>

            {/* Supply Feeder Cable: Transformer → MDB */}
            <line
              x1={busX}
              y1={svgHeight - 147}
              x2={busX}
              y2={svgHeight - footerHeight - 40}
              stroke="#f97316"
              strokeWidth="2.5"
            />
            <circle cx={busX} cy={svgHeight - footerHeight - 40} r="3" fill="#f97316" />
            <text
              x={busX + 8}
              y={(svgHeight - 147 + (svgHeight - footerHeight - 40)) / 2 + 3}
              fill="currentColor"
              className="text-[var(--text-muted)]"
              fontSize="8"
              fontFamily="monospace"
            >
              LV Incomer
            </text>

            {/* Transformer symbol at bottom */}
            <g transform={`translate(${busX}, ${svgHeight - 125})`}>
              <circle cx="-14" cy="0" r="22" fill="none" stroke="#f97316" strokeWidth="2" />
              <circle cx="14" cy="0" r="22" fill="none" stroke="#f97316" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fill="#f97316" fontSize="10.5" fontWeight="600">TR</text>
              <text x="0" y="34" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="11" fontWeight="700">
                {transformerKva} kVA
              </text>
              <text x="0" y="48" textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="9">
                {project.voltage}V · {transformerImpedance}% Z
              </text>
            </g>

            {/* MDB Block */}
            <g transform={`translate(${busX - 100}, ${svgHeight - footerHeight - mdbHeight - 40})`}>
              <rect x="0" y="0" width="200" height={mdbHeight} fill="var(--card-bg)" stroke="#f97316" strokeWidth="2" rx="4" />
              <text x="100" y="20" textAnchor="middle" fill="#f97316" fontSize="12" fontWeight="700">
                {t('sld.mdb', 'MDB — Main Distribution Board')}
              </text>
              <text x="100" y="38" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="10" fontWeight="600">
                {feedersData.mainBreakerIn}A {feedersData.mainIncomerSettings.category} · {totalDemandKva.toFixed(1)} kVA
              </text>
              <text x="100" y="54" textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="9">
                {feedersData.mainIncomerCurrent.toFixed(0)}A · {feedersData.mainParallelRuns > 1 ? `${feedersData.mainParallelRuns} × ${formatCableSizeFor(feedersData.mainCableSize, project.calculationStandard)}` : formatCableSizeFor(feedersData.mainCableSize, project.calculationStandard)}
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
              const cy = floorCyList[i]; // dynamically positioned floor center line
              const isWarning = fd.isWarning;
              const isDanger = fd.isDanger;
              const lineColor = fd.totalNoData ? '#6b7280' : isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#3b82f6';

              return (
                <g key={fd.id}>
                  {/* Floor level line */}
                  <line
                    x1="60"
                    y1={cy}
                    x2={svgWidth - 60}
                    y2={cy}
                    stroke="var(--border-color)"
                    strokeWidth="1"
                    strokeDasharray="4"
                  />

                  {/* Floor label */}
                  <rect x="60" y={cy - 14} width="70" height="28" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="3" />
                  <text x="95" y={cy + 4} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="700">
                    {t('riser.floor', 'FL')} {fd.floorNumber}
                  </text>

                  {/* Voltage Drop Indicator (transformer→furthest load = total ΔV) */}
                  <g transform={`translate(200, ${cy - 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="24"
                      fill={fd.totalNoData ? 'var(--card-bg-subtle)' : isDanger ? '#7f1d1d' : isWarning ? '#713f12' : '#1e3a5f'}
                      stroke={lineColor}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="50"
                      y="10"
                      textAnchor="middle"
                      fill={fd.totalNoData ? 'var(--text-muted)' : isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
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
                      fill={fd.totalNoData ? 'var(--text-muted)' : isDanger ? '#fca5a5' : isWarning ? '#fde047' : '#93c5fd'}
                      fontSize="7"
                      fontFamily="monospace"
                    >
                      {fd.totalNoData ? 'no data' : `${fd.actualVoltage.toFixed(1)}V`}
                    </text>
                  </g>

                  {/* Bus tap dot */}
                  <circle cx={busX} cy={cy} r="4" fill="#f97316" />

                  {/* Orange riser: MDB bus → SDB. SDB floors only. */}
                  {fd.hasFloorSubPanels && (
                    <line x1={busX} y1={cy} x2={570} y2={cy} stroke="#f97316" strokeWidth="2" />
                  )}

                  {/* Cable info on the riser (SDB) / branch count (direct). Positioned cleanly in the 110px gap. */}
                  <text
                    x={fd.hasFloorSubPanels ? 515 : (busX + 730) / 2}
                    y={cy - 8}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-[var(--text-muted)]"
                    fontSize="7.5"
                    fontFamily="monospace"
                  >
                    {fd.hasRiser
                      ? fd.riserNoData
                        ? 'no riser data'
                        : `${fd.riserCableSize ? formatCableSizeFor(fd.riserCableSize, project.calculationStandard) : '—'} ${fd.riserCableInsulation || 'XLPE'}${fd.riserCableMaterial === 'aluminum' ? ' Al' : ''} · ${fd.riserCableLength?.toFixed(0) ?? '—'}m`
                      : `${fd.items.length} ${t('cableSchedule.circuits', 'apt feeders')}`}
                  </text>

                  {/* SDB Block — placed RIGHT of the main bus, on the orange riser. */}
                  {fd.hasFloorSubPanels && (
                    <g transform={`translate(570, ${cy - 20})`}>
                      <rect x="0" y="0" width="130" height="40" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="3" />
                      <text x="65" y="11" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="9" fontWeight="600">
                        SDB-{fd.floorNumber}
                      </text>
                      <text x="65" y="22" textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="7">
                        {fd.floorDemand.toFixed(1)}kW · {fd.floorKva.toFixed(1)}kVA · DF{fd.diversityPct.toFixed(0)}%
                      </text>
                      <text x="65" y="33" textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="7">
                        {fd.riserNoData
                          ? `no riser data · ${fd.floorCurrent.toFixed(0)}A`
                          : `${formatCableSizeFor(fd.riserCableSize, project.calculationStandard)} · L=${fd.riserCableLength?.toFixed(0)}m · ${fd.floorCurrent.toFixed(0)}A`}
                      </text>
                    </g>
                  )}

                  {/* Downstream blue feeder rail: board → vertical rail → apartments.
                      SDB floors: rail starts at the SDB's right edge (700).
                      Direct floors: rail starts right at the bus tap. */}
                  {(() => {
                    const railX = 730;
                    const boardEdgeX = fd.hasFloorSubPanels ? 700 : busX;
                    const N = fd.items.length;
                    if (N === 0) return null;
                    const firstCY = cy + (0 - (N - 1) / 2) * ITEM_SPACING;
                    const lastCY = cy + ((N - 1) - (N - 1) / 2) * ITEM_SPACING;
                    return (
                      <>
                        {/* board → rail head */}
                        <line x1={boardEdgeX} y1={cy} x2={railX} y2={cy} stroke="#3b82f6" strokeWidth="2" />
                        {/* vertical rail spanning the apartment stack */}
                        {N > 1 && (
                          <line x1={railX} y1={firstCY} x2={railX} y2={lastCY} stroke="#3b82f6" strokeWidth="2" />
                        )}
                        {/* circuit designation, above the rail */}
                        <text x={railX} y={firstCY - 8} textAnchor="middle" fill="#f97316" fontSize="8.5" fontWeight="700">
                          W{i + 1}
                        </text>
                        {/* apartment nodes tap off the rail, stacked vertically */}
                        {fd.items.map((item, fi) => {
                          const nodeCY = cy + (fi - (N - 1) / 2) * ITEM_SPACING;
                          const matchingFeeder = fd.hasFloorSubPanels
                            ? feedersData.smdbFeeders(fd.floorNumber).find((f) => (f.itemId && f.itemId === item.id) || f.name.includes(item.name))
                            : (feedersData.mdbFeeders.find((f) => (f.itemId && f.itemId === item.id) || (f.floorDesignId === fd.id && f.name.includes(item.name))) ||
                               feedersData.mdbFeeders.find((f) => f.name.includes(`F${fd.floorNumber}`) && f.name.includes(item.name)));
                          const itemCableSize = item.cableSize || matchingFeeder?.formattedCableSize || '4 mm²';
                          const aptLeft = 740;
                          return (
                            <g key={item.id || fi}>
                              <line x1={railX} y1={nodeCY} x2={aptLeft} y2={nodeCY} stroke="#3b82f6" strokeWidth="1.5" />
                              <rect x={aptLeft} y={nodeCY - 11} width="115" height="22" fill="var(--card-bg)" stroke="#3b82f6" strokeWidth="1" rx="3" />
                              <text x={aptLeft + 57.5} y={nodeCY - 1} textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="7.5" fontWeight="600">
                                {item.name}
                              </text>
                              <text x={aptLeft + 57.5} y={nodeCY + 8} textAnchor="middle" fill="currentColor" className="text-[var(--text-muted)]" fontSize="6.5">
                                {itemCableSize} · {(item.calculatedMaxDemand || 0).toFixed(1)}kW
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </g>
              );
            })}

            {/* Legend */}
            <g transform={`translate(60, ${svgHeight - 20})`}>
              <text x="0" y="0" fill="currentColor" className="text-[var(--foreground-color)]" fontSize="9" fontWeight="600">{t('sld.legend', 'Legend')} (total ΔV, transformer→furthest load):</text>
              <line x1="310" y1="0" x2="330" y2="0" stroke="#3b82f6" strokeWidth="2" />
              <text x="335" y="3" fill="currentColor" className="text-[var(--text-muted)]" fontSize="8">Normal ({'<'}3.2%)</text>
              <line x1="415" y1="0" x2="435" y2="0" stroke="#f59e0b" strokeWidth="2" />
              <text x="440" y="3" fill="currentColor" className="text-[var(--text-muted)]" fontSize="8">Warning</text>
              <line x1="515" y1="0" x2="535" y2="0" stroke="#ef4444" strokeWidth="2" />
              <text x="540" y="3" fill="currentColor" className="text-[var(--text-muted)]" fontSize="8">Danger ({'>'}4%)</text>
              <line x1="620" y1="0" x2="640" y2="0" stroke="#6b7280" strokeWidth="2" strokeDasharray="3" />
              <text x="645" y="3" fill="currentColor" className="text-[var(--text-muted)]" fontSize="8">no data</text>
              <text x="710" y="3" fill="currentColor" className="text-[var(--text-muted)]" fontSize="8">| IEC 60364: Sub-main {'<'}1%, Final {'<'}3%, Total {'<'}4%</text>
            </g>
          </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-xs">
        <h3 className="text-sm font-semibold text-[var(--foreground-color)] mb-3">{t('riser.floorSummary', 'Floor Summary')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)]">
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.floor', 'Floor')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.panel', 'Panel')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.demand', 'Demand')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">ΣkVA</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">DF%</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.current', 'Current')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.riserVd', 'Riser ΔV')}<span className="block font-normal opacity-70">{'<1%'}</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.branchVd', 'Branch ΔV')}<span className="block font-normal opacity-70">{'<3%'}</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.totalVd', 'Total ΔV')}<span className="block font-normal opacity-70">{'<4%'}</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.voltage', 'Voltage')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {floorData.map((fd) => (
                <tr key={fd.id} className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg-subtle)] transition-colors">
                  <td className="py-2.5 px-3 text-orange-500 font-semibold text-center">FL {fd.floorNumber}</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.hasFloorSubPanels ? `SDB-${fd.floorNumber}` : 'Direct'}</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorDemand.toFixed(1)} kW</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorKva.toFixed(1)} kVA</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.diversityPct.toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorCurrent.toFixed(0)} A</td>
                  <td className="py-2.5 px-3 text-center" style={{ color: bandColor(fd.riserVdPercent, 1, fd.hasRiser && !fd.riserNoData) }}>
                    {fd.hasRiser ? (fd.riserNoData ? '—' : `${fd.riserVdPercent.toFixed(2)}%`) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center" style={{ color: bandColor(fd.branchVdPercent, 3, !fd.branchNoData) }}>
                    {fd.branchNoData ? '—' : `${fd.branchVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold" style={{ color: bandColor(fd.totalVdPercent, 4, !fd.totalNoData) }}>
                    {fd.totalNoData ? '—' : `${fd.totalVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.totalNoData ? '—' : `${fd.actualVoltage.toFixed(1)} V`}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      fd.totalNoData ? 'bg-[var(--card-bg-subtle)] border-[var(--border-color)] text-[var(--text-muted)]' :
                      fd.isDanger ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400' :
                      fd.isWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400' :
                      'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
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
