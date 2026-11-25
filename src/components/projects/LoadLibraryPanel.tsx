'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Plus, Pencil, Trash2, Zap, Sparkles, RefreshCw } from 'lucide-react';

export interface LoadLibraryPanelProps {
  projectId: string;
  onRefresh: () => void;
  loads: any[];
  isReadOnly?: boolean;
}

export function LoadLibraryPanel({ projectId, onRefresh, loads, isReadOnly = false }: LoadLibraryPanelProps) {
  const { t } = useTranslation();
  const [showNew, setShowNew] = useState(false);
  const [isSeedingLoads, setIsSeedingLoads] = useState(false);

  const handleSeedLoads = async () => {
    setIsSeedingLoads(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/seed-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'loads' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate default service loads');
        return;
      }
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSeedingLoads(false);
    }
  };

  const [form, setForm] = useState({
    name: '',
    category: 'Lighting',
    power: '',
    voltage: '230',
    phase: '1',
    powerFactor: '0.85',
    demandFactor: '1.0',
    quantity: '1',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    await fetch('/api/loads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId }),
    });
    setForm({ name: '', category: 'Lighting', power: '', voltage: '230', phase: '1', powerFactor: '0.85', demandFactor: '1.0', quantity: '1', notes: '' });
    setShowNew(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Delete this load item?')) return;
    await fetch(`/api/loads/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Lighting',
    power: '',
    voltage: '230',
    phase: '1',
    powerFactor: '0.85',
    demandFactor: '1.0',
    quantity: '1',
    notes: '',
  });

  const startEdit = (item: any) => {
    if (isReadOnly) return;
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      power: String(item.power),
      voltage: String(item.voltage),
      phase: String(item.phase),
      powerFactor: String(item.powerFactor),
      demandFactor: String(item.demandFactor),
      quantity: String(item.quantity),
      notes: item.notes || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingId) return;
    const res = await fetch(`/api/loads/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      alert('Failed to update load item');
      return;
    }
    setEditingId(null);
    onRefresh();
  };

  return (
    <>
      {!isReadOnly && (
        <div className="flex justify-end items-center gap-2">
          {loads.length === 0 && (
            <button
              type="button"
              disabled={isSeedingLoads}
              onClick={handleSeedLoads}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSeedingLoads ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              )}
              {t('projects.loadDefaultLoads', 'Load Default Service Loads')}
            </button>
          )}
          <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer">
            <Plus size={14} />
            Add Load
          </button>
        </div>
      )}

      {showNew && !isReadOnly && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
          <h4 className="text-sm font-semibold text-[var(--foreground-color)]">New Load Item</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-[var(--table-header-color)] mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="dense-input w-full rounded">
                {['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Motor', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1">Power (kW) *</label>
              <input type="number" step="0.01" min="0.01" value={form.power} onChange={(e) => setForm({ ...form, power: e.target.value })} required className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1">Phase</label>
              <select
                value={form.phase}
                onChange={(e) => {
                  const p = e.target.value;
                  setForm({ ...form, phase: p, voltage: p === '3' ? '400' : '230' });
                }}
                className="dense-input w-full rounded"
              >
                <option value="1">1-Phase</option>
                <option value="3">3-Phase</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1" title="Power Factor (cos φ)">PF</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="1.0"
                value={form.powerFactor}
                onChange={(e) => setForm({ ...form, powerFactor: e.target.value })}
                className="dense-input w-full rounded"
                placeholder="0.85"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1" title="Demand Factor (0.05 - 1.0)">DF</label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1.0"
                value={form.demandFactor}
                onChange={(e) => setForm({ ...form, demandFactor: e.target.value })}
                className="dense-input w-full rounded"
                placeholder="1.0"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--table-header-color)] mb-1">Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="dense-input w-full rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer">Add</button>
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] text-[var(--foreground-color)] border border-[var(--border-color)] text-sm cursor-pointer transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {loads.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm rounded-xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col items-center justify-center gap-3">
          <Zap className="w-10 h-10 text-gray-600" />
          <div>
            <p className="font-semibold text-gray-200">No service loads yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Add custom service loads or populate standard library equipment (Elevators, Water Pumps, Fire Pumps, Lighting, HVAC).
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                disabled={isSeedingLoads}
                onClick={handleSeedLoads}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                {isSeedingLoads ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {t('projects.loadDefaultLoads', 'Load Default Service Loads')}
              </button>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Custom Load
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
          <table className="w-full engineering-table text-center">
            <thead className="bg-[var(--table-header-bg)] text-[var(--table-header-color)] border-b border-[var(--border-color)]">
              <tr>
                <th className="text-center">Name</th>
                <th className="text-center">Category</th>
                <th className="text-center">Power (kW)</th>
                <th className="text-center">Phase</th>
                <th className="text-center" title="Power Factor (cos φ)">PF</th>
                <th className="text-center" title="Demand Factor (Operating/Duty Ratio)">DF</th>
                <th className="text-center">Qty</th>
                <th className="text-center">Running I (A)</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((item: any) => (
                editingId === item.id && !isReadOnly ? (
                  <tr key={item.id} className="bg-[var(--card-bg-subtle)] border-y border-[var(--border-color)]">
                    <td colSpan={9} className="p-3 text-center">
                      <form onSubmit={handleUpdate} className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1">Name *</label>
                            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="dense-input w-full rounded text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1">Category</label>
                            <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="dense-input w-full rounded text-xs">
                              {['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Motor', 'Other'].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1">Power (kW) *</label>
                            <input type="number" step="0.01" min="0.01" value={editForm.power} onChange={(e) => setEditForm({ ...editForm, power: e.target.value })} required className="dense-input w-full rounded text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1">Phase</label>
                            <select
                              value={editForm.phase}
                              onChange={(e) => {
                                const p = e.target.value;
                                setEditForm({ ...editForm, phase: p, voltage: p === '3' ? '400' : '230' });
                              }}
                              className="dense-input w-full rounded text-xs"
                            >
                              <option value="1">1-Phase</option>
                              <option value="3">3-Phase</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1" title="Power Factor (cos φ)">PF</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.1"
                              max="1.0"
                              value={editForm.powerFactor}
                              onChange={(e) => setEditForm({ ...editForm, powerFactor: e.target.value })}
                              className="dense-input w-full rounded text-xs"
                              placeholder="0.85"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1" title="Demand Factor (0.05 - 1.0)">DF</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="1.0"
                              value={editForm.demandFactor}
                              onChange={(e) => setEditForm({ ...editForm, demandFactor: e.target.value })}
                              className="dense-input w-full rounded text-xs"
                              placeholder="1.0"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--table-header-color)] mb-1">Quantity</label>
                            <input type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="dense-input w-full rounded text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-center">
                          <button type="submit" className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-[var(--card-bg-subtle)] hover:bg-[var(--card-bg)] text-[var(--foreground-color)] border border-[var(--border-color)] text-xs">Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-[var(--card-bg-subtle)] transition-colors">
                    <td className="font-medium text-[var(--foreground-color)] text-center">{item.name}</td>
                    <td className="text-center text-xs text-[var(--table-header-color)]">{item.category}</td>
                    <td className="text-center font-mono text-[var(--foreground-color)]">{item.power}</td>
                    <td className="text-center font-mono text-[var(--foreground-color)]">{item.phase}Φ</td>
                    <td className="text-center font-mono text-[var(--foreground-color)]">{item.powerFactor}</td>
                    <td className="text-center font-mono text-[var(--foreground-color)]">{item.demandFactor}</td>
                    <td className="text-center font-mono text-[var(--foreground-color)]">{item.quantity}</td>
                    <td className="text-center font-mono text-orange-600 dark:text-orange-400 font-semibold">{item.runningCurrent}A</td>
                    <td className="text-center">
                      {!isReadOnly ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(item)} className="p-1 rounded text-[var(--table-header-color)] hover:text-orange-500 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 rounded text-[var(--table-header-color)] hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[var(--table-header-color)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
