'use client';

import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import {
  Database,
  Search,
  Upload,
  Download,
  Plus,
  Pencil,
  Trash2,
  X,
  Filter,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BreakerFamily {
  id: string;
  manufacturer: string;
  category: string;
  name: string;
  catalogItemCount?: number;
}

interface Breaker {
  id: string;
  category: string;
  manufacturer: string;
  series: string;
  model: string;
  ratedCurrent: number;
  poles: number;
  breakingCapacity: number;
  tripUnit: string | null;
  settingsJson: string | null;
  datasheetUrl: string | null;
  familyId: string | null;
  familyName: string | null;
}

interface BreakerForm {
  category: string;
  manufacturer: string;
  series: string;
  model: string;
  ratedCurrent: string;
  poles: string;
  breakingCapacity: string;
  tripUnit: string;
  settingsJson: string;
  datasheetUrl: string;
}

interface FamilyForm {
  manufacturer: string;
  category: string;
  name: string;
}

type ActiveTab = 'breakers' | 'families';
type ImportStatus = { type: 'success' | 'error'; message: string } | null;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CATEGORIES = ['ACB', 'MCCB', 'MCB', 'RCCB', 'RCBO', 'SPD', 'CONTACTOR', 'OVERLOAD', 'METER', 'CT'];
const POLE_OPTIONS = [1, 2, 3, 4];
const MANUFACTURERS = ['ABB', 'Schneider', 'Siemens', 'Legrand'];

const EMPTY_BREAKER_FORM: BreakerForm = {
  category: 'MCB',
  manufacturer: 'Schneider',
  series: '',
  model: '',
  ratedCurrent: '',
  poles: '3',
  breakingCapacity: '',
  tripUnit: '',
  settingsJson: '',
  datasheetUrl: '',
};

const EMPTY_FAMILY_FORM: FamilyForm = {
  manufacturer: 'Schneider',
  category: 'MCB',
  name: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function BreakerLibraryPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<ActiveTab>('breakers');

  // Data
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [families, setFamilies] = useState<BreakerFamily[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [minCurrent, setMinCurrent] = useState('');
  const [maxCurrent, setMaxCurrent] = useState('');

  // Modal / form
  const [showBreakerModal, setShowBreakerModal] = useState(false);
  const [editingBreaker, setEditingBreaker] = useState<Breaker | null>(null);
  const [breakerForm, setBreakerForm] = useState<BreakerForm>(EMPTY_BREAKER_FORM);
  const [savingBreaker, setSavingBreaker] = useState(false);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<BreakerFamily | null>(null);
  const [familyForm, setFamilyForm] = useState<FamilyForm>(EMPTY_FAMILY_FORM);
  const [savingFamily, setSavingFamily] = useState(false);

  // Import / export
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    if (manufacturerFilter) params.set('manufacturer', manufacturerFilter);
    if (familyFilter) params.set('familyId', familyFilter);
    if (minCurrent) params.set('minCurrent', minCurrent);
    if (maxCurrent) params.set('maxCurrent', maxCurrent);
    return params.toString();
  }, [search, categoryFilter, manufacturerFilter, familyFilter, minCurrent, maxCurrent]);

  const refreshBreakers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/admin/breakers${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBreakers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load breakers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const refreshFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/breaker-families');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFamilies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load families once on mount (deferred so state updates happen outside the effect body).
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      fetch('/api/admin/breaker-families')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!cancelled) setFamilies(Array.isArray(data) ? data : []);
        })
        .catch((err) => console.error(err));
    }, 0);
    return () => {
      clearTimeout(id);
      cancelled = true;
    };
  }, []);

  // Load breakers whenever filters change (deferred so state updates happen outside the effect body).
  useEffect(() => {
    const id = setTimeout(() => {
      refreshBreakers();
    }, 0);
    return () => clearTimeout(id);
  }, [refreshBreakers]);

  // ---------------------------------------------------------------------------
  // Breaker CRUD
  // ---------------------------------------------------------------------------
  const startCreateBreaker = () => {
    setEditingBreaker(null);
    setBreakerForm(EMPTY_BREAKER_FORM);
    setShowBreakerModal(true);
  };

  const startEditBreaker = (breaker: Breaker) => {
    setEditingBreaker(breaker);
    setBreakerForm({
      category: breaker.category,
      manufacturer: breaker.manufacturer,
      series: breaker.series,
      model: breaker.model,
      ratedCurrent: String(breaker.ratedCurrent),
      poles: String(breaker.poles),
      breakingCapacity: String(breaker.breakingCapacity),
      tripUnit: breaker.tripUnit ?? '',
      settingsJson: breaker.settingsJson ?? '',
      datasheetUrl: breaker.datasheetUrl ?? '',
    });
    setShowBreakerModal(true);
  };

  const handleBreakerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBreaker(true);
    try {
      const payload = {
        ...breakerForm,
        ratedCurrent: parseFloat(breakerForm.ratedCurrent),
        poles: parseInt(breakerForm.poles, 10),
        breakingCapacity: parseFloat(breakerForm.breakingCapacity || '0'),
      };
      const url = editingBreaker ? `/api/admin/breakers/${editingBreaker.id}` : '/api/admin/breakers';
      const method = editingBreaker ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowBreakerModal(false);
      await Promise.all([refreshBreakers(), refreshFamilies()]);
    } catch (err) {
      alert('Failed to save breaker');
      console.error(err);
    } finally {
      setSavingBreaker(false);
    }
  };

  const handleDeleteBreaker = async (id: string) => {
    if (!confirm('Delete this breaker?')) return;
    try {
      const res = await fetch(`/api/admin/breakers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Promise.all([refreshBreakers(), refreshFamilies()]);
    } catch (err) {
      alert('Failed to delete breaker');
      console.error(err);
    }
  };

  // ---------------------------------------------------------------------------
  // Family CRUD
  // ---------------------------------------------------------------------------
  const startCreateFamily = () => {
    setEditingFamily(null);
    setFamilyForm(EMPTY_FAMILY_FORM);
    setShowFamilyModal(true);
  };

  const startEditFamily = (family: BreakerFamily) => {
    setEditingFamily(family);
    setFamilyForm({
      manufacturer: family.manufacturer,
      category: family.category,
      name: family.name,
    });
    setShowFamilyModal(true);
  };

  const handleFamilySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingFamily(true);
    try {
      const url = editingFamily ? `/api/admin/breaker-families/${editingFamily.id}` : '/api/admin/breaker-families';
      const method = editingFamily ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familyForm),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowFamilyModal(false);
      await Promise.all([refreshFamilies(), refreshBreakers()]);
    } catch (err) {
      alert('Failed to save family');
      console.error(err);
    } finally {
      setSavingFamily(false);
    }
  };

  const handleDeleteFamily = async (id: string) => {
    if (!confirm('Delete this family? Catalog items referencing it will keep working but lose the family link.')) return;
    try {
      const res = await fetch(`/api/admin/breaker-families/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete family');
        return;
      }
      await Promise.all([refreshFamilies(), refreshBreakers()]);
    } catch (err) {
      alert('Failed to delete family');
      console.error(err);
    }
  };

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------
  const handleExportTemplate = () => {
    window.location.href = '/api/admin/breakers/export/template';
  };

  const handleExportCatalog = () => {
    const qs = buildQuery();
    window.location.href = `/api/admin/breakers/export/catalog${qs ? `?${qs}` : ''}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/breakers/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus({ type: 'error', message: data.error || 'Import failed' });
      } else {
        const { summary } = data;
        const errors = [...(summary.validationErrors || []), ...(summary.upsertErrors || [])];
        const base = `Imported ${summary.applied} of ${summary.validRows} valid rows (${summary.totalRows} total).`;
        setImportStatus({
          type: errors.length > 0 ? 'error' : 'success',
          message: errors.length > 0 ? `${base} ${errors.length} errors. See console for details.` : base,
        });
        await Promise.all([refreshBreakers(), refreshFamilies()]);
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: 'Import request failed' });
      console.error(err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------
  const availableFamilies = families.filter((f) => {
    if (categoryFilter && f.category !== categoryFilter) return false;
    if (manufacturerFilter && f.manufacturer.toUpperCase() !== manufacturerFilter.toUpperCase()) return false;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database size={22} className="text-orange-500" />
            Breaker Library
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage breaker families and catalog items.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportTemplate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"
          >
            <Download size={14} />
            Template CSV
          </button>
          <button
            onClick={handleExportCatalog}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"
          >
            <Download size={14} />
            Export CSV
          </button>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Import status */}
      {importStatus && (
        <div
          className={classNames(
            'p-3 rounded-lg text-sm flex items-start gap-2',
            importStatus.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {importStatus.type === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
          {importStatus.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(
          [
            { key: 'breakers', label: 'Breakers' },
            { key: 'families', label: 'Families' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={classNames(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'breakers' && (
        <>
          {/* Filters */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Filter size={14} className="text-gray-500" />
              Filters
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setManufacturerFilter('');
                  setFamilyFilter('');
                  setMinCurrent('');
                  setMaxCurrent('');
                }}
                className="ml-auto text-xs text-orange-400 hover:text-orange-300"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Model or series"
                    className="dense-input w-full rounded pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="dense-input w-full rounded"
                >
                  <option value="">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Manufacturer</label>
                <select
                  value={manufacturerFilter}
                  onChange={(e) => setManufacturerFilter(e.target.value)}
                  className="dense-input w-full rounded"
                >
                  <option value="">All</option>
                  {MANUFACTURERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Family</label>
                <div className="relative">
                  <select
                    value={familyFilter}
                    onChange={(e) => setFamilyFilter(e.target.value)}
                    className="dense-input w-full rounded appearance-none pr-8"
                  >
                    <option value="">All</option>
                    {availableFamilies.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.manufacturer} — {f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Min A</label>
                  <input
                    type="number"
                    value={minCurrent}
                    onChange={(e) => setMinCurrent(e.target.value)}
                    className="dense-input w-full rounded"
                    min="0"
                    step="any"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Max A</label>
                  <input
                    type="number"
                    value={maxCurrent}
                    onChange={(e) => setMaxCurrent(e.target.value)}
                    className="dense-input w-full rounded"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex justify-end">
            <button
              onClick={startCreateBreaker}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
            >
              <Plus size={14} />
              Add Breaker
            </button>
          </div>

          {/* Breaker table */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 overflow-x-auto">
            <table className="w-full engineering-table text-xs">
              <thead>
                <tr>
                  <th className="text-left">Manufacturer</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Family</th>
                  <th className="text-left">Series</th>
                  <th className="text-left">Model</th>
                  <th className="text-right">In (A)</th>
                  <th className="text-center">Poles</th>
                  <th className="text-right">Icu (kA)</th>
                  <th className="text-left">Trip</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading…
                    </td>
                  </tr>
                ) : breakers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      No breakers match the filters.
                    </td>
                  </tr>
                ) : (
                  breakers.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30">
                      <td className="text-gray-300">{b.manufacturer}</td>
                      <td className="text-gray-300">{b.category}</td>
                      <td className="text-gray-300">{b.familyName ?? '—'}</td>
                      <td className="text-gray-300">{b.series}</td>
                      <td className="text-gray-200 font-medium">{b.model}</td>
                      <td className="text-right font-mono text-blue-400">{b.ratedCurrent}</td>
                      <td className="text-center font-mono">{b.poles}</td>
                      <td className="text-right font-mono">{b.breakingCapacity}</td>
                      <td className="text-gray-400">{b.tripUnit ?? '—'}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditBreaker(b)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-orange-400"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBreaker(b.id)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'families' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={startCreateFamily}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
            >
              <Plus size={14} />
              Add Family
            </button>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 overflow-x-auto">
            <table className="w-full engineering-table text-xs">
              <thead>
                <tr>
                  <th className="text-left">Manufacturer</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Name</th>
                  <th className="text-right">Catalog Items</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {families.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No families found.
                    </td>
                  </tr>
                ) : (
                  families.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-800/30">
                      <td className="text-gray-300">{f.manufacturer}</td>
                      <td className="text-gray-300">{f.category}</td>
                      <td className="text-gray-200 font-medium">{f.name}</td>
                      <td className="text-right font-mono text-blue-400">{f.catalogItemCount ?? 0}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditFamily(f)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-orange-400"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteFamily(f.id)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Breaker Modal */}
      {showBreakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingBreaker ? 'Edit Breaker' : 'Add Breaker'}
              </h2>
              <button
                onClick={() => setShowBreakerModal(false)}
                className="p-1 rounded hover:bg-gray-800 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleBreakerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={breakerForm.manufacturer}
                    onChange={(e) => setBreakerForm({ ...breakerForm, manufacturer: e.target.value })}
                    className="dense-input w-full rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Category</label>
                  <select
                    value={breakerForm.category}
                    onChange={(e) => setBreakerForm({ ...breakerForm, category: e.target.value })}
                    className="dense-input w-full rounded"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Series</label>
                  <input
                    type="text"
                    value={breakerForm.series}
                    onChange={(e) => setBreakerForm({ ...breakerForm, series: e.target.value })}
                    className="dense-input w-full rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={breakerForm.model}
                    onChange={(e) => setBreakerForm({ ...breakerForm, model: e.target.value })}
                    className="dense-input w-full rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Rated Current (A)</label>
                  <input
                    type="number"
                    value={breakerForm.ratedCurrent}
                    onChange={(e) => setBreakerForm({ ...breakerForm, ratedCurrent: e.target.value })}
                    className="dense-input w-full rounded"
                    min="0"
                    step="any"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Poles</label>
                  <select
                    value={breakerForm.poles}
                    onChange={(e) => setBreakerForm({ ...breakerForm, poles: e.target.value })}
                    className="dense-input w-full rounded"
                  >
                    {POLE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Breaking Capacity (kA)</label>
                  <input
                    type="number"
                    value={breakerForm.breakingCapacity}
                    onChange={(e) => setBreakerForm({ ...breakerForm, breakingCapacity: e.target.value })}
                    className="dense-input w-full rounded"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Trip Unit</label>
                  <input
                    type="text"
                    value={breakerForm.tripUnit}
                    onChange={(e) => setBreakerForm({ ...breakerForm, tripUnit: e.target.value })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Settings JSON</label>
                  <textarea
                    value={breakerForm.settingsJson}
                    onChange={(e) => setBreakerForm({ ...breakerForm, settingsJson: e.target.value })}
                    className="dense-input w-full rounded h-20"
                    placeholder='{"L":{"range":"...","delay":"..."}}'
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Datasheet URL</label>
                  <input
                    type="url"
                    value={breakerForm.datasheetUrl}
                    onChange={(e) => setBreakerForm({ ...breakerForm, datasheetUrl: e.target.value })}
                    className="dense-input w-full rounded"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBreakerModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBreaker}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {savingBreaker ? <Loader2 size={14} className="animate-spin" /> : null}
                  {savingBreaker ? 'Saving…' : editingBreaker ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingFamily ? 'Edit Family' : 'Add Family'}
              </h2>
              <button
                onClick={() => setShowFamilyModal(false)}
                className="p-1 rounded hover:bg-gray-800 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleFamilySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={familyForm.manufacturer}
                  onChange={(e) => setFamilyForm({ ...familyForm, manufacturer: e.target.value })}
                  className="dense-input w-full rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Category</label>
                <select
                  value={familyForm.category}
                  onChange={(e) => setFamilyForm({ ...familyForm, category: e.target.value })}
                  className="dense-input w-full rounded"
                >
                  {['ACB', 'MCCB', 'MCB'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={familyForm.name}
                  onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                  className="dense-input w-full rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFamilyModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFamily}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {savingFamily ? <Loader2 size={14} className="animate-spin" /> : null}
                  {savingFamily ? 'Saving…' : editingFamily ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
