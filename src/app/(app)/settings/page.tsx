'use client';

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
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
  Palette,
  Save,
  Sliders,
  Zap,
  Building2,
} from 'lucide-react';
import { useTranslation, SupportedLanguage } from '@/i18n';
import { useUser } from '@/context/UserContext';
import { useProject } from '@/context/ProjectContext';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import InfoTooltip from '@/components/InfoTooltip';

type SettingsTab = 'appearance' | 'language' | 'account' | 'engineering';

export default function SettingsPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();
  const { user: currentUser, refreshUser } = useUser();
  const { selectedProject, selectedProjectId, selectProject, mutateProject } = useProject();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

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

  // Engineering / Voltage Drop Limits DB state
  const [projectList, setProjectList] = useState<{ id: string; name: string }[]>([]);
  const [vdForm, setVdForm] = useState({
    lighting: selectedProject?.maxVoltageDropLighting ?? 3,
    power: selectedProject?.maxVoltageDropPower ?? 5,
    voltage: selectedProject?.voltage ?? 400,
    frequency: selectedProject?.frequency ?? 50,
    powerFactor: selectedProject?.powerFactor ?? 0.85,
    maxDemandFactor: selectedProject?.maxDemandFactor ?? 0.8,
    calculationStandard: selectedProject?.calculationStandard || 'IEC',
  });
  const [vdSaving, setVdSaving] = useState(false);
  const [vdMessage, setVdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync vdForm when selectedProject changes
  useEffect(() => {
    if (selectedProject) {
      setVdForm({
        lighting: selectedProject.maxVoltageDropLighting ?? 3,
        power: selectedProject.maxVoltageDropPower ?? 5,
        voltage: selectedProject.voltage ?? 400,
        frequency: selectedProject.frequency ?? 50,
        powerFactor: selectedProject.powerFactor ?? 0.85,
        maxDemandFactor: selectedProject.maxDemandFactor ?? 0.8,
        calculationStandard: selectedProject.calculationStandard || 'IEC',
      });
    }
  }, [selectedProject]);

  // Load project list if needed
  useEffect(() => {
    if (activeTab === 'engineering' && projectList.length === 0) {
      fetch('/api/projects?all=true')
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : (data.projects ?? []);
          const mapped = list.map((p: any) => ({ id: p.id, name: p.name }));
          setProjectList(mapped);
          if (!selectedProjectId && mapped.length > 0) {
            selectProject(mapped[0].id);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, projectList.length, selectedProjectId, selectProject]);

  const handleSaveVdLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setVdSaving(true);
    setVdMessage(null);

    const payload = {
      maxVoltageDropLighting: parseFloat(String(vdForm.lighting)) || 3,
      maxVoltageDropPower: parseFloat(String(vdForm.power)) || 5,
      voltage: parseFloat(String(vdForm.voltage)) || 400,
      frequency: parseFloat(String(vdForm.frequency)) || 50,
      powerFactor: parseFloat(String(vdForm.powerFactor)) || 0.85,
      maxDemandFactor: parseFloat(String(vdForm.maxDemandFactor)) || 0.8,
      calculationStandard: vdForm.calculationStandard || 'IEC',
    };

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        mutateProject((prev) => (prev ? { ...prev, ...updated } : null));
        // Keep localStorage synced as legacy fallback
        localStorage.setItem(
          'procal-vd-limits',
          JSON.stringify({ lighting: payload.maxVoltageDropLighting, power: payload.maxVoltageDropPower })
        );
        setVdMessage({
          type: 'success',
          text: t('settings.vdSaveSuccess', 'Voltage drop limits and engineering standards saved to project database.'),
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setVdMessage({
          type: 'error',
          text: err.error || t('settings.vdSaveError', 'Failed to save voltage drop limits.'),
        });
      }
    } catch {
      setVdMessage({
        type: 'error',
        text: t('settings.vdSaveError', 'Failed to save voltage drop limits.'),
      });
    } finally {
      setVdSaving(false);
    }
  };

  useEffect(() => {
    // Support direct tab linking via ?tab=...
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'account' || tabParam === 'security') {
        setActiveTab('account');
      } else if (tabParam === 'engineering' || tabParam === 'settings' || tabParam === 'project') {
        setActiveTab('engineering');
      } else if (tabParam === 'company') {
        router.replace(selectedProjectId ? `/projects/${selectedProjectId}?tab=company` : '/projects');
      } else if (tabParam === 'team' || tabParam === 'activity' || tabParam === 'audit' || tabParam === 'qa' || tabParam === 'review') {
        const targetTab = tabParam === 'audit' ? 'activity' : tabParam === 'review' ? 'qa' : tabParam;
        router.replace(selectedProjectId ? `/projects/${selectedProjectId}?tab=${targetTab}` : '/projects');
      } else if (tabParam === 'language') {
        setActiveTab('language');
      } else if (tabParam === 'appearance' || tabParam === 'theme') {
        setActiveTab('appearance');
      }
    }
  }, [selectedProjectId, router]);

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

  return (
    <div className="p-3 sm:p-5 space-y-6 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings size={22} className="text-orange-500" />
            {t('settings.title', 'Settings')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('settings.userSubtitle', 'Manage your theme appearance, language preferences, and account security')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-color,#1f2937)] overflow-x-auto custom-scrollbar">
        {([
          { key: 'appearance' as const, label: t('theme.title', 'Appearance & Theme'), icon: Palette },
          { key: 'language' as const, label: t('common.language', 'Language & RTL'), icon: Globe },
          { key: 'account' as const, label: t('settings.account', 'Account & Security'), icon: Shield },
          { key: 'engineering' as const, label: t('settings.engineeringStandards', 'Voltage Drop & Standards'), icon: Sliders },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Appearance & Theme Settings Tab */}
      {activeTab === 'appearance' && (
        <AppearanceTab />
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

      {/* Engineering Standards & Voltage Drop Tab */}
      {activeTab === 'engineering' && (
        <div className="space-y-6 max-w-3xl">
          {/* Project Header / Selector */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {selectedProject ? selectedProject.name : t('settings.noProjectSelected', 'No Project Selected')}
                  </h2>
                  {selectedProject?.calculationStandard && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                      {selectedProject.calculationStandard}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedProject
                    ? `${selectedProject.client || 'ProCal Client'} • ${selectedProject.location || 'Standard Site'}`
                    : t('settings.selectProjectDesc', 'Select an active project below to inspect and customize database-level engineering limits')}
                </p>
              </div>
            </div>

            {projectList.length > 1 && (
              <div className="w-full sm:w-auto">
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => selectProject(e.target.value || null)}
                  className="w-full sm:w-auto bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-lg px-3 py-2 text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="" disabled>{t('settings.selectProject', 'Switch Project…')}</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!selectedProjectId ? (
            <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/40 text-center space-y-3">
              <p className="text-sm text-gray-400">
                {t('settings.pleaseSelectProject', 'Please select an existing project to configure its voltage drop limits and electrical design parameters.')}
              </p>
              <button
                type="button"
                onClick={() => router.push('/projects')}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors"
              >
                {t('projects.title', 'Go to Projects')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveVdLimits} className="space-y-6">
              {/* Feedback Message */}
              {vdMessage && (
                <div
                  className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 ${
                    vdMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}
                >
                  {vdMessage.type === 'success' ? (
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  )}
                  <span>{vdMessage.text}</span>
                </div>
              )}

              {/* Voltage Drop Limits Card */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Zap size={18} className="text-orange-400" />
                    {t('settings.vdLimitsTitle', 'Voltage Drop Compliance Limits')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {t(
                      'settings.vdLimitsSubtitle',
                      'Configure maximum allowable voltage drop percentages. These values are saved directly to the database and govern calculations in Cable Sizing, Riser, SLD, and verification reports.'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      {t('settings.lightingLimit', 'Max Voltage Drop – Lighting (%)')}
                      <InfoTooltip
                        label="Lighting Voltage Drop"
                        helper="Maximum allowable percentage voltage drop for lighting circuits. Recommended standard: IEC 60364-5-52 Table G.52.1 specifies 3%."
                      />
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="20"
                        value={vdForm.lighting}
                        onChange={(e) =>
                          setVdForm({ ...vdForm, lighting: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all pe-10"
                        required
                      />
                      <span className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-xs font-mono text-gray-400 pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {t('settings.iecLightingDefault', 'IEC 60364-5-52 default: 3.0%')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      {t('settings.powerLimit', 'Max Voltage Drop – Power & Other (%)')}
                      <InfoTooltip
                        label="Power Voltage Drop"
                        helper="Maximum allowable percentage voltage drop for power, motor, and general circuits. Recommended standard: IEC 60364-5-52 specifies 5%; NEC 210.19 recommends 5% total."
                      />
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="20"
                        value={vdForm.power}
                        onChange={(e) =>
                          setVdForm({ ...vdForm, power: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all pe-10"
                        required
                      />
                      <span className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-xs font-mono text-gray-400 pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {t('settings.iecPowerDefault', 'IEC 60364-5-52 default: 5.0%')}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-xs text-gray-400 flex items-start gap-2 mt-2">
                  <span className="text-orange-400 font-bold shrink-0">ℹ</span>
                  <span>
                    {t(
                      'settings.vdNote',
                      'Values updated here take immediate precedence across all calculators. A local browser fallback copy is kept in sync for offline resilience.'
                    )}
                  </span>
                </div>
              </div>

              {/* System Electrical Baseline Card */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sliders size={18} className="text-orange-400" />
                    {t('settings.systemBaseline', 'Electrical System Parameters')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('settings.systemBaselineSubtitle', 'Nominal project operating parameters used as baseline for load balancing and sizing')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      {t('projects.voltage', 'Nominal Voltage (V)')}
                    </label>
                    <input
                      type="number"
                      value={vdForm.voltage}
                      onChange={(e) =>
                        setVdForm({ ...vdForm, voltage: parseFloat(e.target.value) || 400 })
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      {t('projects.frequency', 'Frequency (Hz)')}
                    </label>
                    <select
                      value={vdForm.frequency}
                      onChange={(e) =>
                        setVdForm({ ...vdForm, frequency: parseFloat(e.target.value) || 50 })
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all cursor-pointer"
                    >
                      <option value={50}>50 Hz (IEC / BS)</option>
                      <option value={60}>60 Hz (NEC / UL)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      {t('common.standard', 'Calculation Standard')}
                    </label>
                    <select
                      value={vdForm.calculationStandard}
                      onChange={(e) =>
                        setVdForm({ ...vdForm, calculationStandard: e.target.value })
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all cursor-pointer"
                    >
                      <option value="IEC">IEC 60364 / 60909</option>
                      <option value="NEC">NEC NFPA 70</option>
                      <option value="BS">BS 7671</option>
                      <option value="DIN">DIN VDE 0100</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      {t('projects.powerFactor', 'Power Factor (cos φ)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="1.0"
                      value={vdForm.powerFactor}
                      onChange={(e) =>
                        setVdForm({ ...vdForm, powerFactor: parseFloat(e.target.value) || 0.85 })
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      {t('projects.demandFactor', 'Max Demand Factor')}
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="1.0"
                      value={vdForm.maxDemandFactor}
                      onChange={(e) =>
                        setVdForm({ ...vdForm, maxDemandFactor: parseFloat(e.target.value) || 0.8 })
                      }
                      className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white rounded-xl px-4 py-2.5 text-sm font-mono font-medium outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={vdSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white text-sm font-semibold shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                >
                  <Save size={15} />
                  {vdSaving
                    ? t('settings.savingVdLimits', 'Saving to Database…')
                    : t('settings.saveVdLimits', 'Save Engineering Limits')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

