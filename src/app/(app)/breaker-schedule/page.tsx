'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  CircuitBoard,
  Filter,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Activity,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { computeFeeders, createFindBreaker, type EquipmentItem, type DefaultFamilies } from '@/lib/calculations/feeders';
import TccPlotModal from '@/components/coordination/TccPlotModal';
import type { Project, PanelFeeder, BreakerAlternativeSuggestion } from '@/types';

interface BreakerFamilyOption {
  id: string;
  manufacturer: string;
  category: string;
  name: string;
}

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
  manufacturer: string | null;
  familyName: string | null;
  fallback: boolean;
  isThreePhase: boolean;
  parentFeederName?: string | null;
  faultCurrentKa?: number;
  selectivityStatus?: 'FULL' | 'PARTIAL' | 'NONE' | null;
  selectivityLimitA?: number | null;
  cableDamageOk?: boolean;
  selectivityReason?: string | null;
  suggestedAlternative?: string | null;
  alternativeSuggestions?: BreakerAlternativeSuggestion[];
  itemId?: string;
  floorDesignId?: string;
  buildingLoadId?: string;
}

export default function BreakerSchedulePage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer, refreshProject } = useProject();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [families, setFamilies] = useState<BreakerFamilyOption[]>([]);
  const [breakerSettings, setBreakerSettings] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedFeederForModal, setSelectedFeederForModal] = useState<BreakerEntry | null>(null);
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<DefaultFamilies>(() => ({
    ACB: selectedProject?.defaultAcbFamilyId ?? undefined,
    MCCB: selectedProject?.defaultMccbFamilyId ?? undefined,
    MCB: selectedProject?.defaultMcbFamilyId ?? undefined,
  }));

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      setDefaults({
        ACB: selectedProject.defaultAcbFamilyId ?? undefined,
        MCCB: selectedProject.defaultMccbFamilyId ?? undefined,
        MCB: selectedProject.defaultMcbFamilyId ?? undefined,
      });
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    setLoading(true);
    try {
      await refreshProject();
      const res = await fetch(`/api/projects/${selectedProjectId}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setDefaults({
          ACB: data.defaultAcbFamilyId ?? undefined,
          MCCB: data.defaultMccbFamilyId ?? undefined,
          MCB: data.defaultMcbFamilyId ?? undefined,
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId, refreshProject]);

  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipment?category=ACB,MCCB,MCB`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  const loadFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/breaker-families');
      if (res.ok) {
        const data = await res.json();
        setFamilies(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  const loadBreakerSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/breaker-settings?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setBreakerSettings(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);
  useEffect(() => { loadEquipment(); }, [loadEquipment]);
  useEffect(() => { loadFamilies(); }, [loadFamilies]);
  useEffect(() => { loadBreakerSettings(); }, [loadBreakerSettings]);

  const saveDefaults = useCallback(async (next: DefaultFamilies) => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultAcbFamilyId: next.ACB ?? null,
          defaultMccbFamilyId: next.MCCB ?? null,
          defaultMcbFamilyId: next.MCB ?? null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject((prev) => (prev ? { ...prev, ...updated } : prev));
        setDefaults(next);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [project]);

  const handleFamilyChange = (category: keyof DefaultFamilies, familyId: string) => {
    const next = { ...defaults, [category]: familyId || undefined };
    setDefaults(next);
    saveDefaults(next);
  };

  if (loading || (!project && (contextLoading || selectedProjectId))) {
    return <PageSkeleton titleWidth="w-60" rowCount={6} />;
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CircuitBoard size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  const findBreaker = createFindBreaker(equipment, defaults, preferredManufacturer);

  const breakers: BreakerEntry[] = [];
  for (const bldg of project.buildings) {
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders } = computeFeeders(bldg, project, findBreaker);

    const feederFloor = (feederName: string): number => {
      const m = feederName.match(/^F(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const findSavedBreakerSetting = (f: PanelFeeder) =>
      breakerSettings.find(
        (s) =>
          s.breakerId === `${project.id}-${f.name}` ||
          s.breakerId === f.name ||
          (f.itemId && s.breakerId === f.itemId)
      );

    for (const f of mdbFeeders) {
      const saved = findSavedBreakerSetting(f);
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
        breakerModel: saved?.model || f.breakerModel,
        manufacturer: f.manufacturer,
        familyName: f.familyName,
        fallback: f.fallback,
        isThreePhase: f.isThreePhase,
        parentFeederName: f.parentFeederName,
        faultCurrentKa: f.faultCurrentKa,
        selectivityStatus: saved ? 'FULL' : f.selectivityStatus,
        selectivityLimitA: f.selectivityLimitA,
        cableDamageOk: f.cableDamageOk,
        selectivityReason: saved ? `Full electronic LSI selectivity (${saved.model})` : f.selectivityReason,
        suggestedAlternative: saved ? null : f.suggestedAlternative,
        alternativeSuggestions: saved ? [] : f.alternativeSuggestions,
        itemId: f.itemId,
        floorDesignId: f.floorDesignId,
        buildingLoadId: f.buildingLoadId,
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        const saved = findSavedBreakerSetting(f);
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
          breakerModel: saved?.model || f.breakerModel,
          manufacturer: f.manufacturer,
          familyName: f.familyName,
          fallback: f.fallback,
          isThreePhase: f.isThreePhase,
          parentFeederName: f.parentFeederName,
          faultCurrentKa: f.faultCurrentKa,
          selectivityStatus: saved ? 'FULL' : f.selectivityStatus,
          selectivityLimitA: f.selectivityLimitA,
          cableDamageOk: f.cableDamageOk,
          selectivityReason: saved ? `Full electronic LSI selectivity (${saved.model})` : f.selectivityReason,
          suggestedAlternative: saved ? null : f.suggestedAlternative,
          alternativeSuggestions: saved ? [] : f.alternativeSuggestions,
          itemId: f.itemId,
          floorDesignId: f.floorDesignId,
          buildingLoadId: f.buildingLoadId,
        });
      }
    }
  }

  const filteredBreakers = selectedBuilding === 'all'
    ? breakers
    : breakers.filter((b) => b.buildingId === selectedBuilding);

  const grouped = filteredBreakers.reduce((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {} as Record<string, BreakerEntry[]>);

  const familyOptionsFor = (category: string) =>
    families
      .filter((f) => f.category === category)
      .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name));

  const handleApplySuggestion = async (sug: BreakerAlternativeSuggestion) => {
    if (!project || !selectedFeederForModal) return;
    setApplyingSuggestionId(sug.id);

    try {
      const bldg = project.buildings.find((b) => b.id === selectedFeederForModal.buildingId) || project.buildings[0];

      if (sug.type === 'UPSTREAM_UPGRADE') {
        const floorMatch = selectedFeederForModal.parentFeederName?.match(/F(\d+)/i);
        const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : null;
        let floorDesignId = selectedFeederForModal.floorDesignId;
        if (floorNum && bldg) {
          const fd = (bldg.floorDesigns ?? []).find((f) => f.floorNumber === floorNum);
          if (fd) floorDesignId = fd.id;
        }
        
        if (floorDesignId && selectedFeederForModal.parentFeederName?.includes('SMDB')) {
          await fetch(`/api/floors/${floorDesignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riserBreakerSize: `${sug.suggestedFrameSize}A` }),
          });
        } else {
          // Save to BreakerSettings for Main Incomer
          await fetch('/api/breaker-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              breakerId: `${project.id}-main-incomer`,
              model: sug.suggestedModel || 'Main Incomer ACB',
              manufacturer: selectedFeederForModal.manufacturer || 'Schneider',
              frameSize: `${sug.suggestedFrameSize}A`,
              ir: selectedFeederForModal.current * 1.6,
              tr: 12,
              isd: (sug.suggestedFrameSize || 630) * 4,
              tsd: 0.3,
              ii: (sug.suggestedFrameSize || 630) * 10,
            }),
          });
        }
      } else if (sug.type === 'DIRECT_MDB_FEED') {
        let floorDesignId = selectedFeederForModal.floorDesignId;
        if (!floorDesignId && bldg) {
          const floorMatch = selectedFeederForModal.parentFeederName?.match(/F(\d+)/i) || selectedFeederForModal.name.match(/F(\d+)/i);
          const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : selectedFeederForModal.floor;
          const fd = (bldg.floorDesigns ?? []).find((f) => f.floorNumber === floorNum);
          floorDesignId = fd?.id;
        }
        if (floorDesignId) {
          await fetch(`/api/floors/${floorDesignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hasFloorSubPanels: false }),
          });
        }
      } else if (sug.type === 'DOWNSTREAM_RESIZE') {
        let itemId = selectedFeederForModal.itemId;
        if (!itemId && bldg) {
          for (const fd of bldg.floorDesigns ?? []) {
            for (const it of fd.items ?? []) {
              if (
                `F${fd.floorNumber} – ${it.name}` === selectedFeederForModal.name ||
                `F${fd.floorNumber} - ${it.name}` === selectedFeederForModal.name ||
                it.name === selectedFeederForModal.name
              ) {
                itemId = it.id;
                break;
              }
            }
            if (itemId) break;
          }
        }
        if (itemId) {
          await fetch(`/api/floor-items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ breakerSize: `${sug.suggestedFrameSize}A` }),
          });
        }
      } else if (sug.type === 'SETTINGS_ADJUSTMENT' || sug.type === 'ELECTRONIC_TRIP_UNIT') {
        const stableBreakerId = `${project.id}-${selectedFeederForModal.name}`;
        await fetch('/api/breaker-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            breakerId: stableBreakerId,
            model: sug.suggestedModel || selectedFeederForModal.breakerModel,
            manufacturer: selectedFeederForModal.manufacturer || 'Schneider',
            frameSize: `${selectedFeederForModal.breakerSize}A`,
            ir: selectedFeederForModal.current,
            tr: 12,
            isd: sug.suggestedSettings?.isd ?? selectedFeederForModal.breakerSize * 4,
            tsd: sug.suggestedSettings?.tsd ?? 0.05,
            ii: sug.suggestedSettings?.ii ?? selectedFeederForModal.breakerSize * 8,
          }),
        });
        await loadBreakerSettings();
      }

      // Re-fetch project to update database state and re-compute feeders
      await refreshProject();
      const res = await fetch(`/api/projects/${project.id}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
      }
      setSelectedFeederForModal(null);
    } catch (err) {
      console.error('Error applying suggestion:', err);
    } finally {
      setApplyingSuggestionId(null);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div data-tour="breaker-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CircuitBoard size={22} className="text-orange-500" />
            {t('breakerSchedule.title', 'Breaker Schedule')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} &mdash; {t('breakerSchedule.subtitle', 'Protection hierarchy, trip curves, and selectivity')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Page Tour Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-procal-breaker-schedule-tour'));
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 hover:border-orange-500/50 text-xs font-semibold shadow-sm transition-all shrink-0"
            title="Interactive Breaker Schedule Tour"
          >
            <HelpCircle size={15} className="text-orange-400" />
            {t('cableSchedule.pageTour', 'Page Tour')}
          </button>
          <button
            onClick={loadProject}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 text-sm"
            title="Reload project data and recalculate schedule"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('cableSchedule.recalculateAll', 'Recalculate')}
          </button>
        </div>
      </div>

      {/* Default Breaker Families */}
      <div data-tour="breaker-family-select" className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <h2 className="text-sm font-bold text-orange-400 mb-3 uppercase tracking-wide">{t('breakers.subtitle', 'Default Breaker Families')}</h2>
        <div className="space-y-4">
          {[
            { key: 'ACB' as const, label: t('panel.incomer', 'Main Incomer'), description: 'ACB / main breaker / transformer secondary' },
            { key: 'MCCB' as const, label: t('panel.outgoingFeeders', 'Feeders & Sub-panels'), description: 'MCCB — mechanical loads, SMDB feeders, risers' },
            { key: 'MCB' as const, label: t('breakers.deviceTag', 'Final Distribution'), description: 'MCB — apartments, small shops, lighting' },
          ].map(({ key, label, description }) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pb-4 border-b border-gray-800 last:border-0 last:pb-0">
              <div className="sm:w-64">
                <strong className="text-gray-200 text-sm block">{label}</strong>
                <small className="text-gray-500">{description}</small>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">{t('breakers.series', 'Family / Series')}</label>
                <select
                  value={defaults[key] ?? ''}
                  onChange={(e) => handleFamilyChange(key, e.target.value)}
                  disabled={saving}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:border-orange-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Use preferred manufacturer fallback</option>
                  {familyOptionsFor(key).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.manufacturer} — {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
            {t('cableSchedule.allBuildings', 'All Buildings')}
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
      <div data-tour="breaker-table" className="space-y-4">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-orange-400">{type.replace('_', ' ')}</h3>
            <span className="text-xs text-gray-500 font-mono">{items.length} breakers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full engineering-table text-xs">
              <thead>
                <tr>
                  <th className="text-start">{t('cableSchedule.load', 'Feeder')}</th>
                  <th className="text-start">Upstream Parent</th>
                  <th className="text-center">{t('calculator.floor', 'Floor')}</th>
                  <th className="text-end">{t('cableSchedule.current', 'Current (A)')}</th>
                  <th className="text-center">{t('breakers.frameSize', 'Breaker (A)')}</th>
                  <th className="text-start">{t('breakerSchedule.title', 'Breaker Model')}</th>
                  <th className="text-center">{t('cableSchedule.size', 'Cable (mm²)')}</th>
                  <th className="text-end">Isc (kA)</th>
                  <th className="text-center">Selectivity</th>
                  <th className="text-center">Cable Protection</th>
                  <th className="text-center">TCC Plot</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-800/30">
                    <td className="text-gray-200 font-semibold">{b.name}</td>
                    <td className="text-gray-400 text-xs font-mono">{b.parentFeederName ?? 'Main Incomer'}</td>
                    <td className="text-center font-mono text-orange-400">F{b.floor}</td>
                    <td className="text-end font-mono">{b.current.toFixed(1)}</td>
                    <td className="text-center font-mono text-blue-400 font-bold">{b.breakerSize}A</td>
                    <td className="text-xs text-gray-300">
                      <span className="flex items-center gap-1">
                        {b.breakerModel}
                        {b.fallback && (
                          <span title={`No ${b.familyName ?? 'selected'} model ≥ ${b.current.toFixed(1)}A; used fallback.`}>
                            <AlertTriangle size={12} className="text-yellow-500" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="text-center font-mono text-green-400">{b.cableSize}</td>
                    <td className="text-end font-mono text-gray-300">
                      {b.faultCurrentKa ? b.faultCurrentKa.toFixed(2) : '—'}
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {b.selectivityStatus === 'FULL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                            <CheckCircle2 size={11} /> FULL
                          </span>
                        ) : b.selectivityStatus === 'PARTIAL' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            title={`Selective up to ${b.selectivityLimitA ? `${b.selectivityLimitA} kA` : 'limited current'}`}
                          >
                            <AlertTriangle size={11} /> PARTIAL {b.selectivityLimitA ? `(${b.selectivityLimitA}k)` : ''}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"
                            title={b.selectivityReason ?? 'Selectivity violated'}
                          >
                            <XCircle size={11} /> NONE
                          </span>
                        )}
                        {b.suggestedAlternative && (
                          <button
                            onClick={() => setSelectedFeederForModal(b)}
                            className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30 transition-all font-medium group"
                            title="Click to view full coordination plot and alternative sizing recommendation"
                          >
                            <Sparkles size={10} className="text-orange-400 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[130px]">{b.suggestedAlternative}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      {b.cableDamageOk !== false ? (
                        <span className="text-green-400 font-semibold text-[11px]" title="Cable thermal withstand exceeds breaker clearing time">
                          ✓ Safe
                        </span>
                      ) : (
                        <span className="text-red-400 font-semibold text-[11px]" title="Breaker curve intersects cable damage curve under fault current">
                          ✗ Unprotected
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setSelectedFeederForModal(b)}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-orange-600/20 text-gray-400 hover:text-orange-400 border border-gray-700 hover:border-orange-500/30 transition-colors"
                        title="View TCC Curve & Coordination Plot"
                      >
                        <Activity size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      </div>

      {filteredBreakers.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
          <p className="text-gray-500 text-sm">{t('nav.noProjects', 'No breakers to display for this selection.')}</p>
        </div>
      )}

      {/* Summary */}
      <div className="text-[10px] text-gray-600 flex justify-between items-center">
        <p>{t('cableSchedule.totalCables', 'Total breakers')}: {filteredBreakers.length}</p>
        <p className="flex items-center gap-2">
          <ShieldCheck size={12} className="text-orange-500" />
          <span>Protection hierarchy: IEC 60947-2 / IEC 60898-1 / IEC 60364-5-54</span>
        </p>
      </div>

      {/* TCC Plot Modal */}
      {selectedFeederForModal && (() => {
        const upstreamFeederForModal = selectedFeederForModal.parentFeederName
          ? breakers.find(
              (b) =>
                b.name === selectedFeederForModal.parentFeederName &&
                b.buildingId === selectedFeederForModal.buildingId
            )
          : null;

        const downstreamCategory: 'ACB' | 'MCCB' | 'MCB' =
          selectedFeederForModal.breakerSize >= 630
            ? 'ACB'
            : selectedFeederForModal.breakerSize > 63 ||
              selectedFeederForModal.type === 'SMDB' ||
              selectedFeederForModal.type === 'SERVICE_PANEL' ||
              selectedFeederForModal.type === 'PUMP_PANEL' ||
              selectedFeederForModal.type === 'ELEVATOR_PANEL'
            ? 'MCCB'
            : 'MCB';

        return (
          <TccPlotModal
            isOpen={true}
            onClose={() => setSelectedFeederForModal(null)}
            feederName={selectedFeederForModal.name}
            upstreamFeederName={selectedFeederForModal.parentFeederName ?? null}
            upstreamBreakerModel={upstreamFeederForModal?.breakerModel}
            upstreamBreakerSize={upstreamFeederForModal?.breakerSize}
            upstreamCurrent={upstreamFeederForModal?.current}
            downstreamBreakerModel={selectedFeederForModal.breakerModel}
            downstreamBreakerSize={selectedFeederForModal.breakerSize}
            downstreamCurrent={selectedFeederForModal.current}
            downstreamCableSize={selectedFeederForModal.cableSize}
            downstreamCategory={downstreamCategory}
            faultCurrentKa={selectedFeederForModal.faultCurrentKa}
            selectivityStatus={selectedFeederForModal.selectivityStatus}
            selectivityLimitA={selectedFeederForModal.selectivityLimitA}
            cableDamageOk={selectedFeederForModal.cableDamageOk}
            selectivityReason={selectedFeederForModal.selectivityReason}
            alternativeSuggestions={selectedFeederForModal.alternativeSuggestions}
            onApplySuggestion={handleApplySuggestion}
            applyingId={applyingSuggestionId}
          />
        );
      })()}
    </div>
  );
}

