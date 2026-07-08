'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface LoadItem {
  id: string;
  name: string;
  category: string;
  power: number;
  voltage: number;
  phase: number;
  powerFactor: number;
  demandFactor: number;
  quantity: number;
  runningCurrent: number;
  startingCurrent: number | null;
  notes: string | null;
}

interface LoadManagerProps {
  projectId: string;
  loads: LoadItem[];
  onRefresh: () => void;
}

const CATEGORIES = ['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Fire Pump', 'Mechanical', 'Other'];

export default function LoadManager({ projectId, loads, onRefresh }: LoadManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LoadItem | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'Lighting', power: 0, voltage: 230, phase: 1,
    powerFactor: 0.85, demandFactor: 1.0, quantity: 1, startingCurrent: '', notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', category: 'Lighting', power: 0, voltage: 230, phase: 1,
      powerFactor: 0.85, demandFactor: 1.0, quantity: 1, startingCurrent: '', notes: '' });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/loads/${editing.id}` : '/api/loads';
    const method = editing ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId }),
    });
    resetForm();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this load item?')) return;
    await fetch(`/api/loads/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (l: LoadItem) => {
    setEditing(l);
    setForm({
      name: l.name, category: l.category, power: l.power, voltage: l.voltage,
      phase: l.phase, powerFactor: l.powerFactor, demandFactor: l.demandFactor,
      quantity: l.quantity, startingCurrent: l.startingCurrent?.toString() || '',
      notes: l.notes || '',
    });
    setShowForm(true);
  };

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent';
  const labelClass = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Load Library</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Load
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg border border-gray-700 bg-gray-800/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. corridor lights" required />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Power (kW)</label>
              <input value={form.power || ''} onChange={(e) => setForm({ ...form, power: parseFloat(e.target.value) || 0 })} type="number" step="0.1" className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Voltage (V)</label>
              <select value={form.voltage} onChange={(e) => setForm({ ...form, voltage: parseInt(e.target.value) })} className={inputClass}>
                <option value={230}>230V (1-phase)</option>
                <option value={400}>400V (3-phase)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Phase</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: parseInt(e.target.value) })} className={inputClass}>
                <option value={1}>1-Phase</option>
                <option value={3}>3-Phase</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>PF</label>
              <input value={form.powerFactor} onChange={(e) => setForm({ ...form, powerFactor: parseFloat(e.target.value) || 0.85 })} type="number" step="0.01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Demand Factor</label>
              <input value={form.demandFactor} onChange={(e) => setForm({ ...form, demandFactor: parseFloat(e.target.value) || 1 })} type="number" step="0.01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} type="number" min="1" className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-lg">
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Name</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Category</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">kW</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">V</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">PF</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">DF</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Qty</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Current (A)</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loads.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-600">No loads yet</td></tr>
            ) : (
              loads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-white font-medium">{l.name}</td>
                  <td className="px-3 py-2 text-gray-400">{l.category}</td>
                  <td className="px-3 py-2 text-gray-400">{l.power}</td>
                  <td className="px-3 py-2 text-gray-400">{l.voltage}</td>
                  <td className="px-3 py-2 text-gray-400">{l.powerFactor}</td>
                  <td className="px-3 py-2 text-gray-400">{l.demandFactor}</td>
                  <td className="px-3 py-2 text-gray-400">{l.quantity}</td>
                  <td className="px-3 py-2 text-orange-400 font-mono">{l.runningCurrent}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => startEdit(l)} className="p-1 text-gray-500 hover:text-orange-400">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(l.id)} className="p-1 text-gray-500 hover:text-red-400 ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
