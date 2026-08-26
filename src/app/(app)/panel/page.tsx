'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  Cpu,
  Zap,
  Shield,
  Plug,
  Activity,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import { CABLE_CATALOG } from '@/lib/calculations/cablesData';
import { computeFeeders, createFindBreaker, type EquipmentItem, type DefaultFamilies } from '@/lib/calculations/feeders';
import { formatCableSizeFor } from '@/lib/calculations/cables';
import { calculateShortCircuitCurrent, getTypicalImpedance } from '@/lib/calculations/shortCircuit';
import type { Project, PanelFeeder } from '@/types';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';
import { TraceableCell } from '@/components/common/TraceableCell';
import {
  buildDesignCurrentTrace,
  buildBreakerSizingTrace,
  buildCableAmpacityTrace,
  buildPhaseBalanceTrace,
} from '@/lib/calculations/trace-engine';

function wrapSvgLines(text: string, maxCharsPerLine: number = 24, maxLines: number = 2): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

function getBreakerCategory(f: PanelFeeder): 'ACB' | 'MCCB' | 'MCB' {
  const model = (f.breakerModel || '').toLowerCase();
  const family = (f.familyName || '').toLowerCase();

  // 1. Air Circuit Breakers (ACB)
  if (
    model.includes('masterpact') ||
    model.includes('mtz') ||
    model.includes('emax') ||
    model.includes('3wl') ||
    model.includes('acb') ||
    family.includes('masterpact') ||
    family.includes('emax') ||
    family.includes('acb')
  ) {
    return 'ACB';
  }

  // 2. Miniature Circuit Breakers (MCB)
  if (
    model.includes('acti9') ||
    model.includes('ic60') ||
    model.includes('c60') ||
    model.includes('s200') ||
    model.includes('s201') ||
    model.includes('s202') ||
    model.includes('s203') ||
    model.includes('5sy') ||
    model.includes('mcb') ||
    family.includes('acti9') ||
    family.includes('mcb')
  ) {
    return 'MCB';
  }

  // 3. Molded Case Circuit Breakers (MCCB)
  if (
    model.includes('compact') ||
    model.includes('nsx') ||
    model.includes('tmax') ||
    model.includes('xt') ||
    model.includes('3va') ||
    model.includes('mccb') ||
    family.includes('compact') ||
    family.includes('nsx') ||
    family.includes('tmax') ||
    family.includes('mccb')
  ) {
    return 'MCCB';
  }

  // 4. Rating-based fallback for generic specifications
  if (f.breakerSize >= 800) return 'ACB';
  if (f.breakerSize > 63) return 'MCCB';
  return 'MCB';
}

const BREAKER_FAMILY_THEME: Record<'ACB' | 'MCCB' | 'MCB', { stroke: string; text: string; badgeBg: string; badgeBorder: string; badgeText: string }> = {
  ACB: {
    stroke: '#f97316',
    text: '#fdba74',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    badgeBorder: '#f97316',
    badgeText: '#f97316',
  },
  MCCB: {
    stroke: '#38bdf8',
    text: '#7dd3fc',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: '#0284c7',
    badgeText: '#38bdf8',
  },
  MCB: {
    stroke: '#94a3b8',
    text: '#e2e8f0',
    badgeBg: 'rgba(148, 163, 184, 0.15)',
    badgeBorder: '#64748b',
    badgeText: '#cbd5e1',
  },
};

