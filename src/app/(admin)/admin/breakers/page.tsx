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
  ExternalLink,
  Sliders,
  FileText,
  Info,
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
const MANUFACTURERS = ['ABB', 'Schneider', 'Eaton', 'Siemens', 'Legrand', 'Iskra'];

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

function classNames(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminBreakersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('breakers');

  // Breakers state
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [minCurrent, setMinCurrent] = useState('');
  const [maxCurrent, setMaxCurrent] = useState('');

  // Families state
  const [families, setFamilies] = useState<BreakerFamily[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);

  // Modals
  const [showBreakerModal, setShowBreakerModal] = useState(false);
  const [editingBreaker, setEditingBreaker] = useState<Breaker | null>(null);
  const [breakerForm, setBreakerForm] = useState<BreakerForm>(EMPTY_BREAKER_FORM);
  const [savingBreaker, setSavingBreaker] = useState(false);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<BreakerFamily | null>(null);
  const [familyForm, setFamilyForm] = useState<FamilyForm>(EMPTY_FAMILY_FORM);
  const [savingFamily, setSavingFamily] = useState(false);

  // Inspect settings modal
  const [inspectSettingsBreaker, setInspectSettingsBreaker] = useState<Breaker | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Fetch Breakers
  // -------------------------------------------------------------------------
  const fetchBreakers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (manufacturerFilter) params.set('manufacturer', manufacturerFilter);
      if (minCurrent) params.set('minCurrent', minCurrent);
      if (maxCurrent) params.set('maxCurrent', maxCurrent);

      const res = await fetch(`/api/admin/breakers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch equipment items');
      const data = await res.json();
      setBreakers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching equipment');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, manufacturerFilter, minCurrent, maxCurrent]);

  useEffect(() => {
    fetchBreakers();
  }, [fetchBreakers]);

  // -------------------------------------------------------------------------
  // Fetch Families
  // -------------------------------------------------------------------------
  const fetchFamilies = useCallback(async () => {
    setLoadingFamilies(true);
    try {
      const res = await fetch('/api/admin/breaker-families');
      if (!res.ok) throw new Error('Failed to fetch breaker families');
      const data = await res.json();
      setFamilies(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingFamilies(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'families') {
      fetchFamilies();
    }
  }, [activeTab, fetchFamilies]);

  // -------------------------------------------------------------------------
  // Breaker CRUD
  // -------------------------------------------------------------------------
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

  const handleSaveBreaker = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBreaker(true);
    try {
      const payload = {
        category: breakerForm.category,
        manufacturer: breakerForm.manufacturer,
        series: breakerForm.series,
        model: breakerForm.model,
        ratedCurrent: parseFloat(breakerForm.ratedCurrent) || 0,
        poles: parseInt(breakerForm.poles, 10) || 3,
        breakingCapacity: parseFloat(breakerForm.breakingCapacity) || 0,
        tripUnit: breakerForm.tripUnit || null,
        settingsJson: breakerForm.settingsJson ? breakerForm.settingsJson.trim() : null,
        datasheetUrl: breakerForm.datasheetUrl || null,
      };

      if (editingBreaker) {
        const res = await fetch(`/api/admin/breakers/${editingBreaker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update equipment item');
      } else {
        const res = await fetch('/api/admin/breakers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create equipment item');
      }

      setShowBreakerModal(false);
      fetchBreakers();
    } catch (err: any) {
      alert(err.message || 'Error saving equipment item');
    } finally {
      setSavingBreaker(false);
    }
  };

  const handleDeleteBreaker = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment item?')) return;
    try {
      const res = await fetch(`/api/admin/breakers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete equipment item');
      fetchBreakers();
    } catch (err: any) {
      alert(err.message || 'Error deleting equipment item');
    }
  };

  // -------------------------------------------------------------------------
  // Family CRUD
  // -------------------------------------------------------------------------
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

  const handleSaveFamily = async (e: FormEvent) => {
    e.preventDefault();
    setSavingFamily(true);
    try {
      if (editingFamily) {
        const res = await fetch(`/api/admin/breaker-families/${editingFamily.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(familyForm),
        });
        if (!res.ok) throw new Error('Failed to update family');
      } else {
        const res = await fetch('/api/admin/breaker-families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(familyForm),
        });
        if (!res.ok) throw new Error('Failed to create family');
      }

      setShowFamilyModal(false);
      fetchFamilies();
    } catch (err: any) {
      alert(err.message || 'Error saving family');
    } finally {
      setSavingFamily(false);
    }
  };

  const handleDeleteFamily = async (id: string) => {
    if (!confirm('Are you sure you want to delete this family?')) return;
    try {
      const res = await fetch(`/api/admin/breaker-families/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete family');
      }
      fetchFamilies();
    } catch (err: any) {
      alert(err.message || 'Error deleting family');
    }
  };

  // -------------------------------------------------------------------------
  // CSV Import / Export
  // -------------------------------------------------------------------------
  const handleExportTemplate = () => {
    window.location.href = '/api/admin/breakers/export/template';
  };

  const handleExportCatalog = () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (manufacturerFilter) params.set('manufacturer', manufacturerFilter);
    window.location.href = `/api/admin/breakers/export/catalog?${params.toString()}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/breakers/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportStatus({
        type: 'success',
        message: `Successfully imported ${data.importedCount} items (${data.createdCount} created, ${data.updatedCount} updated).`,
      });
      fetchBreakers();
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: err.message || 'Error during CSV import',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------------------
  // Helper to render concise selectivity badges
  // -------------------------------------------------------------------------
  const renderSelectivityBadge = (b: Breaker) => {
    if (!b.settingsJson) {
      return <span className="text-gray-500 italic text-[11px]">—</span>;
    }

    try {
      const parsed = JSON.parse(b.settingsJson);
      let summary = '';
      if (parsed.Icw) {
        summary = `Icw: ${parsed.Icw}kA · ${parsed.curveType || 'LSI'}`;
      } else if (parsed.L && parsed.S) {
        summary = `LSI Adj. (${parsed.L.range?.split(' ')[0] ?? '0.4-1.0In'})`;
      } else if (parsed.thermal) {
        summary = `TM Adj. (${parsed.thermal.range?.split(' ')[0] ?? '0.7-1.0In'})`;
      } else if (parsed.curveType === 'C' || parsed.curveType === 'B' || parsed.curveType === 'D') {
        summary = `${parsed.curveType}-Curve · Cl.3 (I²t ≤ ${Math.round((parsed.letThroughI2t ?? 0) / 1000)}k)`;
      } else if (parsed.coilVoltage) {
        summary = `${parsed.coilVoltage} · ${parsed.utilizationCategory ?? 'AC-3'}`;
      } else if (parsed.accuracyClass) {
        summary = `Cl. ${parsed.accuracyClass} · ${parsed.protocol ?? 'Modbus'}`;
      } else if (parsed.type) {
        summary = `${parsed.type} · Up ${parsed.Up ?? '1.4kV'}`;
      } else {
        summary = 'Configured';
      }

      return (
        <button
          type="button"
          onClick={() => setInspectSettingsBreaker(b)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 hover:bg-blue-900/60 hover:text-blue-200 transition-colors text-[11px] font-mono"
          title="Click to view full selectivity dials & parameters"
        >
          <Sliders size={10} className="text-blue-400" />
          <span className="truncate max-w-[140px]">{summary}</span>
        </button>
      );
    } catch {
      return (
        <button
          type="button"
          onClick={() => setInspectSettingsBreaker(b)}
          className="text-amber-400 hover:underline text-[11px]"
        >
          Custom JSON
        </button>
      );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-orange-500" />
            Equipment & Breaker Catalog
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage circuit breakers, switchgear, selectivity parameters (Icw, LSI dials, I²t), and manufacturer families.
          </p>
        </div>

        {/* Actions */}
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
            { key: 'breakers', label: 'Breakers & Equipment' },
            { key: 'families', label: 'Breaker Families' },
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
                  setMinCurrent('');
                  setMaxCurrent('');
                }}
                className="text-xs text-orange-400 hover:underline ml-auto"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search model or series…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="dense-input w-full pl-9 rounded"
                />
              </div>

              {/* Category */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="dense-input w-full rounded"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Manufacturer */}
              <select
                value={manufacturerFilter}
                onChange={(e) => setManufacturerFilter(e.target.value)}
                className="dense-input w-full rounded"
              >
                <option value="">All Manufacturers</option>
                {MANUFACTURERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Min Current */}
              <input
                type="number"
                placeholder="Min In (A)"
                value={minCurrent}
                onChange={(e) => setMinCurrent(e.target.value)}
                className="dense-input w-full rounded"
                min="0"
              />

              {/* Max Current */}
              <input
                type="number"
                placeholder="Max In (A)"
                value={maxCurrent}
                onChange={(e) => setMaxCurrent(e.target.value)}
                className="dense-input w-full rounded"
                min="0"
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              Showing <span className="text-white font-semibold">{breakers.length}</span> items
            </span>
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
                  <th className="text-left">Selectivity & Settings</th>
                  <th className="text-center">Datasheet</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading…
                    </td>
                  </tr>
                ) : breakers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500">
                      No breakers match the filters.
                    </td>
                  </tr>
                ) : (
                  breakers.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-800/30">
                      <td className="text-gray-300 font-semibold">{b.manufacturer}</td>
                      <td className="text-gray-300">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-gray-300 border border-gray-700">
                          {b.category}
                        </span>
                      </td>
                      <td className="text-gray-400">{b.familyName ?? '—'}</td>
                      <td className="text-gray-400">{b.series}</td>
                      <td className="text-gray-200 font-medium">{b.model}</td>
                      <td className="text-right font-mono text-blue-400 font-bold">{b.ratedCurrent}</td>
                      <td className="text-center font-mono">{b.poles}</td>
                      <td className="text-right font-mono text-emerald-400">{b.breakingCapacity}</td>
                      <td className="text-gray-400">{b.tripUnit ?? '—'}</td>
                      <td className="text-left">{renderSelectivityBadge(b)}</td>
                      <td className="text-center">
                        {b.datasheetUrl ? (
                          <a
                            href={b.datasheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-[11px]"
                            title="Open official manufacturer datasheet"
                          >
                            <ExternalLink size={12} />
                            Doc
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
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
                {loadingFamilies ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading…
                    </td>
                  </tr>
                ) : families.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No breaker families defined yet.
                    </td>
                  </tr>
                ) : (
                  families.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-800/30">
                      <td className="text-gray-300 font-semibold">{f.manufacturer}</td>
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

      {/* Selectivity Settings Inspector Modal */}
      {inspectSettingsBreaker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-400" />
                  Selectivity & Protection Dials
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inspectSettingsBreaker.manufacturer} {inspectSettingsBreaker.model} ({inspectSettingsBreaker.ratedCurrent}A)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectSettingsBreaker(null)}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <pre className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                {JSON.stringify(JSON.parse(inspectSettingsBreaker.settingsJson || '{}'), null, 2)}
              </pre>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              {inspectSettingsBreaker.datasheetUrl && (
                <a
                  href={inspectSettingsBreaker.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-400 hover:underline"
                >
                  <ExternalLink size={13} />
                  Open Official Manufacturer Datasheet
                </a>
              )}
              <button
                type="button"
                onClick={() => setInspectSettingsBreaker(null)}
                className="px-4 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs font-medium ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breaker Modal */}
      {showBreakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingBreaker ? 'Edit Breaker' : 'Add Breaker'}
              </h2>
              <button
                onClick={() => setShowBreakerModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBreaker} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Manufacturer</label>
                  <select
                    value={breakerForm.manufacturer}
                    onChange={(e) => setBreakerForm({ ...breakerForm, manufacturer: e.target.value })}
                    className="dense-input w-full rounded"
                  >
                    {MANUFACTURERS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
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
                    placeholder="e.g. Tmax XT4, Acti9 iC60"
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
                    placeholder="e.g. XT4N 250 Ekip LSI"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Rated Current (In, A)</label>
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
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Breaking Capacity (Icu, kA)</label>
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
                    placeholder="e.g. Ekip Dip LSI, MicroLogic 2.2, C-Curve"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500">
                      Selectivity Settings JSON (Icw, LSI dials, I²t)
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const In = parseFloat(breakerForm.ratedCurrent) || 100;
                          setBreakerForm({
                            ...breakerForm,
                            settingsJson: JSON.stringify(
                              {
                                Ics: parseFloat(breakerForm.breakingCapacity) || 36,
                                standard: "IEC 60947-2",
                                category: "A",
                                curveType: "LSI",
                                L: { range: "0.4..1.0xIn", delay: "3..12s", defaultIr: In, defaultTr: 12 },
                                S: { range: "1.0..10xIn", delay: "0.05..0.4s", i2t: true, defaultIsd: In * 5, defaultTsd: 0.1 },
                                I: { range: "1.5..15xIn", defaultIi: In * 10 },
                              },
                              null,
                              2
                            ),
                          });
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-orange-400"
                      >
                        + Template LSI
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const In = parseFloat(breakerForm.ratedCurrent) || 63;
                          setBreakerForm({
                            ...breakerForm,
                            settingsJson: JSON.stringify(
                              {
                                Ics: parseFloat(breakerForm.breakingCapacity) || 36,
                                standard: "IEC 60947-2",
                                category: "A",
                                curveType: "TM",
                                thermal: { range: "0.7..1.0xIn", defaultIr: In },
                                magnetic: { range: "10xIn fixed", defaultIm: In * 10 },
                              },
                              null,
                              2
                            ),
                          });
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-orange-400"
                      >
                        + Template TMD
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={breakerForm.settingsJson}
                    onChange={(e) => setBreakerForm({ ...breakerForm, settingsJson: e.target.value })}
                    className="dense-input w-full rounded h-28 font-mono text-xs text-emerald-400"
                    placeholder='{"Icw": 42, "L": {"range": "0.4..1.0xIn"}, "S": {"range": "0.6..10xIn"}}'
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Datasheet URL</label>
                  <input
                    type="url"
                    value={breakerForm.datasheetUrl}
                    onChange={(e) => setBreakerForm({ ...breakerForm, datasheetUrl: e.target.value })}
                    className="dense-input w-full rounded"
                    placeholder="https://search.abb.com/... or https://www.se.com/..."
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
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFamily} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Manufacturer</label>
                <select
                  value={familyForm.manufacturer}
                  onChange={(e) => setFamilyForm({ ...familyForm, manufacturer: e.target.value })}
                  className="dense-input w-full rounded"
                >
                  {MANUFACTURERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Category</label>
                <select
                  value={familyForm.category}
                  onChange={(e) => setFamilyForm({ ...familyForm, category: e.target.value })}
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
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={familyForm.name}
                  onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                  className="dense-input w-full rounded"
                  placeholder="e.g. ComPacT NSX, S200"
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
