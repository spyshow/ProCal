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
import { formatCableSizeFor, calculateCableAmpacity } from '@/lib/calculations/cables';
import { codeOf } from '@/lib/calculations/codes';
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

const BREAKER_FAMILY_THEME: Record<'ACB' | 'MCCB' | 'MCB', { stroke: string; textClass: string; badgeBg: string; badgeBorder: string; badgeTextClass: string }> = {
  ACB: {
    stroke: '#ea580c',
    textClass: 'text-orange-700 dark:text-orange-300',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeBorder: '#ea580c',
    badgeTextClass: 'text-orange-700 dark:text-orange-300',
  },
  MCCB: {
    stroke: '#0284c7',
    textClass: 'text-sky-700 dark:text-sky-300',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeBorder: '#0284c7',
    badgeTextClass: 'text-sky-700 dark:text-sky-300',
  },
  MCB: {
    stroke: '#64748b',
    textClass: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    badgeBorder: '#64748b',
    badgeTextClass: 'text-slate-700 dark:text-slate-300',
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

  const {
    mdbFeeders,
    smdbFeeders,
    smdbFloorNumbers,
    mainIncomerSettings,
    mainBreakerIn,
    mainCableSize,
    mainParallelRuns,
    mainCableIz,
    mainCableUnderProtected,
    transformerSizeKva,
    mainIncomerCurrent,
    mainNeutralCurrent,
  } = feederResult!;

  const busbarRating = mainBreakerIn <= 800 ? 800 : mainBreakerIn <= 1600 ? 1600 : 3200;

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
      : !f.isThreePhase
        ? f.current * (voltageKv / Math.sqrt(3)) * project.powerFactor
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
  const mainBreakerCurrent = mainIncomerCurrent ?? Math.max(
    Math.max(
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? 0), 0),
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? 0), 0),
      mdbFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? 0), 0),
    ),
    calculateThreePhaseCurrent(totalDemandKva, project.voltage)
  );
  const transformerSize = transformerSizeKva || sizeTransformer(totalDemandKva, 1.2, perPhaseKva);

  // Main incomer breaker + cable come from computeFeeders so this page shows
  // the SAME catalog-frame device as the breaker schedule / coordination page.
  // computeFeeders re-sizes the incomer cable to the catalog frame
  // (Ib <= In <= Iz), so the displayed breaker and cable always agree.
  const mainCategory = mainIncomerSettings.category === 'ACB' ? 'ACB' : 'MCCB';
  const mainBreakerModel = mainIncomerSettings.model ?? `Main ${mainCategory} ${mainBreakerIn}`;

  const mainCable = CABLE_CATALOG.find((c) => c.size >= mainCableSize) || CABLE_CATALOG[CABLE_CATALOG.length - 1];
  // Parallel cables per phase from the sizing engine (re-sized to the catalog frame)
  const cablesPerPhase = mainParallelRuns;

  // Neutral: vector neutral current from whole-building balance (IEC 60364-5-52 §524)
  const maxPhaseCurrent = mainBreakerCurrent;
  const neutralCurrent = mainNeutralCurrent ?? mdbFeeders.reduce((s, f) => s + (f.neutralCurrent ?? 0), 0);
  // Neutral cross-section rules per IEC 60364-5-52 §524:
  // 1. S_N >= 16 mm² for copper (or phase size if S_phase <= 16 mm²).
  // 2. S_N >= S_phase / 2 (half-size neutral allowed only when Ineutral <= 0.5 * Iphase and S_phase > 16 mm²).
  // 3. For parallel installations, number of neutral conductors matches phase runs.
  const minNeutralSize = Math.max(16, mainCable.size <= 16 ? mainCable.size : Math.ceil(mainCable.size / 2));
  const canReduceN = mainCable.size > 16 && maxPhaseCurrent > 0 && neutralCurrent < maxPhaseCurrent * 0.5;
  const neutralSize = canReduceN
    ? (CABLE_CATALOG.find((c) => c.size >= minNeutralSize && c.copperXlpe3Ph * cablesPerPhase >= neutralCurrent && c.size < mainCable.size) ?? mainCable).size
    : mainCable.size;
  const neutralCable = CABLE_CATALOG.find((c) => c.size === neutralSize) ?? mainCable;
  const neutralCables = cablesPerPhase;

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
      <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
        <WorkflowStepper currentStep={5} />
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center shadow-xs">
          <Activity size={18} className="animate-spin text-orange-600 dark:text-orange-400 mx-auto mb-2" />
          <p className="text-[var(--table-header-color)] text-sm">{t('breakerSchedule.loadingCatalog', 'Loading breaker catalog…')}</p>
        </div>
      </div>
    );
  }

  if (selectedProject && !canView('panelDesigner')) {
    return <AccessRestricted pageTitle={t('nav.panelDesigner', 'Panel Designer')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 5 */}
      <WorkflowStepper currentStep={5} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="panelDesigner" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="panelDesigner" pageTitle="Panel Designer" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground-color)] flex items-center gap-2">
            <Cpu size={22} className="text-orange-600 dark:text-orange-400" />
            {panelType === 'MDB' ? t('panel.title', 'MDB Panel Designer') : `SMDB — ${t('panel.title', 'Panel Designer')}`}
          </h1>
          <p className="text-sm text-[var(--table-header-color)] mt-1">
            {project.name} — {bldg.name} · {preferredManufacturer} series
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPanelType('MDB')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              panelType === 'MDB'
                ? 'bg-orange-600 text-white text-white-force shadow-xs shadow-orange-600/20'
                : 'bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-[var(--card-bg)] border border-[var(--border-color)]'
            }`}
          >
            MDB
          </button>
          <button
            onClick={() => setPanelType('SMDB')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              panelType === 'SMDB'
                ? 'bg-orange-600 text-white text-white-force shadow-xs shadow-orange-600/20'
                : 'bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-[var(--card-bg)] border border-[var(--border-color)]'
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedBuilding === b.id
                  ? 'bg-orange-600 text-white text-white-force shadow-xs shadow-orange-600/20'
                  : 'bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-[var(--card-bg)] border border-[var(--border-color)]'
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSmdbFloor === floorNumber
                  ? 'bg-orange-600 text-white text-white-force shadow-xs shadow-orange-600/20'
                  : 'bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-[var(--card-bg)] border border-[var(--border-color)]'
              }`}
            >
              {t('calculator.floor', 'Floor')} {floorNumber}
            </button>
          ))}
        </div>
      )}

      {/* Main Incomer */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap size={14} className="text-orange-600 dark:text-orange-400" />
          {t('panel.incomer', 'Main Incomer')} &mdash; {panelType}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-orange-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('common.maxDemand', 'Total Demand')}</p>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-400 font-mono">{totalDemandKva.toFixed(1)} kVA</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-sky-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('common.current', 'Main Current')}</p>
            <p className="text-lg font-bold text-sky-700 dark:text-sky-400 font-mono">{mainBreakerCurrent.toFixed(0)} A</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-slate-400 dark:border-l-slate-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('common.breaker', 'Main Breaker')}</p>
            <p className="text-lg font-bold text-[var(--foreground-color)] font-mono">{mainBreakerIn}A</p>
            <p className="text-[10px] text-[var(--table-header-color)] truncate">{mainBreakerModel}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-emerald-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('common.cable', 'Main Cable')}</p>
            <p className={`text-lg font-bold font-mono ${mainCableUnderProtected ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {cablesPerPhase > 1 ? `${cablesPerPhase} × ` : ''}{formatCableSizeFor(mainCable.size, selectedProject?.calculationStandard)}
            </p>
            <p className="text-[10px] text-[var(--table-header-color)]">{cablesPerPhase}×{formatCableSizeFor(mainCable.size, selectedProject?.calculationStandard)}</p>
            <p className="text-[10px] text-[var(--table-header-color)]">N: {neutralCables}×{formatCableSizeFor(neutralSize, selectedProject?.calculationStandard)}</p>
            {mainCableUnderProtected && (
              <p className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold">
                {t('panel.cableUnderProtected', 'Iz {{iz}}A < In {{in}}A — increase cable or runs', { iz: mainCableIz, in: mainBreakerIn })}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-amber-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('dashboard.transformerSize', 'Transformer')}</p>
            <p className="text-lg font-bold text-amber-800 dark:text-amber-300 font-mono">{transformerSize} kVA</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-slate-400 dark:border-l-slate-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.busbarRating', 'Busbar')}</p>
            <p className="text-lg font-bold text-[var(--foreground-color)] font-mono">
              {busbarRating}A
            </p>
            <p className="text-[10px] text-[var(--table-header-color)]">{t('panel.phasePE', '3-Phase + N + PE')}</p>
          </div>
        </div>
      </div>

      {/* Short Circuit & Earthing Analysis */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider flex items-center gap-2">
            <Shield size={14} className="text-orange-600 dark:text-orange-400" />
            {t('panel.shortCircuitAnalysis', 'Short-Circuit & Earthing Analysis')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--table-header-color)]">{t('panel.earthingSystem', 'Earthing System')}:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
              {earthingSystem}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-rose-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.threePhaseIsc', '3-Phase Isc (Icu Req)')}</p>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">{shortCircuit.threePhaseIsc.toFixed(2)} kA</p>
            <p className="text-[10px] text-[var(--table-header-color)]">{t('panel.symmetricRms', 'Symmetric RMS')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-amber-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.lineToLineIsc', 'Line-to-Line Isc')}</p>
            <p className="text-lg font-bold text-amber-800 dark:text-amber-300 font-mono">{shortCircuit.twoPhaseIsc.toFixed(2)} kA</p>
            <p className="text-[10px] text-[var(--table-header-color)]">{t('panel.phaseToPhase', 'Phase-to-Phase (2Φ)')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-sky-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.phaseToEarth', 'Phase-to-Earth / Neutral')}</p>
            <p className="text-lg font-bold text-sky-700 dark:text-sky-400 font-mono">
              {shortCircuit.itFirstFault ? '0.00 kA' : `${shortCircuit.phaseToNeutralIsc.toFixed(2)} kA`}
            </p>
            <p className="text-[10px] text-[var(--table-header-color)]">
              {shortCircuit.itFirstFault
                ? t('panel.floatingFault', '1st Fault (Floating)')
                : earthingSystem.toUpperCase() === 'TT'
                ? t('panel.ttLoopLimited', 'TT Loop Limited')
                : t('panel.solidGround', 'Solid Ground')}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-purple-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.peakCurrent', 'Peak Current (Ip)')}</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300 font-mono">{shortCircuit.peakCurrent.toFixed(2)} kA</p>
            <p className="text-[10px] text-[var(--table-header-color)]">{t('panel.mechanicalStress', 'Mechanical Stress')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] border-l-4 border-l-slate-400 dark:border-l-slate-500 bg-[var(--card-bg-subtle)] p-3 shadow-2xs">
            <p className="text-[10px] text-[var(--table-header-color)] uppercase font-semibold">{t('panel.transformerImpedance', 'Transformer Impedance')}</p>
            <p className="text-lg font-bold text-[var(--foreground-color)] font-mono">{(shortCircuit.transformerZ * 1000).toFixed(2)} mΩ</p>
            <p className="text-[10px] text-[var(--table-header-color)]">{t('panel.faultMva', 'Fault MVA')}: {shortCircuit.faultMVA.toFixed(1)}</p>
          </div>
        </div>

        {/* Earthing Explanation Banner */}
        <div className="rounded-xl p-3.5 text-xs leading-relaxed border bg-[var(--card-bg-subtle)] border-[var(--border-color)] shadow-2xs">
          {shortCircuit.itFirstFault ? (
            <p className="text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong className="text-amber-800 dark:text-amber-300">IT Earthing System Notice:</strong> Single phase-to-earth fault current is negligible (0 kA) because the transformer neutral is isolated from ground. An Insulation Monitoring Device (IMD) is required to detect first faults. A double line-to-earth fault behaves as a phase-to-phase short circuit ({shortCircuit.twoPhaseIsc.toFixed(2)} kA).
              </span>
            </p>
          ) : earthingSystem.toUpperCase() === 'TT' ? (
            <p className="text-sky-900 dark:text-sky-200 flex items-start gap-2">
              <Shield size={15} className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
              <span>
                <strong className="text-sky-800 dark:text-sky-300">TT Earthing System Notice:</strong> Earth-fault loop impedance (Z_earth = {shortCircuit.earthFaultImpedanceOhms ?? 0.5} Ω) restricts phase-to-earth fault current to {shortCircuit.phaseToNeutralIsc.toFixed(2)} kA (significantly lower than 3-phase fault level). Residual Current Devices (RCDs) are mandatory to ensure protection under high fault loop impedance.
              </span>
            </p>
          ) : (
            <p className="text-[var(--foreground-color)] flex items-start gap-2">
              <Shield size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong className="text-emerald-800 dark:text-emerald-300">{earthingSystem} Earthing System:</strong> Solidly grounded transformer neutral provides a low-impedance path (I_sc, P-N = {shortCircuit.phaseToNeutralIsc.toFixed(2)} kA ≈ 3-Phase Isc), guaranteeing rapid instantaneous magnetic tripping of circuit breakers.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Panel Visual Layout */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider flex items-center gap-2">
            <Cpu size={14} className="text-orange-600 dark:text-orange-400" />
            {t('panel.outgoingFeeders', 'Panel Layout')} &mdash; {activeFeeders.length} {t('cableSchedule.circuits', 'Feeders')}
          </h2>

          {/* Breaker Family Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-[var(--card-bg-subtle)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 shadow-sm">
            <span className="text-[var(--text-secondary)] font-medium text-[11px]">{t('breakers.title', 'Breakers')}:</span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-orange-700 dark:text-orange-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm border border-orange-500 bg-orange-500/20 inline-block" />
              {t('panel.acbIncomer', 'ACB (Incomer)')}
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-sky-700 dark:text-sky-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm border border-sky-500 bg-sky-500/20 inline-block" />
              {t('panel.mccbFeeders', 'MCCB (Feeders)')}
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-slate-700 dark:text-slate-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm border border-slate-500 bg-slate-500/20 inline-block" />
              {t('panel.mcbSubcircuits', 'MCB (Sub-circuits)')}
            </span>
            <span className="text-[var(--border-color)]">|</span>
            <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-secondary)] font-medium">
              <span className="w-2.5 h-2.5 rounded-sm border border-[var(--border-color)] bg-[var(--card-bg)] inline-block" />
              {t('panel.instruments', 'Instruments')}
            </span>
          </div>
        </div>

        {/* SVG Panel Outline */}
        <div className="bg-[var(--card-bg-subtle)] rounded-lg border border-[var(--border-color)] p-4 overflow-x-auto shadow-inner">
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
              fill="var(--card-bg)"
              stroke="var(--border-color)"
              strokeWidth="2"
              rx="6"
            />

            {/* Panel Title */}
            <text x="400" y="50" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)] font-semibold" fontSize="14" fontWeight="600">
              {panelType} — {bldg.name}{panelType === 'SMDB' && activeSmdbFloor ? ` — ${t('calculator.floor', 'Floor')} ${activeSmdbFloor}` : ''} — {preferredManufacturer}
            </text>

            {/* Busbar */}
            <rect x="60" y="65" width="680" height="12" fill="#ea580c" opacity="0.35" rx="2" />
            <text x="400" y="74" textAnchor="middle" fill="#ea580c" fontSize="10" fontWeight="700">
              {t('panel.mainBusbar', 'MAIN BUSBAR')} — {busbarRating}A — {t('panel.phasePE', '3Φ + N + PE')}
            </text>

            {/* Main Incomer (Prominently Highlighted in ACB Amber/Orange) */}
            {(() => {
              const lines = wrapSvgLines(`${mainBreakerIn}A ${mainBreakerModel}`, 24, 2);
              return (
                <g>
                  <rect x="60" y="90" width="155" height="48" fill="var(--card-bg)" stroke="#ea580c" strokeWidth="1.8" rx="4" />
                  <text x="137.5" y="105" textAnchor="middle" fill="#ea580c" fontSize="9.5" fontWeight="700">
                    {t('panel.incomerBadge', 'INCOMER (ACB)')}
                  </text>
                  {lines.length === 1 ? (
                    <text x="137.5" y="122" textAnchor="middle" fill="currentColor" className="text-orange-700 dark:text-orange-300 font-semibold" fontSize="8" fontWeight="600">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="137.5" y="118" textAnchor="middle" fill="currentColor" className="text-orange-700 dark:text-orange-300 font-semibold" fontSize="7.5" fontWeight="600">
                        {lines[0]}
                      </text>
                      <text x="137.5" y="128" textAnchor="middle" fill="currentColor" className="text-orange-700 dark:text-orange-300 font-medium" fontSize="7" fontWeight="500">
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
                  <rect x="245" y="90" width="85" height="48" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="4" />
                  <text x="287.5" y="105" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)] font-semibold" fontSize="9" fontWeight="600">SPD</text>
                  {lines.length === 1 ? (
                    <text x="287.5" y="123" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7.5">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="287.5" y="118" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7">
                        {lines[0]}
                      </text>
                      <text x="287.5" y="128" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="6.5">
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
                  <rect x="340" y="90" width="100" height="48" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="4" />
                  <text x="390" y="105" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)] font-semibold" fontSize="8.5" fontWeight="600">
                    {titleLines[0] || 'POWER METER'}
                  </text>
                  <text x="390" y="123" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7.5">
                    kWh / kVA / PF
                  </text>
                </g>
              );
            })()}

            {/* CTs (Neutral Auxiliary Device) */}
            <rect x="450" y="90" width="65" height="48" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="4" />
            <text x="482.5" y="106" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)] font-semibold" fontSize="9" fontWeight="600">CTs</text>
            <text x="482.5" y="123" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7.5">{t('panel.ratioTbd', 'Ratio TBD')}</text>

            {/* Phase Lamps (Neutral Auxiliary Device) */}
            <rect x="525" y="90" width="75" height="48" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="4" />
            <text x="562.5" y="106" textAnchor="middle" fill="currentColor" className="text-[var(--foreground-color)] font-semibold" fontSize="9" fontWeight="600">L1 L2 L3</text>
            <text x="562.5" y="123" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7.5">{t('panel.indicators', 'Indicators')}</text>

            {/* Spare (Neutral Auxiliary Device) */}
            <rect x="610" y="90" width="130" height="48" fill="var(--card-bg)" stroke="var(--border-color)" strokeWidth="1" rx="4" strokeDasharray="4" />
            <text x="675" y="106" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-semibold" fontSize="9">{t('panel.spareWays', 'SPARE WAYS')}</text>
            <text x="675" y="123" textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] opacity-80" fontSize="7.5">{t('panel.expansion', 'Expansion')}</text>

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
                  <line x1="230" y1={78} x2="230" y2={y + 18} stroke="var(--border-color)" strokeWidth="1" />
                  <line x1="230" y1={y + 18} x2="60" y2={y + 18} stroke="var(--border-color)" strokeWidth="1" />

                  {/* Feeder breaker box (Color-coded by Breaker Technology: ACB / MCCB / MCB) */}
                  <rect x="60" y={y} width="160" height="36" fill="var(--card-bg)" stroke={theme.stroke} strokeWidth="1.2" rx="4" />
                  
                  {/* Breaker Model (Wrapped) */}
                  {lines.length === 1 ? (
                    <text x="140" y={y + 15} textAnchor="middle" fill="currentColor" className={`${theme.textClass} font-semibold`} fontSize="7.5" fontWeight="600">
                      {lines[0]}
                    </text>
                  ) : (
                    <>
                      <text x="140" y={y + 13} textAnchor="middle" fill="currentColor" className={`${theme.textClass} font-semibold`} fontSize="7.5" fontWeight="600">
                        {lines[0]}
                      </text>
                      <text x="140" y={y + 22} textAnchor="middle" fill="currentColor" className={`${theme.textClass} font-medium`} fontSize="7" fontWeight="500">
                        {lines[1]}
                      </text>
                    </>
                  )}

                  {/* Feeder Name */}
                  <text x="140" y={lines.length === 1 ? y + 27 : y + 31} textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)]" fontSize="6.5">
                    {feeder.name}
                  </text>

                  {/* Cable line & size */}
                  <line x1="220" y1={y + 18} x2="440" y2={y + 18} stroke="var(--border-color)" strokeWidth="1" opacity="0.6" />
                  <text x="330" y={y + 13} textAnchor="middle" fill="currentColor" className="text-[var(--text-secondary)] font-medium" fontSize="7.5">
                    {formatCableSizeFor(feeder.cableSize, selectedProject?.calculationStandard)}
                  </text>

                  {/* Current */}
                  <text x="460" y={y + 22} fill="currentColor" className="text-orange-700 dark:text-orange-400 font-mono font-semibold" fontSize="8.5">
                    {feeder.current.toFixed(1)}A
                  </text>

                  {/* Poles / Phase */}
                  <text x="535" y={y + 22} fill="currentColor" className="text-[var(--text-secondary)] font-mono" fontSize="7.5">
                    {feeder.isThreePhase ? '3P' : '1P'}{feeder.assignedPhase ? `-L${feeder.assignedPhase}` : ''}
                  </text>

                  {/* Breaker Category Badge & Feeder Service */}
                  <rect x="595" y={y + 9} width="34" height="18" fill={theme.badgeBg} stroke={theme.badgeBorder} strokeWidth="0.8" rx="3" />
                  <text x="612" y={y + 21} textAnchor="middle" fill="currentColor" className={`${theme.badgeTextClass} font-bold`} fontSize="7" fontWeight="700">
                    {cat}
                  </text>
                  <text x="638" y={y + 22} fill="currentColor" className="text-[var(--text-secondary)]" fontSize="7.5">
                    {t(`loadTypes.${feeder.type}`, feeder.type.replace('_', ' '))}
                  </text>
                </g>
              );
            })}

            {/* Bottom label */}
            <text
              x="400"
              y={activeFeeders.length * 44 + 190}
              textAnchor="middle"
              fill="currentColor"
              className="text-[var(--text-secondary)] font-medium"
              fontSize="10"
            >
              {panelType} — {activeFeeders.length} {t('cableSchedule.circuits', 'feeders')} — {t('common.total', 'Total')} {totalDemandKva.toFixed(1)} kVA — {t('dashboard.transformerSize', 'Transformer')} {transformerSize} kVA
            </text>
          </svg>
        </div>
      </div>

      {/* Feeder Schedule Table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={14} className="text-orange-600 dark:text-orange-400" />
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
            <tbody className="divide-y divide-[var(--border-color)]">
              {activeFeeders.map((f, i) => (
                <tr key={i} className="hover:bg-[var(--card-bg-subtle)] transition-colors">
                  <td className="text-center font-mono text-[var(--text-secondary)]">{i + 1}</td>
                  <td className="text-center font-medium text-[var(--foreground-color)]">
                    {f.name}
                    {f.internalImbalanceNotModeled && (
                      <span className="ms-2 inline-flex items-center text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title="3-phase apartment treated as balanced; per-room imbalance not modeled">
                        <AlertTriangle size={10} className="me-0.5" />
                        {t('panel.intImbalance', 'int. imbalance')}
                      </span>
                    )}
                  </td>
                  <td className="text-center text-xs text-[var(--text-secondary)]">{t(`loadTypes.${f.type}`, f.type.replace('_', ' '))}</td>
                  <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-semibold">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L1)`,
                          powerKw: ((f.phaseCurrent?.[0] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[0] ?? f.current,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[0] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-semibold">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L2)`,
                          powerKw: ((f.phaseCurrent?.[1] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[1] ?? f.current,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[1] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-semibold">
                    <TraceableCell
                      getTrace={() =>
                        buildDesignCurrentTrace({
                          loadName: `${f.name} (L3)`,
                          powerKw: ((f.phaseCurrent?.[2] ?? f.current) * (project?.voltage ? project.voltage / Math.sqrt(3) : 230) * (project?.powerFactor || 0.85)) / 1000,
                          powerFactor: project?.powerFactor || 0.85,
                          voltageV: Math.round(project?.voltage ? project.voltage / Math.sqrt(3) : 230),
                          isThreePhase: false,
                          calculatedCurrentA: f.phaseCurrent?.[2] ?? f.current,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        })
                      }
                    >
                      {(f.phaseCurrent?.[2] ?? f.current).toFixed(1)}
                    </TraceableCell>
                  </td>
                  <td className="text-center font-mono text-amber-700 dark:text-amber-400 font-semibold">{(f.neutralCurrent ?? 0).toFixed(1)}</td>
                  <td className="text-center font-mono text-[var(--foreground-color)]">
                    <TraceableCell
                      getTrace={() =>
                        buildPhaseBalanceTrace({
                          panelName: f.name,
                          l1A: f.phaseCurrent?.[0] ?? f.current,
                          l2A: f.phaseCurrent?.[1] ?? f.current,
                          l3A: f.phaseCurrent?.[2] ?? f.current,
                          unbalancePercent: f.unbalancePct ?? 0,
                          maxAllowablePercent: 10,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        })
                      }
                    >
                      {(f.unbalancePct ?? 0).toFixed(1)}%
                      {f.imbalanced && <span className="ms-1 text-red-600 dark:text-red-400 font-bold" title={`Current unbalance exceeds ${f.unbalancePct?.toFixed(1)}% / ${project.calculationStandard ?? 'IEC'} 10% limit`}>!</span>}
                    </TraceableCell>
                  </td>
                  <td className="text-center text-xs text-[var(--text-secondary)] font-mono">{f.isThreePhase ? '3P' : '1P'}{f.assignedPhase ? `-L${f.assignedPhase}` : ''}</td>
                  <td className="text-center font-mono text-sky-700 dark:text-sky-400 font-semibold">
                    <TraceableCell
                      getTrace={() => {
                        const isMcb = f.category === 'MCB' || (!f.category && f.breakerSize <= 63 && !['SMDB', 'SERVICE_PANEL', 'PUMP_PANEL', 'ELEVATOR_PANEL'].includes(f.type));
                        const defaultIcu = f.breakerSize >= 630 ? 65 : isMcb ? 10 : 36;
                        return buildBreakerSizingTrace({
                          circuitName: f.name,
                          designCurrentA: f.current,
                          selectedTripA: f.breakerSize,
                          category: f.category ?? (isMcb ? 'MCB' : f.breakerSize >= 630 ? 'ACB' : 'MCCB'),
                          frameSizeA: f.breakerSize >= 630 ? f.breakerSize : isMcb ? f.breakerSize : f.breakerSize > 160 ? 250 : 160,
                          breakingCapacityKa: f.breakingCapacityKa ?? defaultIcu,
                          cableAmpacityA: f.cableIz,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        });
                      }}
                    >
                      {f.breakerSize}
                    </TraceableCell>
                  </td>
                  <td className="text-center text-xs text-[var(--foreground-color)] font-mono">{f.breakerModel}</td>
                  <td className="text-center font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    <TraceableCell
                      getTrace={() => {
                        const is3Ph = f.isThreePhase ?? true;
                        const amp = calculateCableAmpacity(f.cableSize, is3Ph, {
                          material: 'copper',
                          insulation: 'XLPE',
                          installMethod: 'E',
                          ambientTemp: project?.ambientTemp || 30,
                          groupingCount: project?.groupingCount || 1,
                          parallelRuns: f.parallelRuns || 1,
                          code: codeOf(project.calculationStandard || selectedProject?.calculationStandard),
                        });
                        return buildCableAmpacityTrace({
                          circuitName: f.name,
                          cableSizeMm2: f.cableSize,
                          parallelRuns: f.parallelRuns || 1,
                          material: 'copper',
                          insulation: 'XLPE',
                          installMethod: 'Method E',
                          ambientTempC: project?.ambientTemp || 30,
                          groupingCount: project?.groupingCount || 1,
                          tempFactor: amp.tempFactor ?? 1.0,
                          groupFactor: amp.groupFactor ?? 1.0,
                          nominalAmpacityPerRun: amp.singleNominalAmpacity,
                          deratedAmpacityPerRun: amp.singleDeratedAmpacity,
                          totalDeratedAmpacity: amp.deratedAmpacity,
                          breakerSizeA: f.breakerSize,
                          designCurrentA: f.current,
                          calculationStandard: project.calculationStandard || selectedProject?.calculationStandard,
                        });
                      }}
                    >
                      {formatCableSizeFor(f.cableSize, project.calculationStandard || selectedProject?.calculationStandard)}
                    </TraceableCell>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-[var(--border-color)] font-bold bg-[var(--card-bg-subtle)]">
                <td></td>
                <td className="text-center text-[var(--foreground-color)] font-bold">{t('common.total', 'TOTAL')}</td>
                <td></td>
                <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-bold">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-bold">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-center font-mono text-orange-700 dark:text-orange-400 font-bold">
                  {activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? f.current), 0).toFixed(1)}
                </td>
                <td className="text-center font-mono text-amber-700 dark:text-amber-400 font-bold">
                  {/* Vector sum of neutrals is not additive; leave blank */}
                  —
                </td>
                <td className="text-center font-mono text-[var(--foreground-color)] font-bold">
                  {(() => {
                    const l1 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[0] ?? f.current), 0);
                    const l2 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[1] ?? f.current), 0);
                    const l3 = activeFeeders.reduce((s, f) => s + (f.phaseCurrent?.[2] ?? f.current), 0);
                    const avg = (l1 + l2 + l3) / 3;
                    return avg > 0 ? (((Math.max(l1, l2, l3) - Math.min(l1, l2, l3)) / avg) * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td></td>
                <td className="text-center font-mono text-sky-700 dark:text-sky-400 font-bold">{mainBreakerIn}</td>
                <td className="text-center text-xs font-mono text-[var(--foreground-color)] font-bold">{mainBreakerModel}</td>
                <td className="text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">{mainCableSize}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
