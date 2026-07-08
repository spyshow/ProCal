'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
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
} from 'lucide-react';
import type { FloorItem, FloorDesign, Building, Project } from '@/types';

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
  const { selectedProjectId } = useProject();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(focusFloorId || null);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    type: 'APARTMENT',
    name: '',
    apartmentTemplateId: '',
    loadLibraryItemId: '',
    customKw: '15',
  });

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) {
          setSelectedBuilding(data.buildings[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedBuilding]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleAddItem = async (floorDesignId: string) => {
    await fetch(`/api/floors/${floorDesignId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setAddForm({ type: 'APARTMENT', name: '', apartmentTemplateId: '', loadLibraryItemId: '', customKw: '15' });
    setShowAddItem(null);
    loadProject();
  };

  const handleDeleteItem = async (itemId: string) => {
    await fetch(`/api/floor-items/${itemId}`, { method: 'DELETE' });
    loadProject();
  };

  const handleRecalculate = async (floorDesignId: string) => {
    await fetch(`/api/floors/${floorDesignId}/recalculate`, { method: 'POST' });
    loadProject();
  };

  // Copy to floors
  const [copySourceFloor, setCopySourceFloor] = useState<string | null>(null);
  const [copyTargetFloors, setCopyTargetFloors] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const handleCopyToFloors = async () => {
    if (!copySourceFloor || copyTargetFloors.length === 0) return;
    setCopying(true);

    const sourceFloor = bldg.floorDesigns.find((fd) => fd.id === copySourceFloor);
    if (!sourceFloor || sourceFloor.items.length === 0) {
      setCopying(false);
      setCopySourceFloor(null);
      return;
    }

    for (const targetFloorId of copyTargetFloors) {
      for (const item of sourceFloor.items) {
        await fetch(`/api/floors/${targetFloorId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: item.type,
            name: item.name,
            apartmentTemplateId: item.apartmentTemplateId || undefined,
            loadLibraryItemId: item.loadLibraryItemId || undefined,
            customKw: item.type !== 'APARTMENT' ? String(item.calculatedConnectedLoad) : undefined,
          }),
        });
      }
    }

    setCopySourceFloor(null);
    setCopyTargetFloors([]);
    setCopying(false);
    loadProject();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Building2 size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">
          {project ? 'No buildings in this project. Add buildings from the project settings.' : 'Select a project first.'}
        </p>
      </div>
    );
  }

  const bldg = project.buildings.find((b) => b.id === selectedBuilding) || project.buildings[0];
  const sortedFloors = [...bldg.floorDesigns].sort((a, b) => b.floorNumber - a.floorNumber);

  // Summary totals
  const totalConnectedLoad = sortedFloors.reduce(
    (sum, fd) => sum + fd.items.reduce((s, i) => s + i.calculatedConnectedLoad, 0),
    0
  );
  const totalMaxDemand = sortedFloors.reduce(
    (sum, fd) => sum + fd.items.reduce((s, i) => s + i.calculatedMaxDemand, 0),
    0
  );
  const totalCurrent3Ph = totalMaxDemand / (Math.sqrt(3) * (project.voltage / 1000) * project.powerFactor);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator size={22} className="text-orange-500" />
            Load Calculator &amp; Floor Designer
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {project.name} — {project.voltage}V, PF {project.powerFactor}
          </p>
        </div>
        {bldg.floorDesigns.some(fd => fd.items.some(i => i.type === 'APARTMENT')) && (
          <button
            onClick={async () => {
              await fetch(`/api/buildings/${bldg.id}/recalculate`, { method: 'POST' });
              loadProject();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
          >
            <RefreshCw size={14} />
            Recalculate All Floors
          </button>
        )}
      </div>

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2">
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => { setSelectedBuilding(b.id); setExpandedFloor(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedBuilding === b.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Connected', value: `${totalConnectedLoad.toFixed(1)} kW`, color: 'text-gray-200' },
          { label: 'Max Demand', value: `${totalMaxDemand.toFixed(1)} kW`, color: 'text-orange-400' },
          { label: 'Total Current (3Φ)', value: `${totalCurrent3Ph.toFixed(1)} A`, color: 'text-blue-400' },
          { label: 'Floors', value: `${bldg.floorDesigns.length}`, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Floor List */}
      <div className="space-y-2">
        {sortedFloors.map((fd) => {
          const expanded = expandedFloor === fd.id;
          const floorDemand = fd.items.reduce((s, i) => s + i.calculatedMaxDemand, 0);
          const floorCurrent = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);

          return (
            <div key={fd.id} className="rounded-xl border border-gray-800 bg-gray-900/40 min-w-0">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
                onClick={() => setExpandedFloor(expanded ? null : fd.id)}
              >
                {expanded ? (
                  <ChevronDown size={14} className="text-gray-500" />
                ) : (
                  <ChevronRight size={14} className="text-gray-500" />
                )}
                <span className="text-xs font-mono text-orange-400 w-12 font-bold">F{fd.floorNumber}</span>
                <Zap size={14} className="text-gray-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-300 font-medium">
                    {fd.items.length} item{fd.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs font-mono text-gray-500">
                  {floorDemand.toFixed(1)} kW / {floorCurrent.toFixed(1)} A
                </span>
              </div>

              {expanded && (
                <div className="border-t border-gray-800 p-3 space-y-2 bg-gray-950/30">
                  {fd.items.length > 0 && (
                    <table className="w-full engineering-table">
                      <thead>
                        <tr>
                          <th className="text-left">Type</th>
                          <th className="text-left">Name</th>
                          <th className="text-center">Phase</th>
                          <th className="text-right">Load (kW)</th>
                          <th className="text-right">Demand (kW)</th>
                          <th className="text-right">Per-Phase (kW)</th>
                          <th className="text-right">Per-Phase Current (A)</th>
                          <th className="text-center">Breaker</th>
                          <th className="text-center">Cable</th>
                          <th className="text-center">VDrop</th>
                          <th className="text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fd.items.map((item) => {
                          const Icon = item.type === 'APARTMENT' ? Home : Wrench;
                          // Recalculate current from template's current phases (not stale stored value)
                          const isThreePhase = item.type === 'APARTMENT' && item.apartmentTemplate?.phases === 3;
                          const displayCurrent = item.type === 'APARTMENT'
                            ? (isThreePhase
                                ? item.calculatedMaxDemand / (Math.sqrt(3) * 0.4)
                                : item.calculatedMaxDemand / 0.23)
                            : item.calculatedCurrent;
                          const displayPerPhaseLoad = isThreePhase
                            ? item.calculatedMaxDemand / 3
                            : item.calculatedMaxDemand;
                          return (
                            <tr key={item.id} className="hover:bg-gray-800/30">
                              <td>
                                <Icon size={12} className="text-gray-500 inline mr-1" />
                                <span className="text-xs text-gray-400">{item.type.replace('_', ' ')}</span>
                                {item.loadLibraryItem && (
                                  <span className="text-[10px] text-gray-600 ml-1">({item.loadLibraryItem.category})</span>
                                )}
                              </td>
                              <td className="text-gray-200 text-sm">{item.name}</td>
                              <td className="text-center font-mono text-xs text-gray-400">
                                {item.type === 'APARTMENT' ? (isThreePhase ? '3Φ' : '1Φ') : '3Φ'}
                              </td>
                              <td className="text-right font-mono text-sm">{item.calculatedConnectedLoad.toFixed(2)}</td>
                              <td className="text-right font-mono text-sm text-orange-400">{item.calculatedMaxDemand.toFixed(2)}</td>
                              <td className="text-right font-mono text-sm text-blue-400">{displayPerPhaseLoad.toFixed(2)}</td>
                              <td className="text-right font-mono text-sm">{displayCurrent.toFixed(1)}</td>
                              <td className="text-center font-mono text-sm text-blue-400">{item.breakerSize}</td>
                              <td className="text-center font-mono text-sm text-green-400">{item.cableSize}</td>
                              <td className="text-center font-mono text-xs text-gray-500">
                                {item.voltageDrop != null ? `${item.voltageDrop}%` : '—'}
                              </td>
                              <td className="text-center">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 rounded text-gray-600 hover:text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Add Item Button / Form */}
                  {showAddItem === fd.id ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-2">
                      <div className="flex gap-2 items-end">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Type</label>
                          <select
                            value={addForm.type}
                            onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                            className="dense-input rounded"
                          >
                            <option value="APARTMENT">Apartment</option>
                            <option value="SERVICE_PANEL">Service Panel</option>
                            <option value="PUMP_PANEL">Pump Panel</option>
                            <option value="ELEVATOR_PANEL">Elevator Panel</option>
                          </select>
                        </div>
                        {addForm.type === 'APARTMENT' ? (
                          <>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Template</label>
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
                                className="dense-input w-full rounded"
                              >
                                <option value="">Select template…</option>
                                {project.apartmentTemplates.map((t) => {
                                  const totalArea = t.rooms?.reduce((sum, r) => sum + r.area, 0) || 0;
                                  const totalLoad = t.rooms?.reduce((sum, r) => sum + r.connectedLoad, 0) || 0;
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.name} — {t.phases === 3 ? '3Φ' : '1Φ'} — {totalArea.toFixed(0)}m² ({(totalLoad / 1000).toFixed(1)}kW)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Name</label>
                              <input
                                value={addForm.name}
                                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                className="dense-input w-full rounded"
                                placeholder="Apt 1"
                              />
                            </div>

                            {/* Room Breakdown Preview */}
                            {addForm.apartmentTemplateId && (() => {
                              const selectedTpl = project.apartmentTemplates.find(
                                (t) => t.id === addForm.apartmentTemplateId
                              );
                              if (!selectedTpl?.rooms?.length) return null;

                              const totalArea = selectedTpl.rooms.reduce((sum, r) => sum + r.area, 0);
                              const totalLoad = selectedTpl.rooms.reduce((sum, r) => sum + r.connectedLoad, 0);
                              const acRooms = selectedTpl.rooms.filter((r) => r.hasAc);

                              return (
                                <div className="col-span-2 mt-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                                  <div className="flex items-center gap-4 text-[10px]">
                                    <span className="text-gray-500">
                                      {selectedTpl.rooms.length} rooms · {totalArea.toFixed(0)}m²
                                    </span>
                                    <span className="text-orange-400 font-mono">
                                      {(totalLoad / 1000).toFixed(2)} kW
                                    </span>
                                    {acRooms.length > 0 && (
                                      <span className="text-blue-400">
                                        {acRooms.length}× AC
                                      </span>
                                    )}
                                    <span className="text-gray-600">
                                      {selectedTpl.rooms.map((r) => r.name).filter(Boolean).join(' · ')}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Source</label>
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
                                className="dense-input w-full rounded"
                              >
                                <option value="_custom">Custom kW…</option>
                                {project.loadLibraryItems.length > 0 && (
                                  <optgroup label="From Library">
                                    {project.loadLibraryItems.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.name} — {l.power}kW ({l.category})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Name</label>
                              <input
                                value={addForm.name}
                                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                className="dense-input w-full rounded"
                                placeholder="Service Board"
                              />
                            </div>
                            {!addForm.loadLibraryItemId && (
                              <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Power (kW)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={addForm.customKw}
                                  onChange={(e) => setAddForm({ ...addForm, customKw: e.target.value })}
                                  className="dense-input w-20 rounded"
                                />
                              </div>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleAddItem(fd.id)}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddItem(null)}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAddItem(fd.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-orange-400 transition-colors"
                      >
                        <Plus size={12} />
                        Add Item
                      </button>
                      {fd.items.some(i => i.type === 'APARTMENT') && (
                        <button
                          onClick={() => handleRecalculate(fd.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <RefreshCw size={12} />
                          Recalculate
                        </button>
                      )}
                      {fd.items.length > 0 && bldg.floorDesigns.length > 1 && (
                        <button
                          onClick={() => {
                            setCopySourceFloor(fd.id);
                            setCopyTargetFloors([]);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <Copy size={12} />
                          Copy to Floors
                        </button>
                      )}
                    </div>
                  )}

                  {/* Copy Dialog */}
                  {copySourceFloor === fd.id && (
                    <div className="rounded-lg border border-blue-500/30 bg-gray-800/50 p-3 space-y-3 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-gray-400">Copy {fd.items.length} item{fd.items.length !== 1 ? 's' : ''} from F{fd.floorNumber} to:</h4>
                        <button onClick={() => setCopySourceFloor(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                      </div>
                      <div className="leading-8">
                        {bldg.floorDesigns
                          .filter((other) => other.id !== fd.id)
                          .sort((a, b) => a.floorNumber - b.floorNumber)
                          .map((other, i) => {
                            const checked = copyTargetFloors.includes(other.id);
                            const pastelColors = [
                              { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-700', checkedBg: 'bg-sky-200' },
                              { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', checkedBg: 'bg-emerald-200' },
                              { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700', checkedBg: 'bg-violet-200' },
                              { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700', checkedBg: 'bg-rose-200' },
                              { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', checkedBg: 'bg-amber-200' },
                              { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', checkedBg: 'bg-cyan-200' },
                            ];
                            const c = pastelColors[i % pastelColors.length];
                            return (
                              <label
                                key={other.id}
                                className={`inline-flex items-center gap-1.5 m-1 px-4 py-2 rounded-full border text-xs font-medium cursor-pointer transition-all select-none ${
                                  checked
                                    ? `${c.checkedBg} ${c.border} ${c.text}`
                                    : `${c.bg} ${c.border} ${c.text} opacity-50`
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
                      <div className="flex gap-2 pt-1 border-t border-gray-700/50">
                        <button
                          onClick={handleCopyToFloors}
                          disabled={copyTargetFloors.length === 0 || copying}
                          className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {copying ? 'Copying…' : `Copy to ${copyTargetFloors.length} floor${copyTargetFloors.length !== 1 ? 's' : ''}`}
                        </button>
                        <button
                          onClick={() => setCopySourceFloor(null)}
                          className="px-4 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs"
                        >
                          Cancel
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
    </div>
  );
}
