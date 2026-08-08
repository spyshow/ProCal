'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CircuitBoard, Filter, AlertTriangle, RefreshCw, HelpCircle } from 'lucide-react';
import { computeFeeders, createFindBreaker, type EquipmentItem, type DefaultFamilies } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

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
}

export default function BreakerSchedulePage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer } = useProject();
  const { t, isRtl } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [families, setFamilies] = useState<BreakerFamilyOption[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
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
    if (selectedProject?.id === selectedProjectId) {
      setProject(selectedProject);
      setDefaults({
        ACB: selectedProject.defaultAcbFamilyId ?? undefined,
        MCCB: selectedProject.defaultMccbFamilyId ?? undefined,
        MCB: selectedProject.defaultMcbFamilyId ?? undefined,
      });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
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
  }, [selectedProjectId, selectedProject]);

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

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);
  useEffect(() => { loadEquipment(); }, [loadEquipment]);
  useEffect(() => { loadFamilies(); }, [loadFamilies]);

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
        manufacturer: f.manufacturer,
        familyName: f.familyName,
        fallback: f.fallback,
        isThreePhase: f.isThreePhase,
      });
    }

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
          manufacturer: f.manufacturer,
          familyName: f.familyName,
          fallback: f.fallback,
          isThreePhase: f.isThreePhase,
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

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div data-tour="breaker-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CircuitBoard size={22} className="text-orange-500" />
            {t('breakerSchedule.title', 'Breaker Schedule')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} &mdash; {t('breakerSchedule.subtitle', 'Default breaker families and protection sizing')}</p>
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
          <h3 className="text-sm font-bold text-orange-400 mb-3">{type.replace('_', ' ')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full engineering-table text-xs">
              <thead>
                <tr>
                  <th className="text-start">{t('cableSchedule.load', 'Feeder')}</th>
                  <th className="text-start">{t('calculator.building', 'Building')}</th>
                  <th className="text-center">{t('calculator.floor', 'Floor')}</th>
                  <th className="text-end">{t('cableSchedule.current', 'Current (A)')}</th>
                  <th className="text-center">{t('breakers.frameSize', 'Breaker (A)')}</th>
                  <th className="text-center">{t('breakers.manufacturer', 'Manufacturer')}</th>
                  <th className="text-center">{t('breakers.series', 'Family')}</th>
                  <th className="text-start">{t('breakerSchedule.title', 'Breaker Model')}</th>
                  <th className="text-center">{t('cableSchedule.size', 'Cable (mm²)')}</th>
                  <th className="text-center">{t('calculator.rebalance', 'Phase')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-800/30">
                    <td className="text-gray-200 font-semibold">{b.name}</td>
                    <td className="text-gray-400">{b.buildingName}</td>
                    <td className="text-center font-mono text-orange-400">F{b.floor}</td>
                    <td className="text-end font-mono">{b.current.toFixed(1)}</td>
                    <td className="text-center font-mono text-blue-400">{b.breakerSize}</td>
                    <td className="text-center text-gray-300">{b.manufacturer ?? '—'}</td>
                    <td className="text-center text-gray-300">{b.familyName ?? '—'}</td>
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
                    <td className="text-center font-mono">{b.isThreePhase ? '3Φ' : '1Φ'}</td>
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
      <div className="text-[10px] text-gray-600">
        <p>{t('cableSchedule.totalCables', 'Total breakers')}: {filteredBreakers.length}</p>
      </div>
    </div>
  );
}