export default function PanelDesignerPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer, canView, canEdit } = useProject();
  const { t, isRtl } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [panelType, setPanelType] = useState<'MDB' | 'SMDB'>('MDB');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  // Catalog arrives async; until it resolves, createFindBreaker([]) would label
  // every feeder GENERIC_SPEC. Gate the panel so that flash never renders.
  const [catalogLoaded, setCatalogLoaded] = useState(false);

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

  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipment?category=ACB,MCCB,MCB`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);
  useEffect(() => {
    let cancelled = false;
    loadEquipment().finally(() => {
      if (!cancelled) setCatalogLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadEquipment]);

  const defaultFamilies: DefaultFamilies = useMemo(
    () => ({
      ACB: project?.defaultAcbFamilyId ?? undefined,
      MCCB: project?.defaultMccbFamilyId ?? undefined,
      MCB: project?.defaultMcbFamilyId ?? undefined,
    }),
    [project?.defaultAcbFamilyId, project?.defaultMccbFamilyId, project?.defaultMcbFamilyId]
  );

  const findBreaker = useMemo(
    () => createFindBreaker(equipment, defaultFamilies, preferredManufacturer),
    [equipment, defaultFamilies, preferredManufacturer]
  );

  // Selected building + its feeder computation. Memoized so panel-type/floor
  // switches and modal opens don't recompute the whole building's feeders.
  // Computed before the guards below so the hook stays unconditional.
  const activeBldg = project
    ? project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0] || null
    : null;

  const feederResult = useMemo(() => {
    if (!project || !activeBldg) return null;
    // Outgoing feeders (MDB + SMDB) plus the main incomer breaker/cable via the
    // shared helper — the SAME catalog-frame device the breaker-schedule and
    // coordination pages use, so every view agrees. Transformer sizing stays
    // page-local (it has no analog in the breaker schedule).
    return computeFeeders(activeBldg, project, findBreaker);
  }, [project, activeBldg, findBreaker]);

  if (!project && (loading || contextLoading || selectedProjectId)) {
    return <PageSkeleton titleWidth="w-60" rowCount={7} />;
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Cpu size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  const bldg = activeBldg!;

  const { mdbFeeders, smdbFeeders, smdbFloorNumbers, mainIncomerSettings, mainBreakerIn, mainCableSize, mainParallelRuns, mainCableIz, mainCableUnderProtected } = feederResult!;

  const activeSmdbFloor = selectedFloor || (smdbFloorNumbers.length > 0 ? smdbFloorNumbers[0] : null);
  const smdbFeedersForActive = activeSmdbFloor ? smdbFeeders(activeSmdbFloor) : [];

  // Use appropriate feeders based on panel type
  const activeFeeders = panelType === 'MDB' ? mdbFeeders : smdbFeedersForActive;

  // MDB Main calculations
  // Total demand in kVA: sum of feeder real power (kW) divided by PF.
  // Prefer per-phase kW when available (PR1); fall back to legacy current formula.
  const perPhaseKva: [number, number, number] = [0, 0, 0];
  const totalDemandKva = mdbFeeders.reduce((s, f) => {
    const voltageKv = project.voltage / 1000;
    const kw = f.phaseKw
      ? f.phaseKw[0] + f.phaseKw[1] + f.phaseKw[2]
      : project.voltage === 230
        ? f.current * voltageKv * project.powerFactor
        : f.current * Math.sqrt(3) * voltageKv * project.powerFactor;
    // Accumulate per-phase kVA for transformer sizing (max-winding-limited).
    if (f.phaseKw) {
      perPhaseKva[0] += f.phaseKw[0] / project.powerFactor;
      perPhaseKva[1] += f.phaseKw[1] / project.powerFactor;
      perPhaseKva[2] += f.phaseKw[2] / project.powerFactor;
    }
    return s + kw / project.powerFactor;
  }, 0);
  // Main Current mirrors computeFeeders: worst-loaded phase current (the
  // lumped √3 average understates an unbalanced board's loaded phase).
  const mainBreakerCurrent = Math.max(
    Math.max(
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? 0), 0),
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? 0), 0),
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? 0), 0),
    ),
    calculateThreePhaseCurrent(totalDemandKva, project.voltage)
  );
  const transformerSize = sizeTransformer(totalDemandKva, 1.2, perPhaseKva);

  // Main incomer breaker + cable come from computeFeeders so this page shows
  // the SAME catalog-frame device as the breaker schedule / coordination page.
  // computeFeeders re-sizes the incomer cable to the catalog frame
  // (Ib <= In <= Iz), so the displayed breaker and cable always agree.
  const mainCategory = mainIncomerSettings.category === 'ACB' ? 'ACB' : 'MCCB';
  const mainBreakerModel = mainIncomerSettings.model ?? `Main ${mainCategory} ${mainBreakerIn}`;

  const mainCable = CABLE_CATALOG.find((c) => c.size >= mainCableSize) || CABLE_CATALOG[CABLE_CATALOG.length - 1];
  // Parallel cables per phase from the sizing engine (re-sized to the catalog frame)
  const cablesPerPhase = mainParallelRuns;

  // Neutral: sum per-phase unbalance across all feeders
  const maxPhaseCurrent = Math.max(
    mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? 0), 0),
    mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? 0), 0),
    mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? 0), 0),
  );
  const neutralCurrent = mdbFeeders.reduce((s, f) => s + (f.neutralCurrent ?? 0), 0);
  // Reduce N cable if neutral current < 50% of max phase current
  const canReduceN = maxPhaseCurrent > 0 && neutralCurrent < maxPhaseCurrent * 0.5;
  const neutralSize = canReduceN
    ? (CABLE_CATALOG.find((c) => c.copperXlpe3Ph >= neutralCurrent && c.size < mainCable.size) ?? mainCable).size
    : mainCable.size;
  const neutralCable = CABLE_CATALOG.find((c) => c.size === neutralSize) ?? mainCable;
  const neutralCables = Math.ceil(neutralCurrent / (neutralCable.copperXlpe3Ph || 1));

  // Earthing & Short Circuit calculations
  const earthingSystem = bldg.earthingSystem || 'TN-S';
  const effectiveTransformerKva = project.transformerSize || transformerSize || 500;
  const shortCircuit = calculateShortCircuitCurrent({
    ratedPower: effectiveTransformerKva,
    voltagePrimary: 11000,
    voltageSecondary: project.voltage,
    impedancePercent: getTypicalImpedance(effectiveTransformerKva),
    earthingSystem,
  });

  if (!catalogLoaded) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <WorkflowStepper currentStep={5} />
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
          <Activity size={18} className="animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">{t('breakerSchedule.loadingCatalog', 'Loading breaker catalog…')}</p>
        </div>
      </div>
    );
  }

  if (selectedProject && !canView('panelDesigner')) {
    return <AccessRestricted pageTitle={t('nav.panelDesigner', 'Panel Designer')} />;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Workflow Stepper: Step 5 */}
      <WorkflowStepper currentStep={5} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="panelDesigner" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="panelDesigner" pageTitle="Panel Designer" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu size={22} className="text-orange-500" />
            {panelType === 'MDB' ? t('panel.title', 'MDB Panel Designer') : `SMDB — ${t('panel.title', 'Panel Designer')}`}
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
              {t('calculator.floor', 'Floor')} {floorNumber}
            </button>
          ))}
        </div>
      )}

      {/* Main Incomer */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap size={14} className="text-orange-500" />
          {t('panel.incomer', 'Main Incomer')} &mdash; {panelType}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('common.maxDemand', 'Total Demand')}</p>
            <p className="text-lg font-bold text-orange-400 font-mono">{totalDemandKva.toFixed(1)} kVA</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('common.current', 'Main Current')}</p>
            <p className="text-lg font-bold text-blue-400 font-mono">{mainBreakerCurrent.toFixed(0)} A</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('common.breaker', 'Main Breaker')}</p>
            <p className="text-lg font-bold text-white font-mono">{mainBreakerIn}A</p>
            <p className="text-[10px] text-gray-500">{mainBreakerModel}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('common.cable', 'Main Cable')}</p>
            <p className={`text-lg font-bold font-mono ${mainCableUnderProtected ? 'text-red-400' : 'text-green-400'}`}>{formatCableSizeFor(mainCable.size, selectedProject?.calculationStandard)}</p>
            <p className="text-[10px] text-gray-500">{cablesPerPhase}×{formatCableSizeFor(mainCable.size, selectedProject?.calculationStandard)}</p>
            <p className="text-[10px] text-gray-500">N: {neutralCables}×{formatCableSizeFor(neutralSize, selectedProject?.calculationStandard)}</p>
            {mainCableUnderProtected && (
              <p className="text-[10px] text-red-400 font-semibold">
                {t('panel.cableUnderProtected', 'Iz {{iz}}A < In {{in}}A — increase cable or runs', { iz: mainCableIz, in: mainBreakerIn })}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('dashboard.transformerSize', 'Transformer')}</p>
            <p className="text-lg font-bold text-yellow-400 font-mono">{transformerSize} kVA</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">{t('panel.busbarRating', 'Busbar')}</p>
            <p className="text-lg font-bold text-white font-mono">
              {mainBreakerIn <= 800 ? '800A' : mainBreakerIn <= 1600 ? '1600A' : '3200A'}
            </p>
            <p className="text-[10px] text-gray-500">{t('panel.phasePE', '3-Phase + N + PE')}</p>
          </div>
        </div>
      </div>

      {/* Short Circuit & Earthing Analysis */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield size={14} className="text-orange-500" />
            {t('panel.shortCircuitAnalysis', 'Short-Circuit & Earthing Analysis')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Earthing System:</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {earthingSystem}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">3-Phase Isc (Icu Req)</p>
            <p className="text-lg font-bold text-red-400 font-mono">{shortCircuit.threePhaseIsc.toFixed(2)} kA</p>
            <p className="text-[10px] text-gray-500">Symmetric RMS</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Line-to-Line Isc</p>
            <p className="text-lg font-bold text-yellow-400 font-mono">{shortCircuit.twoPhaseIsc.toFixed(2)} kA</p>
            <p className="text-[10px] text-gray-500">Phase-to-Phase (2Φ)</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Phase-to-Earth / Neutral</p>
            <p className="text-lg font-bold text-blue-400 font-mono">
              {shortCircuit.itFirstFault ? '0.00 kA' : `${shortCircuit.phaseToNeutralIsc.toFixed(2)} kA`}
            </p>
            <p className="text-[10px] text-gray-500">
              {shortCircuit.itFirstFault
                ? '1st Fault (Floating)'
                : earthingSystem.toUpperCase() === 'TT'
                ? 'TT Loop Limited'
                : 'Solid Ground'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Peak Current (Ip)</p>
            <p className="text-lg font-bold text-purple-400 font-mono">{shortCircuit.peakCurrent.toFixed(2)} kA</p>
            <p className="text-[10px] text-gray-500">Mechanical Stress</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase">Transformer Impedance</p>
            <p className="text-lg font-bold text-gray-300 font-mono">{(shortCircuit.transformerZ * 1000).toFixed(2)} mΩ</p>
            <p className="text-[10px] text-gray-500">Fault MVA: {shortCircuit.faultMVA.toFixed(1)}</p>
          </div>
        </div>

        {/* Earthing Explanation Banner */}
        <div className="rounded-lg p-3 text-xs leading-relaxed border bg-gray-950/60 border-gray-800">
          {shortCircuit.itFirstFault ? (
            <p className="text-amber-300 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                <strong>IT Earthing System Notice:</strong> Single phase-to-earth fault current is negligible (0 kA) because the transformer neutral is isolated from ground. An Insulation Monitoring Device (IMD) is required to detect first faults. A double line-to-earth fault behaves as a phase-to-phase short circuit ({shortCircuit.twoPhaseIsc.toFixed(2)} kA).
              </span>
            </p>
          ) : earthingSystem.toUpperCase() === 'TT' ? (
            <p className="text-blue-300 flex items-start gap-2">
              <Shield size={15} className="shrink-0 mt-0.5 text-blue-400" />
              <span>
                <strong>TT Earthing System Notice:</strong> Earth-fault loop impedance (Z_earth = {shortCircuit.earthFaultImpedanceOhms ?? 0.5} Ω) restricts phase-to-earth fault current to {shortCircuit.phaseToNeutralIsc.toFixed(2)} kA (significantly lower than 3-phase fault level). Residual Current Devices (RCDs) are mandatory to ensure protection under high fault loop impedance.
              </span>
            </p>
          ) : (
            <p className="text-gray-400 flex items-start gap-2">
              <Shield size={15} className="shrink-0 mt-0.5 text-green-400" />
              <span>
                <strong>{earthingSystem} Earthing System:</strong> Solidly grounded transformer neutral provides a low-impedance path (I_sc, P-N = {shortCircuit.phaseToNeutralIsc.toFixed(2)} kA ≈ 3-Phase Isc), guaranteeing rapid instantaneous magnetic tripping of circuit breakers.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Panel Visual Layout */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu size={14} className="text-orange-500" />
            {t('panel.outgoingFeeders', 'Panel Layout')} &mdash; {activeFeeders.length} {t('cableSchedule.circuits', 'Feeders')}
          </h2>

          {/* Breaker Family Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-950/70 border border-gray-800/80 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 font-medium text-[11px]">Breakers:</span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-orange-400">
              <span className="w-2 h-2 rounded-sm border border-orange-500 bg-orange-500/20 inline-block" />
              ACB (Incomer)
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-sky-400">
              <span className="w-2 h-2 rounded-sm border border-sky-400 bg-sky-500/20 inline-block" />
              MCCB (Feeders)
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-slate-300">
              <span className="w-2 h-2 rounded-sm border border-slate-400 bg-slate-500/20 inline-block" />
              MCB (Sub-circuits)
            </span>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1 text-[10.5px] text-gray-400">
              <span className="w-2 h-2 rounded-sm border border-slate-600 bg-slate-700 inline-block" />
              Instruments
            </span>
          </div>
        </div>

        {/* SVG Panel Outline */}
        <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-x-auto">
          <svg
            viewBox={`0 0 800 ${Math.max(600, activeFeeders.length * 44 + 220)}`}
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Panel Box */}
            <rect
              x="40"
              y="20"
              width="720"
              height={activeFeeders.length * 44 + 175}
              fill="none"
              stroke="#374151"
              strokeWidth="2"
              rx="4"
            />

            {/* Panel Title */}
            <text x="400" y="50" textAnchor="middle" fill="#9ca3af" fontSize="14" fontWeight="600">
              {panelType} — {bldg.name}{panelType === 'SMDB' && activeSmdbFloor ? ` — ${t('calculator.floor', 'Floor')} ${activeSmdbFloor}` : ''} — {preferredManufacturer}
            </text>

            {/* Busbar */}
            <rect x="60" y="65" width="680" height="12" fill="#f97316" opacity="0.3" rx="2" />
            <text x="400" y="75" textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="600">
              {t('panel.mainBusbar', 'MAIN BUSBAR')} — {mainBreakerIn}A — {t('panel.phasePE', '3Φ + N + PE')}
            </text>

            {/* Main Incomer (Prominently Highlighted in ACB Amber/Orange) */}
            {(() => {
              const lines = wrapSvgLines(`${mainBreakerIn}A ${mainBreakerModel}`, 24, 2);
              return (
                <g>
                  <rect x="60" y="90" width="155" height="48" fill="#1f2937" stroke="#f97316" strokeWidth="1.5" rx="3" />
                  <text x="137.5" y="105" textAnchor="middle" fill="#f97316" fontSize="9.5" fontWeight="600">
                    {t('panel.incomerBadge', 'INCOMER (ACB)')}
                  </text>
                  {lines.length === 1 ? (
                    <text x="137.5" y="122" textAnchor="middle" fill="#fdba74" fontSize="8" fontWeight="500">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="137.5" y="118" textAnchor="middle" fill="#fdba74" fontSize="7.5" fontWeight="500">
                        {lines[0]}
                      </text>
                      <text x="137.5" y="128" textAnchor="middle" fill="#fed7aa" fontSize="7">
                        {lines[1]}
                      </text>
                    </>
                  )}
                </g>
              );
            })()}

            {/* SPD (Neutral Auxiliary Device with Wrapped Subtitle) */}
            {(() => {
              const spdText = t('panel.surgeProtection', 'Type 1+2');
              const lines = wrapSvgLines(spdText, 13, 2);
              return (
                <g>
                  <rect x="245" y="90" width="85" height="48" fill="#111827" stroke="#475569" strokeWidth="1" rx="3" />
                  <text x="287.5" y="105" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">SPD</text>
                  {lines.length === 1 ? (
                    <text x="287.5" y="123" textAnchor="middle" fill="#64748b" fontSize="7.5">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="287.5" y="118" textAnchor="middle" fill="#64748b" fontSize="7">
                        {lines[0]}
                      </text>
                      <text x="287.5" y="128" textAnchor="middle" fill="#64748b" fontSize="6.5">
                        {lines[1]}
                      </text>
                    </>
                  )}
                </g>
              );
            })()}

            {/* Meter (Neutral Auxiliary Device) */}
            {(() => {
              const meterTitle = t('panel.metering', 'POWER METER');
              const titleLines = wrapSvgLines(meterTitle, 14, 2);
              return (
                <g>
                  <rect x="340" y="90" width="100" height="48" fill="#111827" stroke="#475569" strokeWidth="1" rx="3" />
                  <text x="390" y="105" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontWeight="600">
                    {titleLines[0] || 'POWER METER'}
                  </text>
                  <text x="390" y="123" textAnchor="middle" fill="#64748b" fontSize="7.5">
                    kWh / kVA / PF
                  </text>
                </g>
              );
            })()}

            {/* CTs (Neutral Auxiliary Device) */}
            <rect x="450" y="90" width="65" height="48" fill="#111827" stroke="#475569" strokeWidth="1" rx="3" />
            <text x="482.5" y="106" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">CTs</text>
            <text x="482.5" y="123" textAnchor="middle" fill="#64748b" fontSize="7.5">{t('panel.ratioTbd', 'Ratio TBD')}</text>

            {/* Phase Lamps (Neutral Auxiliary Device) */}
            <rect x="525" y="90" width="75" height="48" fill="#111827" stroke="#475569" strokeWidth="1" rx="3" />
            <text x="562.5" y="106" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">L1 L2 L3</text>
            <text x="562.5" y="123" textAnchor="middle" fill="#64748b" fontSize="7.5">{t('panel.indicators', 'Indicators')}</text>

            {/* Spare (Neutral Auxiliary Device) */}
            <rect x="610" y="90" width="130" height="48" fill="#111827" stroke="#334155" strokeWidth="1" rx="3" strokeDasharray="4" />
            <text x="675" y="106" textAnchor="middle" fill="#64748b" fontSize="9">{t('panel.spareWays', 'SPARE WAYS')}</text>
            <text x="675" y="123" textAnchor="middle" fill="#475569" fontSize="7.5">{t('panel.expansion', 'Expansion')}</text>

            {/* Feeders */}
            {activeFeeders.map((feeder, i) => {
              const y = 155 + i * 44;
              const cat = getBreakerCategory(feeder);
              const theme = BREAKER_FAMILY_THEME[cat];
              const breakerLabel = `${feeder.breakerSize}A — ${feeder.breakerModel}`;
              const lines = wrapSvgLines(breakerLabel, 26, 2);

              return (
                <g key={feeder.name + i}>
                  {/* Feeder connection line from busbar */}
                  <line x1="230" y1={78} x2="230" y2={y + 18} stroke="#374151" strokeWidth="1" />
                  <line x1="230" y1={y + 18} x2="60" y2={y + 18} stroke="#374151" strokeWidth="1" />

                  {/* Feeder breaker box (Color-coded by Breaker Technology: ACB / MCCB / MCB) */}
                  <rect x="60" y={y} width="160" height="36" fill="#1f2937" stroke={theme.stroke} strokeWidth="1" rx="3" />
                  
                  {/* Breaker Model (Wrapped) */}
                  {lines.length === 1 ? (
                    <text x="140" y={y + 15} textAnchor="middle" fill={theme.text} fontSize="7.5" fontWeight="600">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="140" y={y + 13} textAnchor="middle" fill={theme.text} fontSize="7.5" fontWeight="600">
                        {lines[0]}
                      </text>
                      <text x="140" y={y + 22} textAnchor="middle" fill={theme.text} fontSize="7" fontWeight="500">
                        {lines[1]}
                      </text>
                    </>
                  )}

                  {/* Feeder Name */}
                  <text x="140" y={lines.length === 1 ? y + 27 : y + 31} textAnchor="middle" fill="#9ca3af" fontSize="6.5">
                    {feeder.name}
                  </text>

                  {/* Cable line & size */}
                  <line x1="220" y1={y + 18} x2="440" y2={y + 18} stroke="#475569" strokeWidth="1" opacity="0.6" />
                  <text x="330" y={y + 13} textAnchor="middle" fill="#9ca3af" fontSize="7.5">
                    {formatCableSizeFor(feeder.cableSize, selectedProject?.calculationStandard)}
                  </text>

                  {/* Current */}
                  <text x="460" y={y + 22} fill="#d1d5db" fontSize="8.5" fontFamily="monospace">
                    {feeder.current.toFixed(1)}A
                  </text>

                  {/* Poles / Phase */}
                  <text x="535" y={y + 22} fill="#9ca3af" fontSize="7.5" fontFamily="monospace">
                    {feeder.isThreePhase ? '3P' : '1P'}{feeder.assignedPhase ? `-L${feeder.assignedPhase}` : ''}
                  </text>

                  {/* Breaker Category Badge & Feeder Service */}
                  <rect x="595" y={y + 9} width="34" height="18" fill={theme.badgeBg} stroke={theme.badgeBorder} strokeWidth="0.8" rx="2" />
                  <text x="612" y={y + 21} textAnchor="middle" fill={theme.badgeText} fontSize="7" fontWeight="700">
                    {cat}
                  </text>
                  <text x="638" y={y + 22} fill="#94a3b8" fontSize="7.5">
                    {feeder.type.replace('_', ' ')}
                  </text>
                </g>
              );
            })}

            {/* Bottom label */}
            <text
              x="400"
              y={activeFeeders.length * 44 + 190}
              textAnchor="middle"
              fill="#4b5563"
              fontSize="10"
            >
              {panelType} — {activeFeeders.length} {t('cableSchedule.circuits', 'feeders')} — {t('common.total', 'Total')} {totalDemandKva.toFixed(1)} kVA — {t('dashboard.transformerSize', 'Transformer')} {transformerSize} kVA
            </text>
          </svg>
        </div>
      </div>

      {/* Feeder Schedule Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={14} className="text-orange-500" />
          {t('panel.feederSchedule', 'Feeder Schedule')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full engineering-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th className="text-center">{t('common.feeder', 'Feeder')}</th>
                <th className="text-center">{t('common.type', 'Type')}</th>
                <th className="text-center">L1 (A)</th>
                <th className="text-center">L2 (A)</th>
                <th className="text-center">L3 (A)</th>
                <th className="text-center">{t('calculator.neutral', 'Neutral')} (A)</th>
                <th className="text-center">{t('calculator.unbalance', 'Unbal')} %</th>
                <th className="text-center">{t('common.poles', 'Poles')}</th>
                <th className="text-center">{t('common.breaker', 'Breaker (A)')}</th>
                <th className="text-center">{t('common.breakerModel', 'Breaker Model')}</th>
                <th className="text-center">{t('common.cable', 'Cable (mm²)')}</th>
              </tr>
            </thead>
            <tbody>
              {activeFeeders.map((f, i) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <td className="text-center font-mono text-gray-500">{i + 1}</td>
                  <td className="text-center text-gray-200">
                    {f.name}
                    {f.internalImbalanceNotModeled && (
                      <span className="ms-2 inline-flex items-center text-[10px] text-yellow-500" title="3-phase apartment treated as balanced; per-room imbalance not modeled">
                        <AlertTriangle size={10} className="me-0.5" />
                        int. imbalance
                      </span>
                    )}
                  </td>
                  <td className="text-center text-xs text-gray-400">{f.type.replace('_', ' ')}</td>
                  <td className="text-center font-mono text-orange-400">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L1)`,
                          powerKw: ((f.phaseCurrent?.[0] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[0] ?? f.current,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[0] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-orange-400">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L2)`,
                          powerKw: ((f.phaseCurrent?.[1] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[1] ?? f.current,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[1] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-orange-400">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L3)`,
                          powerKw: ((f.phaseCurrent?.[2] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[2] ?? f.current,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[2] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-yellow-400">{(f.neutralCurrent ?? 0).toFixed(1)}</td>
                  <td className="text-center font-mono text-gray-400">
                    <TraceableCell
                      getTrace={() =>
                        buildPhaseBalanceTrace({
                          panelName: f.name,
                          l1A: f.phaseCurrent?.[0] ?? f.current,
                          l2A: f.phaseCurrent?.[1] ?? f.current,
                          l3A: f.phaseCurrent?.[2] ?? f.current,
                          unbalancePercent: f.unbalancePct ?? 0,
                          maxAllowablePercent: 10,
                        })
                      }
                    >
                      {(f.unbalancePct ?? 0).toFixed(1)}%
                      {f.imbalanced && <span className="ms-1 text-red-500" title={`Current unbalance exceeds ${f.unbalancePct?.toFixed(1)}% / ${project.calculationStandard ?? 'IEC'} 10% limit`}>!</span>}
                    </TraceableCell>
                  </td>
                  <td className="text-center text-xs text-gray-400 font-mono">{f.isThreePhase ? '3P' : '1P'}{f.assignedPhase ? `-L${f.assignedPhase}` : ''}</td>
                  <td className="text-center font-mono text-blue-400">
                    <TraceableCell
                      getTrace={() =>
                        buildBreakerSizingTrace({
                          circuitName: f.name,
                          designCurrentA: f.current,
                          selectedTripA: f.breakerSize,
                          frameSizeA: f.breakerSize >= 630 ? f.breakerSize : f.breakerSize > 160 ? 250 : 160,
                          breakingCapacityKa: f.breakerSize >= 630 ? 65 : 36,
                          cableAmpacityA: f.cableIz,
                        })
                      }
                    >
                      {f.breakerSize}
                    </TraceableCell>
                  </td>
                  <td className="text-center text-xs text-gray-400 font-mono">{f.breakerModel}</td>
                  <td className="text-center font-mono text-green-400">
                    <TraceableCell
                      getTrace={() =>
                        buildCableAmpacityTrace({
                          circuitName: f.name,
                          cableSizeMm2: f.cableSize,
                          parallelRuns: 1,
                          material: 'copper',
                          insulation: 'XLPE',
                          installMethod: 'Method E',
                          ambientTempC: project?.ambientTemp || 45,
                          groupingCount: project?.groupingCount || 1,
                          tempFactor: 0.87,
                          groupFactor: 0.70,
                          nominalAmpacityPerRun: f.cableIz ? Math.round(f.cableIz / 0.6) : Math.round(f.current * 1.3),
                          deratedAmpacityPerRun: f.cableIz || Math.round(f.current * 1.1),
                          totalDeratedAmpacity: f.cableIz || Math.round(f.current * 1.1),
                          designCurrentA: f.current,
                        })
                      }
                    >
                      {f.cableSize}
                    </TraceableCell>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t border-gray-700 font-bold">
                <td></td>
                <td className="text-white">{t('common.total', 'TOTAL')}</td>
                <td></td>
                <td className="text-end font-mono text-orange-400">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-end font-mono text-orange-400">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-end font-mono text-orange-400">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-end font-mono text-yellow-400">
                  {/* Vector sum of neutrals is not additive; leave blank */}
                  —
                </td>
                <td className="text-end font-mono text-gray-400">
                  {(() => {
                    const l1 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? f.current), 0);
                    const l2 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? f.current), 0);
                    const l3 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? f.current), 0);
                    const avg = (l1 + l2 + l3) / 3;
                    return avg > 0 ? (((Math.max(l1, l2, l3) - Math.min(l1, l2, l3)) / avg) * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td></td>
                <td className="text-end font-mono text-white">{mainBreakerIn}</td>
                <td className="text-center text-xs font-mono text-white">{mainBreakerModel}</td>
                <td className="text-center font-mono text-green-400">{mainCableSize}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
