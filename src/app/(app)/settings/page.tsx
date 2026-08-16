'use client';

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, @next/next/no-img-element */
import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Building2,
  Globe,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { COUNTRY_DEFAULTS, ROOM_TYPES, CountryConfig, AcSizingRule } from '@/lib/country-defaults';
import { useTranslation, SupportedLanguage } from '@/i18n';
import { useUser } from '@/context/UserContext';

type SettingsTab = 'engineering' | 'company' | 'language' | 'account';

export default function SettingsPage() {
  const { t, language, setLanguage, isRtl } = useTranslation();
  const { user: currentUser, refreshUser } = useUser();
  const [settings, setSettings] = useState<Record<string, CountryConfig>>({});
  const [selectedCountry, setSelectedCountry] = useState('Syria');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('engineering');

  // Profile change state
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync profile fields when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Voltage drop limits
  const [vdLimits, setVdLimits] = useState({ lighting: 3, power: 5 });

  // Company settings
  const [company, setCompany] = useState({ companyName: "", logoUrl: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCompany();

    // Support direct tab linking via ?tab=account or ?tab=security
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'account' || tabParam === 'security') {
        setActiveTab('account');
      } else if (tabParam === 'company') {
        setActiveTab('company');
      } else if (tabParam === 'language') {
        setActiveTab('language');
      } else if (tabParam === 'engineering') {
        setActiveTab('engineering');
      }
    }
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
        setMessage({ type: 'success', text: t('settings.saveSuccess', 'Settings saved successfully') });
      } else {
        setMessage({ type: 'error', text: t('settings.saveError', 'Failed to save settings') });
      }
    } catch {
      setMessage({ type: 'error', text: t('settings.saveError', 'Failed to save settings') });
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
        setMessage({ type: 'success', text: t('settings.saveCompanySuccess', 'Company settings saved') });
      } else {
        setMessage({ type: 'error', text: t('settings.saveError', 'Failed to save') });
      }
    } catch {
      setMessage({ type: 'error', text: t('settings.saveError', 'Failed to save') });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const trimmedName = profileName.trim();
    const trimmedEmail = profileEmail.trim();

    if (!trimmedName) {
      setProfileMessage({
        type: 'error',
        text: t('settings.nameRequired', 'Full name is required.'),
      });
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileMessage({
        type: 'error',
        text: t('settings.invalidEmail', 'Please enter a valid email address.'),
      });
      return;
    }

    setProfileUpdating(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        await refreshUser();
        setProfileMessage({
          type: 'success',
          text: t('settings.profileUpdateSuccess', 'Profile updated successfully'),
        });
      } else {
        setProfileMessage({
          type: 'error',
          text: data.error || t('settings.profileUpdateError', 'Failed to update profile'),
        });
      }
    } catch {
      setProfileMessage({
        type: 'error',
        text: t('settings.profileUpdateError', 'Failed to update profile'),
      });
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !newPassword) {
      setPasswordMessage({
        type: 'error',
        text: t('settings.passwordRequired', 'Please enter both your current and new password.'),
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: 'error',
        text: t('settings.passwordMinLength', 'Password must be at least 6 characters.'),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: t('settings.passwordMismatch', 'Passwords do not match.'),
      });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordMessage({
        type: 'error',
        text: t('settings.passwordSameError', 'New password must be different from current password.'),
      });
      return;
    }

    setPasswordUpdating(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPasswordMessage({
          type: 'success',
          text: t('settings.passwordUpdateSuccess', 'Password updated successfully!'),
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({
          type: 'error',
          text: data.error || t('settings.passwordUpdateError', 'Failed to update password.'),
        });
      }
    } catch {
      setPasswordMessage({
        type: 'error',
        text: t('settings.passwordUpdateError', 'Failed to update password.'),
      });
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleReset = () => {
    const defaults = COUNTRY_DEFAULTS[selectedCountry];
    if (defaults) {
      setSettings({
        ...settings,
        [selectedCountry]: { ...defaults },
      });
      setMessage({ type: 'success', text: t('settings.resetSuccess', 'Settings reset to defaults') });
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
        <div className="text-gray-500 text-sm">{t('settings.loading', 'Loading settings…')}</div>
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
            {t('settings.title', 'Settings')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('settings.subtitle', 'Configure engineering defaults and company branding')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          { key: 'engineering' as const, label: t('settings.engineering', 'Engineering Defaults'), icon: Settings },
          { key: 'company' as const, label: t('settings.company', 'Company & Branding'), icon: Building2 },
          { key: 'language' as const, label: t('common.language', 'Language & RTL'), icon: Globe },
          { key: 'account' as const, label: t('settings.account', 'Account & Security'), icon: Shield },
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
              {t('settings.reset', 'Reset to Defaults')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? t('settings.saving', 'Saving…') : t('settings.save', 'Save Settings')}
            </button>
          </div>

          {/* Country Selector */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <label className="block text-xs text-gray-400 mb-2">{t('settings.selectCountry', 'Select Country')}</label>
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
                  {t('settings.roomDensities', 'Room Densities (VA/m²)')}
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
                    {t('settings.acSizingRules', 'AC Sizing Rules (BTU → Watts)')}
                  </h2>
                  <button
                    onClick={addAcRule}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    {t('settings.addRule', '+ Add Rule')}
                  </button>
                </div>
                <div className="space-y-3">
                  {currentSettings.acSizingRules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">{t('settings.maxArea', 'Max Area (m²)')}</label>
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
                        <label className="block text-[10px] text-gray-500 mb-1">{t('settings.btu', 'BTU')}</label>
                        <input
                          type="number"
                          value={rule.btu}
                          onChange={(e) => updateAcRule(index, 'btu', parseInt(e.target.value) || 0)}
                          className="dense-input w-full rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-1">{t('settings.watts', 'Watts')}</label>
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
                  {t('settings.voltageDropLimits', 'Voltage Drop Limits (IEC 60364-5-52)')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">{t('settings.lightingLimit', 'Lighting Circuits (%)')}</label>
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
                    <label className="block text-[10px] text-gray-500 mb-1">{t('settings.powerLimit', 'Power Circuits (%)')}</label>
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
                  {t('settings.voltageDropNote', 'IEC 60364-5-52 standard: 3% for lighting, 5% for power loads. Total from source to load.')}
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
            {t('settings.companyInfo', 'Company Information')}
          </h2>

          {/* Company Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('settings.companyName', 'Company Name')}</label>
            <input
              type="text"
              value={company.companyName}
              onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
              className="dense-input w-full max-w-md rounded"
              placeholder={t('settings.companyNamePlaceholder', 'Your Company Name')}
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('settings.companyLogo', 'Company Logo')}</label>
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
                    {uploading ? t('settings.uploading', 'Uploading…') : t('settings.clickToUpload', 'Click to upload')}
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
            <p className="text-[10px] text-gray-600 mt-1">{t('settings.logoFormats', 'PNG, JPG, SVG, or WebP. Max 2MB.')}</p>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? t('settings.saving', 'Saving…') : t('settings.saveCompany', 'Save Company Settings')}
            </button>
          </div>
        </div>
      )}

      {/* Language & RTL Settings Tab */}
      {activeTab === 'language' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-6 max-w-2xl">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Globe size={18} className="text-orange-400" />
              {t('common.language', 'Language & Layout Direction')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('settings.languageSubtitle', 'Select your preferred interface language and layout direction across the entire platform.')}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                {t('common.language', 'Select Language')}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full max-w-md bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer shadow-lg"
              >
                <option value="en">🇬🇧 English (LTR) – Default</option>
                <option value="de">🇩🇪 Deutsch (LTR) – DIN VDE & IEC</option>
                <option value="it">🇮🇹 Italiano (LTR) – Norme CEI & IEC</option>
                <option value="ar">🇸🇾 العربية (RTL) – النمط العربي</option>
              </select>
            </div>

            {/* Current Active Language Details Badge */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between max-w-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {language === 'en' && '🇬🇧'}
                  {language === 'de' && '🇩🇪'}
                  {language === 'it' && '🇮🇹'}
                  {language === 'ar' && '🇸🇾'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {language === 'en' && 'English'}
                    {language === 'de' && 'Deutsch'}
                    {language === 'it' && 'Italiano'}
                    {language === 'ar' && 'العربية'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {language === 'ar' ? t('settings.rtlDesc', 'Right-to-Left (RTL) • IBM Plex Sans Arabic') : t('settings.ltrDesc', 'Left-to-Right (LTR) • Inter Sans')}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full uppercase">
                {language.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Account & Security Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6 max-w-2xl">
          {/* User Profile Overview */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-lg shadow-[0_0_12px_rgba(234,88,12,0.2)]">
                {currentUser?.name?.[0]?.toUpperCase() ?? <User size={20} />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  {currentUser?.name ?? "Engineer"}
                </h2>
                <p className="text-xs text-gray-400">
                  @{currentUser?.username ?? "user"}
                </p>
              </div>
              <div className="ms-auto flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  currentUser?.role === 'ADMIN'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {currentUser?.role === 'ADMIN' ? 'Administrator' : 'Engineer'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-800/80 text-sm">
              <div>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                  {t('auth.username', 'Username')}
                </span>
                <span className="text-gray-200 font-medium truncate block font-mono text-xs">
                  @{currentUser?.username ?? "—"}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                  {t('settings.credits', 'Project Credits')}
                </span>
                <span className="text-orange-400 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  {currentUser?.credits ?? 0} {t('common.credits', 'Credits')}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Profile & Email Card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <User size={18} className="text-orange-400" />
                {t('settings.profile', 'Profile Details')}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {t('settings.profileSubtitle', 'Update your personal details and contact email address.')}
              </p>
            </div>

            {/* Profile Feedback Message */}
            {profileMessage && (
              <div
                className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('settings.fullName', 'Full Name')}
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder={t('settings.fullNamePlaceholder', 'Enter your full name')}
                  className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                  required
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('settings.emailAddress', 'Email Address')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder={t('settings.emailPlaceholder', 'name@example.com')}
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all pe-10"
                    required
                  />
                  <div className="absolute inset-y-0 end-0 pe-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail size={16} />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={
                    profileUpdating ||
                    !profileName.trim() ||
                    !profileEmail.trim() ||
                    (profileName === (currentUser?.name || '') && profileEmail === (currentUser?.email || ''))
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white text-sm font-semibold shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                >
                  <Save size={15} />
                  {profileUpdating
                    ? t('settings.savingProfile', 'Saving…')
                    : t('settings.saveProfile', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Lock size={18} className="text-orange-400" />
                {t('settings.changePassword', 'Change Password')}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {t('settings.changePasswordSubtitle', 'Ensure your account is protected with a strong, secure password.')}
              </p>
            </div>

            {/* Password Feedback Message */}
            {passwordMessage && (
              <div
                className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('settings.currentPassword', 'Current Password')}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('settings.currentPasswordPlaceholder', 'Enter current password')}
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all pe-10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-gray-400 hover:text-gray-200"
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('settings.newPassword', 'New Password')}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('settings.newPasswordPlaceholder', 'Enter new password (min. 6 characters)')}
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all pe-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-gray-400 hover:text-gray-200"
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Length indicator */}
                <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                  <span
                    className={
                      newPassword.length >= 6
                        ? 'text-emerald-400 font-medium flex items-center gap-1'
                        : 'text-gray-500 flex items-center gap-1'
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 6 ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    {t('settings.passwordMinLength', 'Minimum 6 characters')}
                  </span>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  {t('settings.confirmNewPassword', 'Confirm New Password')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('settings.confirmNewPasswordPlaceholder', 'Re-enter new password')}
                    className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all pe-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-gray-400 hover:text-gray-200"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    {confirmPassword === newPassword ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        {t('settings.passwordMatch', 'Passwords match')}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <AlertCircle size={13} />
                        {t('settings.passwordMismatch', 'Passwords do not match')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={
                    passwordUpdating ||
                    !currentPassword ||
                    newPassword.length < 6 ||
                    confirmPassword !== newPassword
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white text-sm font-semibold shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                >
                  <KeyRound size={15} />
                  {passwordUpdating
                    ? t('settings.updatingPassword', 'Updating Password…')
                    : t('settings.updatePassword', 'Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

