'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { usePathname, useRouter } from 'next/navigation';
import { recalculateCable } from '@/lib/sld/cable-editor';
import MethodSelector from '@/components/MethodSelector';
import { Cable, RefreshCw, AlertTriangle, Check, Settings, Save } from 'lucide-react';
import type { Project } from '@/types';

interface CableEntry {
  id: string;
  name: string;
  cableName: string;
  floor: number;
  length: number;
  cableSize: number;
  current: number;
  isThreePhase: boolean;
  newCableSize: number | null;
  newVD: number | null;
  changed: boolean;
  method: string;
  insulation: 'PVC' | 'XLPE';
  ampacity: number;
}

export default function CableSchedulePage() {
  const { selectedProjectId } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [cables, setCables] = useState<CableEntry[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [defaultMethod, setDefaultMethod] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('procal-default-method') || 'C';
    return 'C';
  });
  const [defaultInsulation, setDefaultInsulation] = useState<'PVC' | 'XLPE'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('procal-default-insulation') as 'PVC' | 'XLPE') || 'XLPE';
    return 'XLPE';
  });
  const [showNavDialog, setShowNavDialog] = useState(false);
  const pendingNavigation = useRef<string | null>(null);

  // Derive unsaved changes from cables state
  const hasUnsavedChanges = cables.some(c => c.changed);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept sidebar/navigation clicks
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href]');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && href !== pathname && !href.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        pendingNavigation.current = href;
        setShowNavDialog(true);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, pathname]);

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
  }, [selectedProjectId, selectedBuilding]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    if (!project) return;

    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    // Build cable schedule from project data with pre-calculated VD
    const cableList: CableEntry[] = [];
    for (const bldg of project.buildings) {
      for (const fd of bldg.floorDesigns) {
        fd.items.forEach((item, idx) => {
          const letter = String.fromCharCode(97 + idx);
          const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
          const cableTag = `Wf${fd.floorNumber}${letter}`;
          const cableSizeNum = parseFloat(item.cableSize) || 4;
          const isThreePhase = item.type !== 'APARTMENT' || (item as any).apartmentTemplate?.phases === 3;
          const length = (item as any).cableLength || 10 + (fd.floorNumber - 1) * 5;
          const method = (item as any).installMethod || 'C';
          const insulation = (item as any).cableInsulation || 'XLPE';

          const result = recalculateCable({
            current: item.calculatedCurrent,
            isThreePhase,
            lengthMeters: length,
            existingCableSize: cableSizeNum,
            powerFactor: project.powerFactor || 0.85,
            systemVoltage: project.voltage === 400 ? 400 : 230,
            maxVoltageDropPercent: limits.power,
            method,
            insulation,
          });

          cableList.push({
            id: item.id || `${fd.floorNumber}-${item.name}`,
            name: loadTag,
            cableName: cableTag,
            floor: fd.floorNumber,
            length,
            cableSize: cableSizeNum,
            current: item.calculatedCurrent,
            isThreePhase,
            newCableSize: result.cableSize,
            newVD: result.voltageDropPercent,
            changed: result.changed,
            method,
            insulation,
            ampacity: result.ampacity,
          });
        });
      }
    }
    setCables(cableList);
  }, [project]);

  const updateCableField = (id: string, field: string, value: any) => {
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    setCables(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };

      const result = recalculateCable({
        current: c.current,
        isThreePhase: c.isThreePhase,
        lengthMeters: field === 'length' ? value : c.length,
        existingCableSize: c.cableSize,
        powerFactor: project?.powerFactor || 0.85,
        systemVoltage: project?.voltage === 400 ? 400 : 230,
        maxVoltageDropPercent: limits.power,
        method: field === 'method' ? value : c.method,
        insulation: field === 'insulation' ? value : c.insulation,
      });

      // Persist to database (fire and forget)
      const payload: any = {};
      if (field === 'length') payload.cableLength = value;
      if (field === 'method') payload.installMethod = value;
      if (field === 'insulation') payload.cableInsulation = value;
      console.log('Saving to DB:', id, payload);
      fetch(`/api/floor-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => res.json()).then(data => console.log('Saved:', data)).catch(err => console.error('Failed to save:', err));

      return {
        ...updated,
        length: field === 'length' ? value : c.length,
        method: field === 'method' ? value : c.method,
        insulation: field === 'insulation' ? value : c.insulation,
        newCableSize: result.cableSize,
        newVD: result.voltageDropPercent,
        changed: result.changed,
        ampacity: result.ampacity,
      };
    }));
  };

  const recalculateAll = () => {
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    setCables(prev => prev.map(c => {
      const result = recalculateCable({
        current: c.current,
        isThreePhase: c.isThreePhase,
        lengthMeters: c.length,
        existingCableSize: c.cableSize,
        powerFactor: project?.powerFactor || 0.85,
        systemVoltage: project?.voltage === 400 ? 400 : 230,
        maxVoltageDropPercent: limits.power,
        method: c.method,
        insulation: c.insulation,
      });
      return {
        ...c,
        newCableSize: result.cableSize,
        newVD: result.voltageDropPercent,
        changed: result.changed,
        ampacity: result.ampacity,
      };
    }));
  };

  const applyChanges = async () => {
    setSaving(true);
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };
    const changedCables = cables.filter(c => c.changed && c.newCableSize !== null);

    try {
      await Promise.all(changedCables.map(c =>
        fetch(`/api/floor-items/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cableSize: `${c.newCableSize}` }),
        })
      ));

      // Update local state: apply new cable size and recalculate VD with it
      setCables(prev => prev.map(c => {
        if (c.changed && c.newCableSize !== null) {
          const result = recalculateCable({
            current: c.current,
            isThreePhase: c.isThreePhase,
            lengthMeters: c.length,
            existingCableSize: c.newCableSize,
            powerFactor: project?.powerFactor || 0.85,
            systemVoltage: project?.voltage === 400 ? 400 : 230,
            maxVoltageDropPercent: limits.power,
            method: c.method,
            insulation: c.insulation,
          });
          return {
            ...c,
            cableSize: c.newCableSize,
            newCableSize: result.cableSize,
            newVD: result.voltageDropPercent,
            changed: result.changed,
            ampacity: result.ampacity,
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to apply changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setShowNavDialog(false);
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
      pendingNavigation.current = null;
    }
  };

  const handleSaveAndNavigate = async () => {
    await applyChanges();
    setShowNavDialog(false);
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
      pendingNavigation.current = null;
    }
  };

  const applyDefaults = async () => {
    setApplyingDefaults(true);
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    try {
      // Save all cables to database first
      await Promise.all(cables.map(c =>
        fetch(`/api/floor-items/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installMethod: defaultMethod, cableInsulation: defaultInsulation }),
        })
      ));

      // Then update local state
      setCables(prev => prev.map(c => {
        const result = recalculateCable({
          current: c.current,
          isThreePhase: c.isThreePhase,
          lengthMeters: c.length,
          existingCableSize: c.cableSize,
          powerFactor: project?.powerFactor || 0.85,
          systemVoltage: project?.voltage === 400 ? 400 : 230,
          maxVoltageDropPercent: limits.power,
          method: defaultMethod,
          insulation: defaultInsulation,
        });
        return {
          ...c,
          method: defaultMethod,
          insulation: defaultInsulation,
          newCableSize: result.cableSize,
          newVD: result.voltageDropPercent,
          changed: result.changed,
          ampacity: result.ampacity,
        };
      }));
    } finally {
      setApplyingDefaults(false);
    }
  };

  // Check if there are cables that need upsize
  const cablesNeedingUpsize = cables.filter(c => c.changed);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Select a project first.</p></div>;

  // Group cables by floor
  const cablesByFloor = cables.reduce((acc, cable) => {
    if (!acc[cable.floor]) acc[cable.floor] = [];
    acc[cable.floor].push(cable);
    return acc;
  }, {} as Record<number, CableEntry[]>);

  const floors = Object.keys(cablesByFloor).map(Number).sort((a, b) => a - b);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Unsaved Changes Banner */}
      {cablesNeedingUpsize.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-yellow-400" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">
                {cablesNeedingUpsize.length} cable{cablesNeedingUpsize.length > 1 ? 's' : ''} need{cablesNeedingUpsize.length === 1 ? 's' : ''} upsize
              </p>
              <p className="text-xs text-yellow-400/70">
                Click "Apply" to save the new cable sizes to the database
              </p>
            </div>
          </div>
          <button
            onClick={applyChanges}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cable size={22} className="text-orange-500" />
            Cable Schedule
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} — Cable lengths & voltage drop calculator</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold ${showSettings ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Settings size={14} />
            Settings
          </button>
          <button onClick={recalculateAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
            <RefreshCw size={14} />
            Recalculate All
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-xl border border-orange-500/30 bg-gray-900/60 p-4 space-y-4">
          <h3 className="text-sm font-bold text-orange-400">Cable Schedule Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Installation Method</label>
              <MethodSelector
                value={defaultMethod}
                onChange={(m) => {
                  setDefaultMethod(m);
                  localStorage.setItem('procal-default-method', m);
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Insulation</label>
              <select
                value={defaultInsulation}
                onChange={(e) => {
                  const v = e.target.value as 'PVC' | 'XLPE';
                  setDefaultInsulation(v);
                  localStorage.setItem('procal-default-insulation', v);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="XLPE">XLPE (90°C)</option>
                <option value="PVC">PVC (70°C)</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => applyDefaults()}
            disabled={applyingDefaults}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {applyingDefaults ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              'Apply to All Cables'
            )}
          </button>
        </div>
      )}

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2">
          {project.buildings.map((b) => (
            <button key={b.id} onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Cables</p>
          <p className="text-2xl font-bold text-white">{cables.length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Length</p>
          <p className="text-2xl font-bold text-white">{cables.reduce((sum, c) => sum + c.length, 0).toFixed(0)}m</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Need Upsize</p>
          <p className="text-2xl font-bold text-yellow-400">{cables.filter(c => c.changed).length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Compliant</p>
          <p className="text-2xl font-bold text-green-400">
            {cables.filter(c => c.newVD !== null && !c.changed).length}/{cables.filter(c => c.newVD !== null).length || '—'}
          </p>
        </div>
      </div>

      {/* Cable Schedule Table - Grouped by Floor */}
      <div className="space-y-4">
        {floors.map(floor => (
          <div key={floor} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-orange-400">Floor {floor}</span>
              <span className="text-xs text-gray-500">({cablesByFloor[floor].length} circuits)</span>
            </div>

            <div className="relative">
              <div className="overflow-x-auto">
              <table className="w-full engineering-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Load</th>
                    <th className="text-left">Cable</th>
                    <th className="text-right">Current (A)</th>
                    <th className="text-center">Size (mm²)</th>
                    <th className="text-center">Method</th>
                    <th className="text-center">Insulation</th>
                    <th className="text-center">Ampacity (A)</th>
                    <th className="text-right" style={{ width: '100px' }}>Length (m)</th>
                    <th className="text-center">New Cable</th>
                    <th className="text-center">VD (%)</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cablesByFloor[floor].map((c) => (
                    <tr key={c.id} className="hover:bg-gray-800/30">
                      <td className="text-gray-200 font-mono font-semibold">{c.name}</td>
                      <td className="text-gray-400 font-mono text-xs">{c.cableName}</td>
                      <td className="text-right font-mono">{c.current.toFixed(1)}</td>
                      <td className="text-center font-mono text-green-400">{c.cableSize} mm²</td>
                      <td className="text-center">
                        <MethodSelector
                          value={c.method}
                          onChange={(method) => updateCableField(c.id, 'method', method)}
                        />
                      </td>
                      <td className="text-center">
                        <select
                          value={c.insulation}
                          onChange={(e) => updateCableField(c.id, 'insulation', e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-white w-16"
                        >
                          <option value="XLPE">XLPE</option>
                          <option value="PVC">PVC</option>
                        </select>
                      </td>
                      <td className="text-center font-mono text-blue-400">{c.ampacity}A</td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={c.length}
                          onChange={(e) => updateCableField(c.id, 'length', parseFloat(e.target.value) || (10 + (c.floor - 1) * 5))}
                          className="dense-input w-20 rounded text-right text-xs"
                          min="1"
                        />
                      </td>
                      <td className={`text-center font-mono ${c.changed ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>
                        {c.newCableSize !== null ? `${c.newCableSize} mm²` : '—'}
                      </td>
                      <td className={`text-center font-mono ${c.newVD !== null && c.newVD > 5 ? 'text-red-400' : c.newVD !== null && c.newVD > 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {c.newVD !== null ? `${c.newVD.toFixed(2)}%` : '—'}
                      </td>
                      <td className="text-center">
                        {c.changed ? (
                          <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold">
                            <AlertTriangle size={12} /> UP
                          </span>
                        ) : c.newVD !== null ? (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <Check size={12} /> OK
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="text-[10px] text-gray-600 space-y-1">
        <p>Edit cable lengths, method, and insulation — values save automatically. Click "Recalculate All" to refresh.</p>
        <p><span className="text-blue-400">Method:</span> B1/B2 = in conduit, C = clipped directly, E = spaced, F = on tray, G = on ladder</p>
        <p><span className="text-blue-400">Insulation:</span> XLPE rated 90°C, PVC rated 70°C. XLPE allows higher ampacity.</p>
        <p>IEC 60364-5-52 limits: 3% lighting, 5% power. <span className="text-yellow-400">UP</span> = cable upsized to meet VD limit.</p>
      </div>

      {/* Unsaved Changes Dialog */}
      {showNavDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-96 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Unsaved Changes</h3>
                <p className="text-sm text-gray-400">You have cable upsizes that haven't been applied.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              Do you want to save the new cable sizes before leaving?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAndNavigate}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save & Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
