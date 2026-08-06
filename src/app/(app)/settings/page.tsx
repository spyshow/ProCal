'use client';

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Building2 } from 'lucide-react';
import { COUNTRY_DEFAULTS, ROOM_TYPES, CountryConfig, AcSizingRule } from '@/lib/country-defaults';

type SettingsTab = 'engineering' | 'company';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, CountryConfig>>({});
  const [selectedCountry, setSelectedCountry] = useState('Syria');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('engineering');

  // Voltage drop limits
  const [vdLimits, setVdLimits] = useState({ lighting: 3, power: 5 });


  // Company settings
  const [company, setCompany] = useState({ companyName: "", logoUrl: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCompany();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('procal-vd-limits');
    if (saved) {
      try {
        setVdLimits(JSON.parse(saved));
      } catch {
        // ignore malformed saved data
      }
    }
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.countrySettings || data);
      } else {
        setSettings({ ...COUNTRY_DEFAULTS });
      }
    } catch {
      setSettings({ ...COUNTRY_DEFAULTS });
    } finally {
      setLoading(false);
    }
  };

  const loadCompany = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.company) setCompany(data.company);
      }
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: selectedCountry, settings: settings[selectedCountry] }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Company settings saved' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults = COUNTRY_DEFAULTS[selectedCountry];
    if (defaults) {
      setSettings({
        ...settings,
        [selectedCountry]: { ...defaults },
      });
      setMessage({ type: 'success', text: 'Settings reset to defaults' });
    }
  };

  const updateRoomDensity = (roomType: string, value: number) => {
    const current = settings[selectedCountry];
    if (!current) return;

    setSettings({
      ...settings,
      [selectedCountry]: {
        ...current,
        roomDensities: {
          ...current.roomDensities,
          [roomType]: value,
        },
      },
    });
  };

  const updateAcRule = (index: number, field: keyof AcSizingRule, value: number) => {
    const current = settings[selectedCountry];
    if (!current) return;

    const newRules = [...current.acSizingRules];
    newRules[index] = { ...newRules[index], [field]: value };

    setSettings({
      ...settings,
      [selectedCountry]: {
        ...current,
        acSizingRules: newRules,
      },
    });
  };

  const addAcRule = () => {
    const current = settings[selectedCountry];
    if (!current) return;

    setSettings({
      ...settings,
      [selectedCountry]: {
        ...current,
        acSizingRules: [
          ...current.acSizingRules,
          { maxArea: 60, btu: 36000, watts: 10548 },
        ],
      },
    });
  };

  const removeAcRule = (index: number) => {
    const current = settings[selectedCountry];
    if (!current || current.acSizingRules.length <= 1) return;

    const newRules = current.acSizingRules.filter((_, i) => i !== index);
    setSettings({
      ...settings,
      [selectedCountry]: {
        ...current,
        acSizingRules: newRules,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading settings…</div>
      </div>
    );
  }

  const currentSettings = settings[selectedCountry];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings size={22} className="text-orange-500" />
            Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure engineering defaults and company branding
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          { key: 'engineering' as const, label: 'Engineering Defaults', icon: Settings },
          { key: 'company' as const, label: 'Company & Branding', icon: Building2 },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Engineering Defaults Tab */}
      {activeTab === 'engineering' && (
        <>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

          {/* Country Selector */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <label className="block text-xs text-gray-400 mb-2">Select Country</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="dense-input w-full max-w-xs rounded"
            >
              {Object.keys(COUNTRY_DEFAULTS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {currentSettings && (
            <>
              {/* Room Densities */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Room Densities (VA/m²)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {ROOM_TYPES.map((room) => (
                    <div key={room.value}>
                      <label className="block text-xs text-gray-400 mb-1">{room.label}</label>
                      <input
                        type="number"
                        value={currentSettings.roomDensities[room.value.toLowerCase() as keyof typeof currentSettings.roomDensities] || 0}
                        onChange={(e) => updateRoomDensity(room.value.toLowerCase(), parseFloat(e.target.value) || 0)}
                        className="dense-input w-full rounded"
                        min="0"
                        step="5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* AC Sizing Rules */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    AC Sizing Rules (BTU → Watts)
                  </h2>
                  <button
                    onClick={addAcRule}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    + Add Rule
                  </button>
                </div>
                <div className="space-y-3">
                  {currentSettings.acSizingRules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">Max Area (m²)</label>
                        <input
                          type="number"
                          value={rule.maxArea === Infinity || rule.maxArea == null ? '' : rule.maxArea}
                          onChange={(e) => {
                            const val = e.target.value === '' ? Infinity : parseFloat(e.target.value);
                            updateAcRule(index, 'maxArea', val);
                          }}
                          className="dense-input w-full rounded"
                          placeholder="∞"
                          disabled={rule.maxArea === Infinity}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">BTU</label>
                        <input
                          type="number"
                          value={rule.btu}
                          onChange={(e) => updateAcRule(index, 'btu', parseInt(e.target.value) || 0)}
                          className="dense-input w-full rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">Watts</label>
                        <input
                          type="number"
                          value={rule.watts}
                          onChange={(e) => updateAcRule(index, 'watts', parseInt(e.target.value) || 0)}
                          className="dense-input w-full rounded"
                        />
                      </div>
                      {currentSettings.acSizingRules.length > 1 && rule.maxArea !== Infinity && (
                        <button
                          onClick={() => removeAcRule(index)}
                          className="mt-5 text-gray-600 hover:text-red-400"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Voltage Drop Limits */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-1">
                  Voltage Drop Limits (IEC 60364-5-52)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Lighting Circuits (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={vdLimits.lighting}
                      onChange={(e) => {
                        const next = { ...vdLimits, lighting: parseFloat(e.target.value) || 3 };
                        setVdLimits(next);
                        localStorage.setItem('procal-vd-limits', JSON.stringify(next));
                      }}
                      className="dense-input w-full rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Power Circuits (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={vdLimits.power}
                      onChange={(e) => {
                        const next = { ...vdLimits, power: parseFloat(e.target.value) || 5 };
                        setVdLimits(next);
                        localStorage.setItem('procal-vd-limits', JSON.stringify(next));
                      }}
                      className="dense-input w-full rounded"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">
                  IEC 60364-5-52 standard: 3% for lighting, 5% for power loads. Total from source to load.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Company & Branding Tab */}
      {activeTab === 'company' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Company Information
          </h2>

          {/* Company Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Company Name</label>
            <input
              type="text"
              value={company.companyName}
              onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
              className="dense-input w-full max-w-md rounded"
              placeholder="Your Company Name"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Company Logo</label>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                <div className="relative">
                  <img
                    src={company.logoUrl}
                    alt="Company logo"
                    className="h-20 w-auto object-contain rounded border border-gray-700 bg-white p-1"
                  />
                  <button
                    onClick={() => setCompany({ ...company, logoUrl: "" })}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
                  <span className="text-xs text-gray-500">
                    {uploading ? "Uploading…" : "Click to upload"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (res.ok) {
                          const data = await res.json();
                          setCompany({ ...company, logoUrl: data.url });
                        }
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">PNG, JPG, SVG, or WebP. Max 2MB.</p>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Company Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
