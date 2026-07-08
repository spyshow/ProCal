'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { Building2, Plus, Trash2, ArrowRight } from 'lucide-react';
import { COUNTRY_DEFAULTS } from '@/lib/country-defaults';

interface Project {
  id: string;
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  preferredManufacturer: string;
  buildings: { id: string; name: string; floors: number }[];
}

export default function ProjectsPage() {
  const router = useRouter();
  const { selectProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    client: '',
    consultant: '',
    contractor: '',
    location: '',
    engineer: '',
    country: 'Syria',
    voltage: '400',
    frequency: '50',
    powerFactor: '0.85',
    maxDemandFactor: '0.8',
  });
  const [saving, setSaving] = useState(false);

  const loadProjects = () => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const project = await res.json();
        selectProject(project.id);
        setShowNew(false);
        setForm({ name: '', client: '', consultant: '', contractor: '', location: '', engineer: '', country: 'Syria', voltage: '400', frequency: '50', powerFactor: '0.85', maxDemandFactor: '0.8' });
        loadProjects();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its data?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    loadProjects();
  };

  const handleSelect = (id: string) => {
    selectProject(id);
    router.push(`/projects/${id}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your electrical design projects</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* New Project Form */}
      {showNew && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">New Project</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Project Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="dense-input w-full rounded"
                placeholder="e.g. Marina Residence"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Client</label>
              <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Consultant</label>
              <input value={form.consultant} onChange={(e) => setForm({ ...form, consultant: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contractor</label>
              <input value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Engineer</label>
              <input value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Country *</label>
              <select
                value={form.country}
                onChange={(e) => {
                  const country = e.target.value;
                  const defaults = COUNTRY_DEFAULTS[country];
                  setForm({
                    ...form,
                    country,
                    voltage: String(defaults?.voltage || 400),
                    frequency: String(defaults?.frequency || 50),
                    powerFactor: String(defaults?.powerFactor || 0.85),
                  });
                }}
                className="dense-input w-full rounded"
                required
              >
                {Object.keys(COUNTRY_DEFAULTS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Voltage (V)</label>
              <input value={form.voltage} onChange={(e) => setForm({ ...form, voltage: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Frequency (Hz)</label>
              <input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Power Factor</label>
              <input value={form.powerFactor} onChange={(e) => setForm({ ...form, powerFactor: e.target.value })} className="dense-input w-full rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Project'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/40">
          <Building2 size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-gray-700 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-200 truncate">{proj.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {proj.client || '—'} · {proj.location || '—'} · {proj.buildings.length} building{proj.buildings.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-xs text-gray-500 flex-shrink-0">
                <span className="inline-block px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
                  {proj.preferredManufacturer}
                </span>
              </div>
              <button
                onClick={() => handleSelect(proj.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-orange-600/20 text-sm text-gray-300 hover:text-orange-300 transition-colors"
              >
                Open <ArrowRight size={14} />
              </button>
              <button
                onClick={() => handleDelete(proj.id)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
