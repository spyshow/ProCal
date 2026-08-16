'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';
import { Building2, Plus, Trash2, ArrowRight, ArrowLeft, Wallet } from 'lucide-react';
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
  const { user, refreshUser } = useUser();
  const { t, isRtl } = useTranslation();
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
    calculationStandard: 'IEC',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // CQ-C proactive gate: a non-admin with zero project credits can't create —
  // route them to buy (Track 4 /billing). Admins bypass the credit gate
  // server-side, so they always see "New Project". The race (form open at 1
  // credit, spent elsewhere, then submit → 402) is handled by the branched else
  // in handleCreate; this gate only hides creation when credits are already 0.
  const isZeroCredits = user != null && user.role !== 'ADMIN' && user.credits < 1;

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
    setFormError('');
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
        setForm({ name: '', client: '', consultant: '', contractor: '', location: '', engineer: '', country: 'Syria', voltage: '400', frequency: '50', powerFactor: '0.85', maxDemandFactor: '0.8', calculationStandard: 'IEC' });
        loadProjects();
      } else if (res.status === 402) {
        // CQ-A self-heal: credit gate tripped server-side (the proactive gate
        // race window). Refresh the shared user so the gate reflects server
        // truth, then send them to buy. The 402 returned before the decrement
        // transaction, so no credit was lost.
        await refreshUser();
        router.push('/billing');
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data?.error || 'Could not create the project. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Unable to reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const STANDARDS = [
    { value: 'IEC', label: 'IEC / EN 50160' },
    { value: 'NEMA', label: 'NEMA / IEEE' },
  ];

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
          <h1 className="text-2xl font-bold text-white">{t('projects.title', 'Projects')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('projects.subtitle', 'Manage your electrical design projects')}</p>
        </div>
        {isZeroCredits ? (
          <Link
            href="/billing"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
            title="You have no project credits — request more"
          >
            <Wallet size={16} />
            {t('projects.getCredits', 'Get credits to create a project')}
          </Link>
        ) : (
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            {t('projects.newProject', 'New Project')}
          </button>
        )}
      </div>

      {/* Zero-credit notice — sits above the list, mirrors the button swap */}
      {isZeroCredits && !showNew && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-800/60 bg-orange-900/15 px-4 py-3 text-sm">
          <Wallet size={16} className="flex-shrink-0 text-orange-400" />
          <span className="text-orange-200">
            {t('projects.noCreditsNotice', 'You have no project credits left. Request more to create a new project.')}
          </span>
          <Link href="/billing" className="ms-auto font-semibold text-orange-300 hover:text-orange-200 transition-colors">
            {t('projects.requestCredits', 'Request credits →')}
          </Link>
        </div>
      )}

      {/* New Project Form */}
      {showNew && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{t('projects.newProject', 'New Project')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.projectName', 'Project Name *')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="dense-input w-full rounded"
                placeholder={t('projects.projectNamePlaceholder', 'e.g. Marina Residence')}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.client', 'Client')}</label>
              <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.consultant', 'Consultant')}</label>
              <input value={form.consultant} onChange={(e) => setForm({ ...form, consultant: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.contractor', 'Contractor')}</label>
              <input value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.location', 'Location')}</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.engineer', 'Engineer')}</label>
              <input value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('projects.country', 'Country *')}</label>
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
              <label className="block text-xs text-gray-400 mb-1">{t('common.voltage', 'Voltage (V)')}</label>
              <input value={form.voltage} onChange={(e) => setForm({ ...form, voltage: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.frequency', 'Frequency (Hz)')}</label>
              <input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.powerFactor', 'Power Factor')}</label>
              <input value={form.powerFactor} onChange={(e) => setForm({ ...form, powerFactor: e.target.value })} className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('common.standard', 'Calculation Standard')}</label>
              <select
                value={form.calculationStandard}
                onChange={(e) => setForm({ ...form, calculationStandard: e.target.value })}
                className="dense-input w-full rounded"
              >
                {STANDARDS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && (
            <div role="alert" className="rounded-lg border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {formError}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? t('common.saving', 'Creating…') : t('projects.createProject', 'Create Project')}
            </button>
            <button type="button" onClick={() => { setShowNew(false); setFormError(''); }} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">{t('common.loading', 'Loading…')}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/40">
          <Building2 size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">{t('projects.noProjectsPrompt', 'No projects yet. Create one to get started.')}</p>
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
                  {proj.client || '—'} · {proj.location || '—'} · {proj.buildings.length} {t('calculator.buildingsCount', 'buildings')}
                </p>
              </div>
              <button
                onClick={() => handleSelect(proj.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-orange-600/20 text-sm text-gray-300 hover:text-orange-300 transition-colors"
              >
                {t('common.open', 'Open')} {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </button>
              <button
                onClick={() => handleDelete(proj.id)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title={t('common.delete', 'Delete project')}
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
