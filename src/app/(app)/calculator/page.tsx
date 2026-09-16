'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  Building2,
  Plus,
  Trash2,
  Zap,
  Home,
  Wrench,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Calculator,
  Copy,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import { PageSkeleton } from '@/components/ui/skeleton';
import type { FloorItem, FloorDesign, Building, Project } from '@/types';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { MotionIcon } from '@/components/MotionIcon';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';
import { TraceableCell } from '@/components/common/TraceableCell';
import { buildDesignCurrentTrace } from '@/lib/calculations/trace-engine';

export default function CalculatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>}>
      <CalculatorContent />
    </Suspense>
  );
}

function CalculatorContent() {
  const searchParams = useSearchParams();
  const focusFloorId = searchParams.get('floor');
  const { selectedProjectId, selectedProject, loading: contextLoading, refreshProject, mutateProject, isQA, canView, canEdit, currentMemberRole } = useProject();
  const { t, isRtl } = useTranslation();

  const isReadOnly = isQA || !canEdit('calculator') || currentMemberRole === 'QA';

  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(focusFloorId || null);
  const [expandedBuildingLoads, setExpandedBuildingLoads] = useState(true);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [addForm, setAddForm] = useState({
    type: 'APARTMENT',
    name: '',
    apartmentTemplateId: '',
    loadLibraryItemId: '',
    customKw: '15',
  });

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
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await refreshProject();
      // The context now holds the fresh project; the sync effect above copies
      // it (and defaults the selected building) into local state.
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, refreshProject]);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);

  const handleSeedDefaults = async () => {
    if (!project?.id) return;
    setIsSeedingDefaults(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/seed-defaults`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate default templates');
        return;
      }
      await loadProject();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const handleAddItem = async (floorDesignId: string) => {
    const res = await fetch(`/api/floors/${floorDesignId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to add item');
      return; // keep the form open so the user can fix and retry
    }
    setAddForm({ type: 'APARTMENT', name: '', apartmentTemplateId: '', loadLibraryItemId: '', customKw: '15' });
    setShowAddItem(null);
    loadProject();
  };

  const handleDeleteItem = async (itemId: string) => {
    await fetch(`/api/floor-items/${itemId}`, { method: 'DELETE' });
    loadProject();
  };

  const handleUpdateAssignedPhase = async (itemId: string, assignedPhase: number | null) => {
    const updateFn = (prev: Project | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        buildings: prev.buildings.map((b) => ({
          ...b,
          floorDesigns: b.floorDesigns.map((fd) => ({
            ...fd,
            items: fd.items.map((item) =>
              item.id === itemId ? { ...item, assignedPhase } : item
            ),
          })),
        })),
      };
    };

    // Immediate optimistic local & context update
    setProject(updateFn);
    if (mutateProject) {
      mutateProject(updateFn);
    }

    try {
      const res = await fetch(`/api/floor-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedPhase }),
      });
      if (!res.ok) {
        throw new Error('Failed to update phase');
      }
    } catch (err) {
      console.error('Failed to update assigned phase:', err);
      loadProject();
    }
  };

  const handleRebalanceFloor = async (floorDesignId: string) => {
    await fetch(`/api/floors/${floorDesignId}/rebalance`, { method: 'POST' });
    loadProject();
  };

  const handleRecalculate = async (floorDesignId: string) => {
    await fetch(`/api/floors/${floorDesignId}/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetSizing: true }),
    });
    loadProject();
  };

  // Copy to floors
  const [copySourceFloor, setCopySourceFloor] = useState<string | null>(null);
  const [copyTargetFloors, setCopyTargetFloors] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const handleCopyToFloors = async () => {
    if (!bldg || !copySourceFloor || copyTargetFloors.length === 0) return;
    setCopying(true);

    try {
      const res = await fetch(`/api/floors/${copySourceFloor}/copy-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFloorIds: copyTargetFloors,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to copy items to target floors');
      }
    } catch (err) {
      console.error('Copy to floors failed:', err);
      alert('Network error while copying items to floors');
    } finally {
      setCopySourceFloor(null);
      setCopyTargetFloors([]);
      setCopying(false);
      loadProject();
    }
  };

  const bldg = project
    ? project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0]
    : null;
  const sortedFloors = bldg ? [...bldg.floorDesigns].sort((a, b) => a.floorNumber - b.floorNumber) : [];

  // Detect stale apartment calculations: compare template room loads with stored values.
  const needsRecalculation = project
    ? project.buildings.some((b) =>
        b.floorDesigns.some((fd) =>
          fd.items.some((item) => {
            if (item.type !== 'APARTMENT' || !item.apartmentTemplate?.rooms) return false;
            const expectedLoad = item.apartmentTemplate.rooms.reduce(
              (sum, r) => sum + r.connectedLoad, 0
            ) / 1000;
            return Math.abs(expectedLoad - item.calculatedConnectedLoad) > 0.01;
          })
        )
      )
    : false;

  // Per-building aggregate balance (all floor items + building loads).
  // Single combined balance so 1-phase loads auto-assign across the full board,
  // not within separate groups (which would pile them onto the same phase).
  const allItems = bldg
    ? [...bldg.floorDesigns.flatMap((fd) => fd.items), ...(bldg.buildingLoads ?? [])]
    : [];
  const buildingBalance = project && bldg
    ? phaseBalance(allItems as any, project)
    : null;

  // Create a map of item ID → assigned phase from building-level balance.
  // This ensures per-floor balance uses the building-level assignments.
  const buildingPhaseMap = new Map<string, number>(
    (buildingBalance?.assignments ?? [])
      .filter((a) => a.phaseCount === 1)
      .map((a) => [a.id, a.assignedPhase])
  );

  // Summary totals (active power kW and apparent power kVA)
  const calcPf = project?.powerFactor || 0.85;
  const totalConnectedLoadKw = bldg
    ? sortedFloors.reduce(
        (sum, fd) => sum + fd.items.reduce((s, i) => s + (i.calculatedConnectedLoad || 0), 0),
        0
      ) + (bldg.buildingLoads ?? []).reduce((sum, bl) => sum + (bl.loadLibraryItem?.power ?? 0) * bl.quantity, 0)
    : 0;
  const totalMaxDemandKw = bldg
    ? sortedFloors.reduce(
        (sum, fd) => sum + fd.items.reduce((s, i) => s + (i.calculatedMaxDemand || 0), 0),
        0
      ) + (bldg.buildingLoads ?? []).reduce((sum, bl) => sum + (bl.loadLibraryItem?.power ?? 0) * bl.quantity, 0)
    : 0;
  const totalConnectedKva = totalConnectedLoadKw / calcPf;
  const totalMaxDemandKva = totalMaxDemandKw / calcPf;
  // Building mechanical loads (elevators, fire/booster pumps) carry no inter-load
  // diversity — worst case they run together — so no demandFactor here. This keeps
  // Max Demand consistent with the per-phase current (phaseBalance also omits it).
  // Incomer current = max phase current from the combined building balance (correct for mixed 1φ/3φ boards).
  const totalCurrent3Ph = buildingBalance?.maxPhaseCurrent ?? 0;

  if (selectedProject && !canView('calculator')) {
    return <AccessRestricted pageTitle={t('nav.calculator', 'Load Calculator')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 1 */}
      <WorkflowStepper currentStep={1} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="calculator" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="calculator" pageTitle="Load Calculator" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator size={22} className="text-orange-500" />
            {t('calculator.title', 'Load Calculator & Floor Designer')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {project ? `${project.name} — ${project.voltage}V, PF ${project.powerFactor}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Page-Specific Tour Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-procal-calculator-tour'));
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] border border-[var(--border-color,#374151)] hover:border-orange-500/50 text-[var(--foreground-color,#f8fafc)] text-xs font-semibold shadow-xs hover:shadow-sm transition-all shrink-0 cursor-pointer"
            title="Interactive Load Calculator Tour"
          >
            <HelpCircle size={15} className="text-orange-500" />
            {t('cableSchedule.pageTour', 'Page Tour')}
          </button>

          {!isReadOnly && project && project.buildings.some(b => b.floorDesigns.some(fd => fd.items.some(i => i.type === 'APARTMENT'))) && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!project) return;
                  await Promise.all(
                    project.buildings.map((b) =>
                      fetch(`/api/buildings/${b.id}/recalculate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resetSizing: true }),
                      })
                    )
                  );
                  loadProject();
                }}
                className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all duration-200 shadow-sm text-white-force cursor-pointer ${
                  needsRecalculation
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25 animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                <MotionIcon
                  name="RefreshCw"
                  size={14}
                  animation={needsRecalculation ? 'spin' : 'none'}
                  className={`${!needsRecalculation ? 'group-hover:animate-[spin_1s_linear_infinite]' : ''}`}
                />
                {needsRecalculation ? t('calculator.recalculateNeeded', 'Recalculate Needed') : t('calculator.recalculateAllFloors', 'Recalculate All Floors')}
              </button>
              <button
                onClick={async () => {
                  if (!project) return;
                  try {
                    const results = await Promise.all(
                      project.buildings.map((b) =>
                        fetch(`/api/buildings/${b.id}/rebalance`, { method: 'POST' })
                      )
                    );
                    const allOk = results.every((res) => res.ok);
                    if (allOk) {
                      loadProject();
                    } else {
                      alert('Rebalance failed for some buildings');
                      loadProject();
                    }
                  } catch (e) {
                    alert('Network error during rebalance');
                  }
                }}
                className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm shadow-teal-600/20 transition-all text-white-force cursor-pointer"
              >
                <MotionIcon name="ArrowUpDown" size={14} animation="none" className="group-hover:animate-[pulse_1s_ease-in-out_infinite]" />
                {t('calculator.rebalanceAll', 'Rebalance All')}
              </button>
            </div>
          )}
        </div>
      </div>

      {project && bldg && buildingBalance ? (
        <>
      {/* Building Tabs */}
      <div data-tour="calc-buildings" className="flex gap-2 flex-wrap items-center">
        {project.buildings.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBuilding(b.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedBuilding === b.id
                ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/20 text-white-force'
                : 'bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] text-[var(--foreground-color,#9ca3af)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)]'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div data-tour="calc-summary" className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          {
            label: t('common.connectedLoad', 'Connected Load'),
            value: `${totalConnectedKva.toFixed(1)} kVA`,
            sub: `${totalConnectedLoadKw.toFixed(1)} kW`,
            color: 'text-[var(--foreground-color,#f8fafc)]',
            accent: 'border-l-4 border-l-slate-400 dark:border-l-slate-500',
            helper: 'Total installed apparent load (kVA) before demand diversity. Subtext shows active power (kW).'
          },
          {
            label: t('common.maxDemand', 'Max Demand'),
            value: `${totalMaxDemandKva.toFixed(1)} kVA`,
            sub: `${totalMaxDemandKw.toFixed(1)} kW · PF ${calcPf}`,
            color: 'text-orange-600 dark:text-orange-400',
            accent: 'border-l-4 border-l-orange-500',
            helper: 'Maximum apparent load (kVA) after IEC demand factors are applied. Basis for transformer, generator, cable and breaker sizing.'
          },
          {
            label: t('calculator.totalCurrent3Ph', 'Total Current (3Φ)'),
            value: `${totalCurrent3Ph.toFixed(1)} A`,
            sub: `${project.voltage}V 3-Phase`,
            color: 'text-sky-600 dark:text-sky-400',
            accent: 'border-l-4 border-l-sky-500',
            helper: 'Three-phase line current calculated from max demand, system voltage, and power factor. Used to size the main feeder.'
          },
          {
            label: t('calculator.floorsCount', 'Floors'),
            value: `${bldg.floorDesigns.length}`,
            sub: `${sortedFloors.reduce((s, fd) => s + fd.items.length, 0)} circuits`,
            color: 'text-emerald-600 dark:text-emerald-400',
            accent: 'border-l-4 border-l-emerald-500',
            helper: 'Number of floor designs for the selected building. Each floor holds apartments and service loads.'
          },
        ].map(({ label, value, sub, color, accent, helper }) => (
          <div key={label} className={`rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] p-4 shadow-xs hover:shadow-md transition-all ${accent}`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider flex items-center gap-1.5">
                {label}
                <InfoTooltip label={label} helper={helper} />
              </p>
            </div>
            <p className={`text-xl font-bold font-mono tracking-tight mt-1.5 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-[var(--table-header-color,#64748b)] font-mono mt-0.5 font-medium">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Per-Phase Building Summary */}
      <div data-tour="calc-phase-balance" className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            <h3 className="text-sm font-bold text-[var(--foreground-color,#f8fafc)] tracking-tight">
              {t('calculator.perPhaseBalance', 'Per-Phase Balance')} &mdash; {bldg.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {buildingBalance.imbalanced && (
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-md">
                Imbalanced {buildingBalance.unbalancePct.toFixed(1)}% &gt; {buildingBalance.unbalanceLimitPct}%
              </span>
            )}
            {buildingBalance.internalImbalanceNotModeled && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                <AlertTriangle size={12} /> {t('calculator.internalImbalanceWarning', '3φ-apt internal imbalance not modeled')}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          {[
            { label: `L1 (${project.calculationStandard || 'IEC'})`, value: `${buildingBalance.phaseCurrent[0].toFixed(1)} A`, sub: `${buildingBalance.phaseKw[0].toFixed(1)} kW`, color: 'text-orange-600 dark:text-orange-400' },
            { label: 'L2', value: `${buildingBalance.phaseCurrent[1].toFixed(1)} A`, sub: `${buildingBalance.phaseKw[1].toFixed(1)} kW`, color: 'text-orange-600 dark:text-orange-400' },
            { label: 'L3', value: `${buildingBalance.phaseCurrent[2].toFixed(1)} A`, sub: `${buildingBalance.phaseKw[2].toFixed(1)} kW`, color: 'text-orange-600 dark:text-orange-400' },
            { label: t('calculator.neutral', 'Neutral'), value: `${buildingBalance.neutralCurrent.toFixed(1)} A`, sub: buildingBalance.neutralOversized ? t('calculator.over2xMax', 'over 2×max') : t('calculator.ok', 'ok'), color: 'text-amber-600 dark:text-amber-400' },
            { label: t('calculator.unbalance', 'Unbalance'), value: `${buildingBalance.unbalancePct.toFixed(1)}%`, sub: `${t('calculator.limit', 'limit')} ${buildingBalance.unbalanceLimitPct}%`, color: 'text-[var(--foreground-color,#f8fafc)]' },
            { label: t('calculator.totalKw', 'Total Power'), value: `${buildingBalance.totalKw.toFixed(1)} kW`, sub: `max ${buildingBalance.maxPhaseCurrent.toFixed(0)} A`, color: 'text-sky-600 dark:text-sky-400' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border border-[var(--border-color-subtle,var(--border-color,#1f2937))] bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] p-3.5 transition-all hover:border-orange-500/40 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--table-header-color,#64748b)]">{label}</p>
              <p className={`text-base font-bold font-mono mt-1 ${color}`}>{value}</p>
              <p className="text-[11px] font-mono text-[var(--table-header-color,#64748b)] mt-0.5 font-medium">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Building Loads (foldable, read-only) — attached on the Buildings page */}
      {bldg.buildingLoads && bldg.buildingLoads.length > 0 && (
        <div
          data-tour="calc-building-loads"
          className={`rounded-xl border border-[var(--border-color,#1f2937)] hover:border-orange-500/50 bg-[var(--card-bg,#0b0f19)] min-w-0 shadow-xs overflow-hidden transition-all ${
            expandedBuildingLoads ? '' : 'hover:bg-[var(--card-bg-subtle)] cursor-pointer'
          }`}
        >
          <div
            className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
              expandedBuildingLoads ? 'hover:bg-[var(--card-bg-subtle)] rounded-t-xl' : 'rounded-xl'
            }`}
            onClick={() => setExpandedBuildingLoads((v) => !v)}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center text-[var(--table-header-color,#64748b)]">
              {expandedBuildingLoads ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <Wrench size={14} className="text-orange-500" />
            <span className="text-sm text-[var(--foreground-color,#f8fafc)] font-semibold">{t('cableSchedule.buildingLoads', 'Building Loads')}</span>
            <span className="text-xs text-[var(--table-header-color,#64748b)] font-medium">
              {bldg.buildingLoads.length} {t('cableSchedule.circuits', 'items')}
            </span>
            <div className="flex-1" />
            <span className="text-xs font-mono text-[var(--foreground-color,#f8fafc)] font-medium">
              {(
                (bldg.buildingLoads.reduce((s, bl) => s + (bl.loadLibraryItem?.power ?? 0) * bl.quantity, 0)) /
                calcPf
              ).toFixed(1)}{' '}
              kVA{' '}
              <span className="text-[11px] text-[var(--table-header-color,#64748b)] font-normal">
                (
                {bldg.buildingLoads
                  .reduce((s, bl) => s + (bl.loadLibraryItem?.power ?? 0) * bl.quantity, 0)
                  .toFixed(1)}{' '}
                kW)
              </span>
            </span>
          </div>
          {expandedBuildingLoads && (
            <div className="border-t border-[var(--border-color,#1f2937)] p-3.5 space-y-1.5 bg-[var(--card-bg-subtle,rgba(17,24,39,0.4))]">
              {bldg.buildingLoads.map((bl) => (
                <div key={bl.id} className="flex justify-between text-xs text-[var(--foreground-color,#f8fafc)]">
                  <span>
                    {bl.loadLibraryItem?.name ?? '(deleted)'}
                    {bl.loadLibraryItem?.category ? ` — ${bl.loadLibraryItem.category}` : ''}
                  </span>
                  <span className="font-mono font-medium">
                    {bl.quantity} × {(((bl.loadLibraryItem?.power ?? 0) * bl.quantity) / calcPf).toFixed(1)} kVA{' '}
                    <span className="text-[var(--table-header-color,#64748b)] text-[11px]">({((bl.loadLibraryItem?.power ?? 0) * bl.quantity).toFixed(1)} kW)</span>
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-[var(--table-header-color,#64748b)] pt-1">
                {t('calculator.attachBuildingLoadsHint', 'Attach building loads from the Buildings page.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floor List */}
      <div data-tour="calc-floors" className="space-y-2.5">
        {sortedFloors.map((fd) => {
          const expanded = expandedFloor === fd.id;
          const floorConnected = fd.items.reduce((s, i) => s + (i.calculatedConnectedLoad || 0), 0);
          const floorDemand = fd.items.reduce((s, i) => s + (i.calculatedMaxDemand || 0), 0);
          const floorBalance = phaseBalance(fd.items, project, buildingPhaseMap);

          return (
            <div
              key={fd.id}
              className={`rounded-xl border border-[var(--border-color,#1f2937)] hover:border-orange-500/50 bg-[var(--card-bg,#0b0f19)] min-w-0 shadow-xs overflow-hidden transition-all ${
                expanded ? '' : 'hover:bg-[var(--card-bg-subtle)] cursor-pointer'
              }`}
            >
              <div
                className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
                  expanded ? 'hover:bg-[var(--card-bg-subtle)] rounded-t-xl' : 'rounded-xl'
                }`}
                onClick={() => setExpandedFloor(expanded ? null : fd.id)}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center text-[var(--table-header-color,#64748b)]">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                  F{fd.floorNumber}
                </span>
                <Zap size={14} className="text-amber-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--foreground-color,#f8fafc)] font-semibold">
                    {fd.items.length} {t('cableSchedule.circuits', 'items')}
                  </span>
                </div>
                <span className="text-xs font-mono text-[var(--foreground-color,#f8fafc)] font-medium">
                  {(floorConnected / calcPf).toFixed(1)} kVA{' '}
                  <span className="text-[10px] text-[var(--table-header-color,#64748b)] font-normal">({floorConnected.toFixed(1)} kW)</span> /{' '}
                  {(floorDemand / calcPf).toFixed(1)} kVA{' '}
                  <span className="text-[10px] text-[var(--table-header-color,#64748b)] font-normal">({floorDemand.toFixed(1)} kW)</span>{' '}
                  <span className="text-[var(--table-header-color,#64748b)]">{t('riser.demand', 'demand')}</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--table-header-color,#64748b)] hidden sm:inline">
                  L1 {floorBalance.phaseCurrent[0].toFixed(0)}A · L2 {floorBalance.phaseCurrent[1].toFixed(0)}A · L3 {floorBalance.phaseCurrent[2].toFixed(0)}A
                  {floorBalance.neutralCurrent > 0.1 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1 font-semibold">N {floorBalance.neutralCurrent.toFixed(0)}A</span>
                  )}
                  {floorBalance.imbalanced && (
                    <span className="text-rose-600 dark:text-rose-400 ml-1 font-semibold">{t('calculator.unbalance', 'Unbal')} {floorBalance.unbalancePct.toFixed(1)}%</span>
                  )}
                </span>
              </div>

              {expanded && (
                <div className="border-t border-[var(--border-color,#1f2937)] p-4 space-y-3 bg-[var(--card-bg-subtle,rgba(17,24,39,0.4))]">
                  {fd.items.length > 0 && (
                    <table className="w-full engineering-table">
                      <thead>
                        <tr>
                          <th className="text-center">{t('common.type', 'Type')}</th>
                          <th className="text-center">{t('common.name', 'Name')}</th>
                          <th className="text-center">{t('calculator.phase', 'Phase')}</th>
                          <th className="text-center">{t('calculator.assigned', 'Assigned')}</th>
                          <th className="text-center">{t('calculator.loadKw', 'Load (kW)')}</th>
                          <th className="text-center">{t('calculator.demandKw', 'Demand (kW)')}</th>
                          <th className="text-center">{t('cableSchedule.current', 'Current (A)')}</th>
                          <th className="text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fd.items.map((item) => {
                          const Icon = item.type === 'APARTMENT' ? Home : Wrench;
                          // Recalculate current from template's current phases (not stale stored value)
                          const isThreePhase = item.type === 'APARTMENT' && item.apartmentTemplate?.phases === 3;
                          const itemPhaseCount = item.type === 'APARTMENT'
                            ? (item.apartmentTemplate?.phases ?? 1)
                            : (item.loadLibraryItem?.phase ?? (item.type === 'SERVICE_PANEL' || item.type === 'PUMP_PANEL' || item.type === 'ELEVATOR_PANEL' ? 3 : 1));
                          const resolvedPhase = itemPhaseCount === 1
                            ? (item.assignedPhase ?? floorBalance.assignments.find((a) => a.id === item.id)?.assignedPhase ?? null)
                            : null;
                          return (
                            <tr key={item.id} className="hover:bg-[var(--card-bg,#0b0f19)] transition-colors">
                              <td className="text-center">
                                <Icon size={12} className="text-orange-500 inline mr-1" />
                                <span className="text-xs text-[var(--foreground-color,#f8fafc)]">{t(`loadTypes.${item.type}`, item.type.replace('_', ' '))}</span>
                                {item.loadLibraryItem && (
                                  <span className="text-[10px] text-[var(--table-header-color,#64748b)] ml-1">({item.loadLibraryItem.category})</span>
                                )}
                              </td>
                              <td className="text-center text-[var(--foreground-color,#f8fafc)] font-medium text-sm">{item.name}</td>
                              <td className="text-center font-mono text-xs text-[var(--table-header-color,#64748b)] font-semibold">
                                {itemPhaseCount === 3 ? '3Φ' : '1Φ'}
                              </td>
                              <td className="text-center">
                                {itemPhaseCount === 3 ? (
                                  <span className="text-[10px] text-[var(--table-header-color,#64748b)]">—</span>
                                ) : !isReadOnly ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleUpdateAssignedPhase(item.id, null)}
                                      className={`px-2 py-0.5 text-[10px] rounded-md font-mono font-semibold transition-all cursor-pointer ${
                                        item.assignedPhase === null
                                          ? 'bg-amber-600 text-white shadow-xs text-white-force'
                                          : 'bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)]'
                                      }`}
                                      title={t('calculator.autoAssignPhase', 'Auto-assign phase')}
                                    >A</button>
                                    {[1, 2, 3].map((p) => {
                                      const isAutoSelected = item.assignedPhase === null && resolvedPhase === p;
                                      const isManualSelected = item.assignedPhase === p;
                                      return (
                                        <button
                                          key={p}
                                          onClick={() => handleUpdateAssignedPhase(item.id, p)}
                                          className={`px-2 py-0.5 text-[10px] rounded-md font-mono font-semibold transition-all cursor-pointer ${
                                            isAutoSelected
                                              ? 'bg-amber-600 text-white shadow-xs text-white-force'
                                              : isManualSelected
                                              ? 'bg-orange-600 text-white shadow-xs text-white-force'
                                              : 'bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)]'
                                          }`}
                                          title={isAutoSelected ? t('calculator.autoAssignedPhase', `Auto-assigned to L${p}`, { phase: p }) : t('calculator.pinToPhase', `Pin to L${p}`, { phase: p })}
                                        >L{p}</button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] rounded-md font-mono bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] text-amber-500 font-bold">
                                    L{item.assignedPhase ?? resolvedPhase}
                                  </span>
                                )}
                              </td>
                              <td className="text-center font-mono text-sm">
                                <TraceableCell
                                  getTrace={() =>
                                    buildDesignCurrentTrace({
                                      loadName: `${item.name} (Connected)`,
                                      powerKw: item.calculatedConnectedLoad,
                                      powerFactor: project?.powerFactor || 0.85,
                                      voltageV: isThreePhase ? (project?.voltage || 400) : Math.round((project?.voltage || 400) / Math.sqrt(3)),
                                      isThreePhase: isThreePhase || itemPhaseCount === 3,
                                      calculatedCurrentA: item.calculatedCurrent,
                                      calculationStandard: project?.calculationStandard,
                                    })
                                  }
                                >
                                  {item.calculatedConnectedLoad.toFixed(2)}
                                </TraceableCell>
                              </td>
                              <td className="text-center font-mono text-sm text-orange-400">
                                <TraceableCell
                                  getTrace={() =>
                                    buildDesignCurrentTrace({
                                      loadName: `${item.name} (Demand)`,
                                      powerKw: item.calculatedMaxDemand,
                                      powerFactor: project?.powerFactor || 0.85,
                                      voltageV: isThreePhase ? (project?.voltage || 400) : Math.round((project?.voltage || 400) / Math.sqrt(3)),
                                      isThreePhase: isThreePhase || itemPhaseCount === 3,
                                      demandFactor: item.calculatedConnectedLoad > 0 ? item.calculatedMaxDemand / item.calculatedConnectedLoad : 1.0,
                                      calculatedCurrentA: item.calculatedCurrent,
                                      calculationStandard: project?.calculationStandard,
                                    })
                                  }
                                >
                                  {item.calculatedMaxDemand.toFixed(2)}
                                </TraceableCell>
                              </td>
                              <td className="text-center font-mono text-sm">
                                <TraceableCell
                                  getTrace={() =>
                                    buildDesignCurrentTrace({
                                      loadName: item.name,
                                      powerKw: item.calculatedMaxDemand,
                                      powerFactor: project?.powerFactor || 0.85,
                                      voltageV: isThreePhase ? (project?.voltage || 400) : Math.round((project?.voltage || 400) / Math.sqrt(3)),
                                      isThreePhase: isThreePhase || itemPhaseCount === 3,
                                      demandFactor: item.calculatedConnectedLoad > 0 ? item.calculatedMaxDemand / item.calculatedConnectedLoad : 1.0,
                                      calculatedCurrentA: item.calculatedCurrent,
                                      calculationStandard: project?.calculationStandard,
                                    })
                                  }
                                >
                                  {item.calculatedCurrent.toFixed(1)}
                                </TraceableCell>
                              </td>
                              <td className="text-center">
                                {!isReadOnly ? (
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1 rounded text-gray-600 hover:text-red-400"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                ) : (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Add Item Button / Form */}
                  {showAddItem === fd.id ? (
                    <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] p-4 space-y-3.5 shadow-md">
                      <p className="text-xs text-[var(--table-header-color,#64748b)] font-medium">
                        Add an apartment from a template, or add a service/pump/elevator load from the library or as a custom kW value.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-36 shrink-0">
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">
                            Type
                            <InfoTooltip
                              label="Item Type"
                              helper="Apartment uses an apartment template with IEC demand factors. Service/Pump/Elevator panels can be picked from the load library or entered as a custom kW."
                            />
                          </label>
                          <select
                            value={addForm.type}
                            onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                            className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                          >
                            <option value="APARTMENT">Apartment</option>
                            <option value="SERVICE_PANEL">Service Panel</option>
                            <option value="PUMP_PANEL">Pump Panel</option>
                            <option value="ELEVATOR_PANEL">Elevator Panel</option>
                          </select>
                        </div>
                        {addForm.type === 'APARTMENT' ? (
                          <>
                            {(!project.apartmentTemplates || project.apartmentTemplates.length === 0) ? (
                              <div className="flex-1 min-w-[280px] p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-orange-600 dark:text-orange-300">No Apartment Templates Found</p>
                                    <p className="text-[11px] text-[var(--table-header-color,#64748b)] mt-0.5 font-medium">
                                      This project does not have any apartment templates yet. Generate standard templates (2BR, 3BR, Studio) to quickly start adding apartments.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isSeedingDefaults || isReadOnly}
                                    onClick={handleSeedDefaults}
                                    className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold text-xs whitespace-nowrap shadow-sm text-white-force transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                                  >
                                    {isSeedingDefaults ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-3.5 h-3.5" />
                                    )}
                                    Generate Default Templates
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-[200px]">
                                  <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">
                                    {t('calculator.template', 'Template')}
                                    <InfoTooltip
                                      label={t('apartment.template', 'Apartment Template')}
                                      helper={t('calculator.templateHelper', 'Choose a saved apartment template. Its connected load and max demand are calculated from room areas, load densities, and AC units.')}
                                    />
                                  </label>
                                  <select
                                    value={addForm.apartmentTemplateId}
                                    onChange={(e) => {
                                      const tpl = project.apartmentTemplates.find((t) => t.id === e.target.value);
                                      setAddForm({
                                        ...addForm,
                                        apartmentTemplateId: e.target.value,
                                        name: tpl?.name || '',
                                      });
                                    }}
                                    className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                                  >
                                    <option value="">{t('calculator.selectTemplate', 'Select template…')}</option>
                                    {project.apartmentTemplates.map((t) => {
                                      const totalArea = t.rooms?.reduce((sum, r) => sum + r.area, 0) || 0;
                                      const totalLoad = t.rooms?.reduce((sum, r) => sum + r.connectedLoad, 0) || 0;
                                      return (
                                        <option key={t.id} value={t.id}>
                                          {t.name} — {t.phases === 3 ? '3Φ' : '1Φ'} — {totalArea.toFixed(0)}m² ({(totalLoad / 1000).toFixed(1)}kVA)
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="w-56 shrink-0">
                                  <label className="block text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">{t('calculator.nameLabel', 'Name / Label')}</label>
                                  <input
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                                    placeholder="e.g. Apt 101"
                                  />
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-[200px]">
                              <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">
                                {t('calculator.source', 'Source')}
                                <InfoTooltip
                                  label={t('calculator.loadSource', 'Load Source')}
                                  helper={t('calculator.loadSourceHelper', 'Pick a predefined load from the library, or choose Custom kW to enter a one-off power value for a service panel, pump, or elevator.')}
                                />
                              </label>
                              <select
                                value={addForm.loadLibraryItemId || '_custom'}
                                onChange={(e) => {
                                  if (e.target.value === '_custom') {
                                    setAddForm({ ...addForm, loadLibraryItemId: '', name: '' });
                                  } else {
                                    const lib = project.loadLibraryItems.find((l) => l.id === e.target.value);
                                    setAddForm({
                                      ...addForm,
                                      loadLibraryItemId: e.target.value,
                                      name: lib?.name || '',
                                    });
                                  }
                                }}
                                className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                              >
                                <option value="_custom">{t('calculator.customKwOption', 'Custom kW…')}</option>
                                {project.loadLibraryItems.length > 0 && (
                                  <optgroup label={t('calculator.fromLibrary', 'From Library')}>
                                    {project.loadLibraryItems.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.name} — {l.power}kW ({l.category})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">{t('calculator.nameLabel', 'Name / Label')}</label>
                              <input
                                value={addForm.name}
                                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                                placeholder="e.g. Service Board"
                              />
                            </div>
                            {!addForm.loadLibraryItemId && (
                              <div className="w-28 shrink-0">
                                <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider mb-1.5">
                                  {t('calculator.powerKw', 'Power (kW)')}
                                  <InfoTooltip
                                    label={t('calculator.customPower', 'Custom Power')}
                                    helper={t('calculator.customPowerHelper', 'Enter the installed active power in kilowatts. The calculator applies power factor and demand factor to calculate the demand and current.')}
                                  />
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={addForm.customKw}
                                  onChange={(e) => setAddForm({ ...addForm, customKw: e.target.value })}
                                  className="dense-input w-full rounded-lg border border-[var(--border-color,#374151)] bg-[var(--input-bg,#1f2937)] text-xs py-2 text-[var(--input-color,#f8fafc)] shadow-xs"
                                />
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex items-center gap-2 shrink-0 pb-0.5">
                          <button
                            onClick={() => handleAddItem(fd.id)}
                            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs shadow-orange-600/20 transition-all text-white-force cursor-pointer"
                          >
                            {t('common.add', 'Add')}
                          </button>
                          <button
                            onClick={() => setShowAddItem(null)}
                            className="px-3.5 py-2 rounded-lg bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] hover:bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] text-[var(--foreground-color,#f8fafc)] text-xs font-semibold transition-all cursor-pointer"
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                        </div>
                      </div>

                      {/* Room Breakdown Preview (Separate full-width row below controls) */}
                      {addForm.type === 'APARTMENT' && addForm.apartmentTemplateId && (() => {
                        const selectedTpl = project.apartmentTemplates.find(
                          (t) => t.id === addForm.apartmentTemplateId
                        );
                        if (!selectedTpl?.rooms?.length) return null;

                        const totalArea = selectedTpl.rooms.reduce((sum, r) => sum + r.area, 0);
                        const totalLoad = selectedTpl.rooms.reduce((sum, r) => sum + r.connectedLoad, 0);
                        const acRooms = selectedTpl.rooms.filter((r) => r.hasAc);

                        return (
                          <div className="mt-3 p-3 rounded-lg bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] border border-[var(--border-color,#1f2937)]">
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="font-semibold text-[var(--foreground-color,#f8fafc)]">
                                {t('calculator.roomsSummary', `${selectedTpl.rooms.length} rooms · ${totalArea.toFixed(0)}m²`, {
                                  count: selectedTpl.rooms.length,
                                  area: totalArea.toFixed(0),
                                })}
                              </span>
                              <span className="text-orange-600 dark:text-orange-400 font-mono font-bold">
                                {(totalLoad / 1000).toFixed(2)} kVA
                              </span>
                              {acRooms.length > 0 && (
                                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-[11px] font-medium">
                                  {acRooms.length}× AC
                                </span>
                              )}
                              <span className="text-[var(--table-header-color,#64748b)] text-xs border-l border-[var(--border-color,#1f2937)] pl-3 font-medium">
                                {selectedTpl.rooms.map((r) => r.name).filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : !isReadOnly ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowAddItem(fd.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs shadow-orange-600/25 transition-all text-white-force cursor-pointer"
                      >
                        <Plus size={13} className="text-white text-white-force" />
                        {t('calculator.addItem', 'Add Item')}
                      </button>
                      {fd.items.some(i => i.type === 'APARTMENT') && (
                        <button
                          onClick={() => handleRecalculate(fd.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--card-bg,#0b0f19)] hover:bg-[var(--card-bg-subtle)] border border-[var(--border-color,#1f2937)] hover:border-blue-500/50 text-xs text-[var(--foreground-color,#f8fafc)] font-medium shadow-xs transition-all cursor-pointer"
                        >
                          <RefreshCw size={12} className="text-blue-500" />
                          {t('calculator.recalculate', 'Recalculate')}
                        </button>
                      )}
                      {fd.items.length > 0 && (
                        <button
                          onClick={() => handleRebalanceFloor(fd.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--card-bg,#0b0f19)] hover:bg-[var(--card-bg-subtle)] border border-[var(--border-color,#1f2937)] hover:border-teal-500/50 text-xs text-[var(--foreground-color,#f8fafc)] font-medium shadow-xs transition-all cursor-pointer"
                        >
                          <ArrowUpDown size={12} className="text-teal-500" />
                          {t('calculator.rebalance', 'Re-balance')}
                        </button>
                      )}
                      {fd.items.length > 0 && bldg.floorDesigns.length > 1 && (
                        <button
                          onClick={() => {
                            setCopySourceFloor(fd.id);
                            setCopyTargetFloors([]);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--card-bg,#0b0f19)] hover:bg-[var(--card-bg-subtle)] border border-[var(--border-color,#1f2937)] hover:border-sky-500/50 text-xs text-[var(--foreground-color,#f8fafc)] font-medium shadow-xs transition-all cursor-pointer"
                        >
                          <Copy size={12} className="text-sky-500" />
                          {t('calculator.copyToFloors', 'Copy to Floors')}
                        </button>
                      )}
                    </div>
                  ) : null}

                  {/* Copy Dialog */}
                  {copySourceFloor === fd.id && (
                    <div className="rounded-xl border border-blue-500/30 bg-[var(--card-bg,#0b0f19)] p-4 space-y-3.5 w-full shadow-md">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[var(--foreground-color,#f8fafc)]">
                          {fd.items.length === 1
                            ? t('calculator.copyItemsPrompt', `Copy ${fd.items.length} item from F${fd.floorNumber} to:`, { count: fd.items.length, floor: fd.floorNumber })
                            : t('calculator.copyItemsPrompt_plural', `Copy ${fd.items.length} items from F${fd.floorNumber} to:`, { count: fd.items.length, floor: fd.floorNumber })}
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const otherIds = bldg.floorDesigns.filter((other) => other.id !== fd.id).map((other) => other.id);
                              setCopyTargetFloors(copyTargetFloors.length === otherIds.length ? [] : otherIds);
                            }}
                            className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
                          >
                            {copyTargetFloors.length === bldg.floorDesigns.filter((other) => other.id !== fd.id).length
                              ? t('calculator.deselectAll', 'Deselect All')
                              : t('calculator.selectAll', 'Select All')}
                          </button>
                          <button onClick={() => setCopySourceFloor(null)} className="text-xs text-[var(--table-header-color,#64748b)] hover:text-[var(--foreground-color)] font-medium cursor-pointer">
                            {t('common.cancel', 'Cancel')}
                          </button>
                        </div>
                      </div>
                      <div className="leading-8">
                        {bldg.floorDesigns
                          .filter((other) => other.id !== fd.id)
                          .sort((a, b) => a.floorNumber - b.floorNumber)
                          .map((other, i) => {
                            const checked = copyTargetFloors.includes(other.id);
                            const pastelColors = [
                              { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600 dark:text-sky-400', checkedBg: 'bg-sky-500/25 border-sky-500' },
                              { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', checkedBg: 'bg-emerald-500/25 border-emerald-500' },
                              { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-600 dark:text-violet-400', checkedBg: 'bg-violet-500/25 border-violet-500' },
                              { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', checkedBg: 'bg-rose-500/25 border-rose-500' },
                              { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', checkedBg: 'bg-amber-500/25 border-amber-500' },
                              { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-600 dark:text-cyan-400', checkedBg: 'bg-cyan-500/25 border-cyan-500' },
                            ];
                            const c = pastelColors[i % pastelColors.length];
                            return (
                              <label
                                key={other.id}
                                className={`inline-flex items-center gap-1.5 m-1 px-4 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all select-none ${
                                  checked
                                    ? `${c.checkedBg} ${c.text}`
                                    : `${c.bg} ${c.border} ${c.text} opacity-60 hover:opacity-100`
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setCopyTargetFloors(
                                      e.target.checked
                                        ? [...copyTargetFloors, other.id]
                                        : copyTargetFloors.filter((id) => id !== other.id)
                                    );
                                  }}
                                  className="w-3.5 h-3.5 accent-current"
                                />
                                F{other.floorNumber}
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-[var(--border-color,#1f2937)]">
                        <button
                          onClick={handleCopyToFloors}
                          disabled={copyTargetFloors.length === 0 || copying}
                          className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs text-white-force disabled:opacity-50 cursor-pointer"
                        >
                          {copying
                            ? t('calculator.copying', 'Copying…')
                            : t('calculator.copyToCountFloors', `Copy to ${copyTargetFloors.length} floors`, { count: copyTargetFloors.length })}
                        </button>
                        <button
                          onClick={() => setCopySourceFloor(null)}
                          className="px-4 py-2 rounded-lg bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
        </>
      ) : project ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <Building2 size={40} className="text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">
            No buildings in this project. Add buildings from the project settings.
          </p>
        </div>
      ) : (loading || contextLoading || selectedProjectId) ? (
        <PageSkeleton titleWidth="w-64" rowCount={8} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <Building2 size={40} className="text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">Select a project first.</p>
        </div>
      )}
    </div>
  );
}
