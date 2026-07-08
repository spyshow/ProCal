'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  area: number;
  loadDensity: number;
  connectedLoad: number;
  breakerSize: string | null;
  cableSize: string | null;
}

interface TemplateManagerProps {
  projectId: string;
  templates: Template[];
  onRefresh: () => void;
}

export default function TemplateManager({ projectId, templates, onRefresh }: TemplateManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', area: 0, loadDensity: 0 });

  const resetForm = () => {
    setForm({ name: '', area: 0, loadDensity: 0 });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/templates/${editing.id}` : '/api/templates';
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
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setForm({ name: t.name, area: t.area, loadDensity: t.loadDensity });
    setShowForm(true);
  };

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent';
  const labelClass = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Apartment Templates</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Template
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg border border-gray-700 bg-gray-800/50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. Studio 1BR"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Area (m²)</label>
              <input
                value={form.area || ''}
                onChange={(e) => setForm({ ...form, area: parseFloat(e.target.value) || 0 })}
                type="number"
                step="0.1"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Load Density (VA/m²)</label>
              <input
                value={form.loadDensity || ''}
                onChange={(e) => setForm({ ...form, loadDensity: parseFloat(e.target.value) || 0 })}
                type="number"
                step="1"
                className={inputClass}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">
              Cancel
            </button>
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
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Area</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Density</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Load (VA)</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Breaker</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold">Cable</th>
              <th className="px-3 py-2 text-gray-400 uppercase tracking-wider font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {templates.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-600">No templates yet</td></tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-white font-medium">{t.name}</td>
                  <td className="px-3 py-2 text-gray-400">{t.area} m²</td>
                  <td className="px-3 py-2 text-gray-400">{t.loadDensity}</td>
                  <td className="px-3 py-2 text-gray-400">{t.connectedLoad.toLocaleString()}</td>
                  <td className="px-3 py-2 text-orange-400 font-mono">{t.breakerSize}</td>
                  <td className="px-3 py-2 text-orange-400 font-mono">{t.cableSize}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => startEdit(t)} className="p-1 text-gray-500 hover:text-orange-400">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-500 hover:text-red-400 ml-1">
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
