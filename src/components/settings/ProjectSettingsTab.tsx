"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Sliders,
  Save,
  RotateCcw,
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useTranslation } from "@/i18n";
import { COUNTRY_DEFAULTS, ROOM_TYPES, CountryConfig, AcSizingRule } from "@/lib/country-defaults";
import InfoTooltip from "@/components/InfoTooltip";

export interface ProjectSettingsTabProps {
  projectId: string;
  initialSubtab?: "general" | "engineering" | "company";
  onProjectUpdated?: () => void;
}

export function ProjectSettingsTab({
  projectId,
  initialSubtab = "general",
  onProjectUpdated,
}: ProjectSettingsTabProps) {
  const { selectedProject, mutateProject, isQA, canEdit, currentMemberRole } = useProject();
  const { t, isRtl } = useTranslation();

  const isReadOnly = isQA || !canEdit("calculator") || currentMemberRole === "QA";

  const [activeSubtab, setActiveSubtab] = useState<"general" | "engineering" | "company">(initialSubtab);

  // Sync initialSubtab if prop changes
  useEffect(() => {
    if (initialSubtab) {
      setActiveSubtab(initialSubtab);
    }
  }, [initialSubtab]);

  // Project Form State
  const [projectForm, setProjectForm] = useState<Record<string, any>>({
    name: selectedProject?.name || "",
    client: selectedProject?.client || "",
    consultant: selectedProject?.consultant || "",
    contractor: selectedProject?.contractor || "",
    location: selectedProject?.location || "",
    engineer: selectedProject?.engineer || "",
    voltage: selectedProject?.voltage ?? 400,
    frequency: selectedProject?.frequency ?? 50,
    powerFactor: selectedProject?.powerFactor ?? 0.85,
    maxDemandFactor: selectedProject?.maxDemandFactor ?? 0.8,
    maxVoltageDropLighting: selectedProject?.maxVoltageDropLighting ?? 3,
    maxVoltageDropPower: selectedProject?.maxVoltageDropPower ?? 5,
    calculationStandard: selectedProject?.calculationStandard || "IEC",
    preferredManufacturer: selectedProject?.preferredManufacturer || "MIXED",
    country: selectedProject?.country || "Syria",
    logoUrl: selectedProject?.logoUrl || "",
    notes: selectedProject?.notes || "",
  });

  // Sync when selectedProject updates
  useEffect(() => {
    if (selectedProject) {
      setProjectForm((prev) => ({
        ...prev,
        name: selectedProject.name || "",
        client: selectedProject.client || "",
        consultant: selectedProject.consultant || "",
        contractor: selectedProject.contractor || "",
        location: selectedProject.location || "",
        engineer: selectedProject.engineer || "",
        voltage: selectedProject.voltage ?? 400,
        frequency: selectedProject.frequency ?? 50,
        powerFactor: selectedProject.powerFactor ?? 0.85,
        maxDemandFactor: selectedProject.maxDemandFactor ?? 0.8,
        maxVoltageDropLighting: selectedProject.maxVoltageDropLighting ?? 3,
        maxVoltageDropPower: selectedProject.maxVoltageDropPower ?? 5,
        calculationStandard: selectedProject.calculationStandard || "IEC",
        preferredManufacturer: selectedProject.preferredManufacturer || "MIXED",
        country: selectedProject.country || "Syria",
        logoUrl: selectedProject.logoUrl || "",
        notes: selectedProject.notes || "",
      }));
      setSelectedCountry(selectedProject.country || "Syria");
    }
  }, [selectedProject]);

  // Engineering Defaults State
  const [settings, setSettings] = useState<Record<string, CountryConfig>>({});
  const [selectedCountry, setSelectedCountry] = useState(selectedProject?.country || "Syria");
  const [vdLimits, setVdLimits] = useState({
    lighting: selectedProject?.maxVoltageDropLighting ?? 3,
    power: selectedProject?.maxVoltageDropPower ?? 5,
  });

  // Company Branding State
  const [company, setCompany] = useState({ companyName: "", logoUrl: "" });
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
  const [uploadingProjectLogo, setUploadingProjectLogo] = useState(false);

  // Status & Feedback
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadSettingsAndCompany();
  }, []);

  const loadSettingsAndCompany = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.countrySettings) setSettings(data.countrySettings);
        else if (data) setSettings(data);
        if (data.company) setCompany(data.company);
      } else {
        setSettings({ ...COUNTRY_DEFAULTS });
      }
    } catch {
      setSettings({ ...COUNTRY_DEFAULTS });
    }
  };

  // --- SAVE GENERAL PROJECT SPECS ---
  const handleSaveGeneralSpecs = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setMessage(null);

    const updatedPayload = {
      ...projectForm,
      voltage: parseFloat(projectForm.voltage) || 400,
      frequency: parseFloat(projectForm.frequency) || 50,
      powerFactor: parseFloat(projectForm.powerFactor) || 0.85,
      maxDemandFactor: parseFloat(projectForm.maxDemandFactor) || 0.8,
      maxVoltageDropLighting: parseFloat(projectForm.maxVoltageDropLighting) || 3,
      maxVoltageDropPower: parseFloat(projectForm.maxVoltageDropPower) || 5,
      country: selectedCountry,
    };

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPayload),
      });

      if (res.ok) {
        const updated = await res.json();
        mutateProject((prev) => (prev ? { ...prev, ...updated } : null));
        if (onProjectUpdated) onProjectUpdated();
        setMessage({ type: "success", text: t("settings.saveSuccess", "Project specifications saved successfully") });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: err.error || t("settings.saveError", "Failed to save project specifications") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.saveError", "Failed to save project specifications") });
    } finally {
      setSaving(false);
    }
  };

  // --- SAVE ENGINEERING DEFAULTS ---
  const handleSaveEngineeringDefaults = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Save country overrides in app settings
      const currentCountrySettings = settings[selectedCountry];
      if (currentCountrySettings) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: selectedCountry, settings: currentCountrySettings }),
        });
      }

      // 2. Update project's country & voltage drop limits in project DB
      const projectPayload = {
        country: selectedCountry,
        maxVoltageDropLighting: vdLimits.lighting,
        maxVoltageDropPower: vdLimits.power,
      };

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectPayload),
      });

      if (res.ok) {
        const updated = await res.json();
        mutateProject((prev) => (prev ? { ...prev, ...updated } : null));
        setProjectForm((prev) => ({
          ...prev,
          country: selectedCountry,
          maxVoltageDropLighting: vdLimits.lighting,
          maxVoltageDropPower: vdLimits.power,
        }));
        localStorage.setItem("procal-vd-limits", JSON.stringify(vdLimits));
        if (onProjectUpdated) onProjectUpdated();
        setMessage({ type: "success", text: t("settings.saveSuccess", "Engineering defaults saved successfully") });
      } else {
        setMessage({ type: "error", text: t("settings.saveError", "Failed to save engineering defaults") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.saveError", "Failed to save engineering defaults") });
    } finally {
      setSaving(false);
    }
  };

  // --- SAVE COMPANY BRANDING ---
  const handleSaveCompanyBranding = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Save global company name & logo
      const resCompany = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });

      // 2. Save project-specific logoUrl if modified
      const resProject = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: projectForm.logoUrl || null }),
      });

      if (resCompany.ok && resProject.ok) {
        const updatedProject = await resProject.json();
        mutateProject((prev) => (prev ? { ...prev, ...updatedProject } : null));
        if (onProjectUpdated) onProjectUpdated();
        setMessage({ type: "success", text: t("settings.saveCompanySuccess", "Company & branding settings saved") });
      } else {
        setMessage({ type: "error", text: t("settings.saveError", "Failed to save branding settings") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.saveError", "Failed to save branding settings") });
    } finally {
      setSaving(false);
    }
  };

  // --- LOGO UPLOADS ---
  const handleUploadCompanyLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isReadOnly) return;
    setUploadingCompanyLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setCompany((prev) => ({ ...prev, logoUrl: data.url }));
      }
    } finally {
      setUploadingCompanyLogo(false);
    }
  };

  const handleUploadProjectLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isReadOnly) return;
    setUploadingProjectLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setProjectForm((prev) => ({ ...prev, logoUrl: data.url }));
      }
    } finally {
      setUploadingProjectLogo(false);
    }
  };

  // --- ENGINEERING DEFAULTS MUTATIONS ---
  const handleResetEngineeringDefaults = () => {
    const defaults = COUNTRY_DEFAULTS[selectedCountry];
    if (defaults) {
      setSettings((prev) => ({
        ...prev,
        [selectedCountry]: { ...defaults },
      }));
      setVdLimits({ lighting: 3, power: 5 });
      setMessage({ type: "success", text: t("settings.resetSuccess", "Settings reset to defaults") });
    }
  };

  const updateRoomDensity = (roomType: string, value: number) => {
    const current = settings[selectedCountry];
    if (!current) return;
    setSettings((prev) => ({
      ...prev,
      [selectedCountry]: {
        ...current,
        roomDensities: {
          ...current.roomDensities,
          [roomType]: value,
        },
      },
    }));
  };

  const updateAcRule = (index: number, field: keyof AcSizingRule, value: number) => {
    const current = settings[selectedCountry];
    if (!current) return;
    const newRules = [...current.acSizingRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setSettings((prev) => ({
      ...prev,
      [selectedCountry]: {
        ...current,
        acSizingRules: newRules,
      },
    }));
  };

  const addAcRule = () => {
    const current = settings[selectedCountry];
    if (!current) return;
    setSettings((prev) => ({
      ...prev,
      [selectedCountry]: {
        ...current,
        acSizingRules: [...current.acSizingRules, { maxArea: 60, btu: 36000, watts: 10548 }],
      },
    }));
  };

  const removeAcRule = (index: number) => {
    const current = settings[selectedCountry];
    if (!current || current.acSizingRules.length <= 1) return;
    const newRules = current.acSizingRules.filter((_, i) => i !== index);
    setSettings((prev) => ({
      ...prev,
      [selectedCountry]: {
        ...current,
        acSizingRules: newRules,
      },
    }));
  };

  const currentSettings = settings[selectedCountry] || COUNTRY_DEFAULTS[selectedCountry] || COUNTRY_DEFAULTS["Syria"];
  const displayReportLogo = projectForm.logoUrl || company.logoUrl;
  const displayCompanyName = company.companyName || "ProCal Engineering Suite";

  return (
    <div className="space-y-6">
      {/* Read-Only Mode Banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs shadow-xs">
          <Shield size={15} className="shrink-0 text-amber-400" />
          <span>
            {t(
              "team.readOnlyNotice",
              "Read-Only Mode: You have QA / Reviewer permissions. Parameters and calculations can be inspected but not modified."
            )}
          </span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-color,#1f2937)] pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveSubtab("general");
            setMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubtab === "general"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)]"
          }`}
        >
          <Settings size={14} />
          {t("projects.generalSpecs", "General & Electrical Specs")}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubtab("engineering");
            setMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubtab === "engineering"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)]"
          }`}
        >
          <Sliders size={14} />
          {t("settings.engineering", "Engineering Defaults")}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubtab("company");
            setMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubtab === "company"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] text-[var(--table-header-color,#9ca3af)] hover:text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)]"
          }`}
        >
          <Building2 size={14} />
          {t("settings.company", "Company & Branding")}
        </button>
      </div>

      {/* Status / Message Banner */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="ml-auto text-current opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* =========================================================================
          SUBTAB 1: GENERAL & ELECTRICAL SPECS
          ========================================================================= */}
      {activeSubtab === "general" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border-color,#1f2937)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground-color,#f8fafc)] flex items-center gap-2">
                  <FileText size={16} className="text-orange-500" />
                  {t("projects.generalSpecs", "General & Electrical Specifications")}
                </h3>
                <p className="text-xs text-[var(--table-header-color,#9ca3af)] mt-0.5">
                  {t("projects.specsSubtitle", "Project metadata, system voltages, and electrical design constraints.")}
                </p>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSaveGeneralSpecs}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                >
                  <Save size={14} />
                  {saving ? t("settings.saving", "Saving…") : t("common.save", "Save Specifications")}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.projectName", "Project Name")} *
                </label>
                <input
                  type="text"
                  value={projectForm.name || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Al-Noor Complex"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.client", "Client")}
                </label>
                <input
                  type="text"
                  value={projectForm.client || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Horizon Holdings"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.consultant", "Consultant")}
                </label>
                <input
                  type="text"
                  value={projectForm.consultant || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, consultant: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Apex Engineering"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.contractor", "Contractor")}
                </label>
                <input
                  type="text"
                  value={projectForm.contractor || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, contractor: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Gulf Builders"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.location", "Location")}
                </label>
                <input
                  type="text"
                  value={projectForm.location || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Damascus, Syria"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.engineer", "Engineer")}
                </label>
                <input
                  type="text"
                  value={projectForm.engineer || ""}
                  onChange={(e) => setProjectForm({ ...projectForm, engineer: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                  placeholder="e.g. Eng. Jihad"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1 flex items-center gap-1.5">
                  {t("common.voltage", "Voltage (V)")}
                  <InfoTooltip label="Voltage" helper="Nominal 3-phase line-to-line voltage (e.g. 400V)." />
                </label>
                <input
                  type="number"
                  value={projectForm.voltage}
                  onChange={(e) => setProjectForm({ ...projectForm, voltage: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1 flex items-center gap-1.5">
                  {t("common.frequency", "Frequency (Hz)")}
                  <InfoTooltip label="Frequency" helper="Standard grid frequency (50 Hz or 60 Hz)." />
                </label>
                <input
                  type="number"
                  value={projectForm.frequency}
                  onChange={(e) => setProjectForm({ ...projectForm, frequency: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1 flex items-center gap-1.5">
                  {t("common.powerFactor", "Power Factor (cos φ)")}
                  <InfoTooltip label="Power Factor" helper="Average design power factor (default 0.85)." />
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="1.0"
                  value={projectForm.powerFactor}
                  onChange={(e) => setProjectForm({ ...projectForm, powerFactor: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1 flex items-center gap-1.5">
                  {t("projects.maxDemandFactor", "Max Demand Factor")}
                  <InfoTooltip label="Demand Factor" helper="Overall coincident demand factor applied to total connected load." />
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={projectForm.maxDemandFactor}
                  onChange={(e) => setProjectForm({ ...projectForm, maxDemandFactor: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("common.standard", "Calculation Standard")}
                </label>
                <select
                  value={projectForm.calculationStandard || "IEC"}
                  onChange={(e) => setProjectForm({ ...projectForm, calculationStandard: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                >
                  <option value="IEC">IEC 60364 (EN)</option>
                  <option value="NEMA">NEC / NEMA (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.preferredManufacturer", "Preferred Manufacturer")}
                </label>
                <select
                  value={projectForm.preferredManufacturer || "MIXED"}
                  onChange={(e) => setProjectForm({ ...projectForm, preferredManufacturer: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60"
                >
                  <option value="MIXED">Mixed / Any</option>
                  <option value="ABB">ABB</option>
                  <option value="SCHNEIDER">Schneider Electric</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                {t("projects.notes", "Project Engineering Notes")}
              </label>
              <textarea
                value={projectForm.notes || ""}
                onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                disabled={isReadOnly}
                rows={3}
                className="dense-input w-full rounded disabled:opacity-60 text-xs"
                placeholder={t("projects.notesPlaceholder", "General project remarks, compliance assumptions, or specific client requests...")}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUBTAB 2: ENGINEERING DEFAULTS
          ========================================================================= */}
      {activeSubtab === "engineering" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground-color,#f8fafc)] flex items-center gap-2">
                <Sliders size={16} className="text-orange-500" />
                {t("settings.engineering", "Engineering Defaults & Standards")}
              </h3>
              <p className="text-xs text-[var(--table-header-color,#9ca3af)] mt-0.5">
                {t("settings.engineeringSubtitle", "Regional standards, room power densities, and AC sizing rules.")}
              </p>
            </div>

            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetEngineeringDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card-bg-subtle,rgba(17,24,39,0.5))] hover:bg-[var(--card-bg,rgba(17,24,39,0.8))] text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)] text-xs font-medium cursor-pointer transition-colors"
                >
                  <RotateCcw size={13} />
                  {t("settings.reset", "Reset to Defaults")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEngineeringDefaults}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                >
                  <Save size={13} />
                  {saving ? t("settings.saving", "Saving…") : t("settings.save", "Save Defaults")}
                </button>
              </div>
            )}
          </div>

          {/* Country Selection Card */}
          <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 space-y-2">
            <label className="block text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider">
              {t("settings.selectCountry", "Project Jurisdiction & Regional Code")}
            </label>
            <p className="text-xs text-[var(--table-header-color,#9ca3af)]">
              {t("settings.countryHelp", "Select the regional standard and design rules applied to room densities and HVAC loads.")}
            </p>
            <div className="pt-1">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={isReadOnly}
                className="dense-input w-full max-w-sm rounded font-medium disabled:opacity-60"
              >
                {Object.keys(COUNTRY_DEFAULTS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Room Densities Card */}
          {currentSettings && (
            <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-4">
              <h4 className="text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider">
                {t("settings.roomDensities", "Room Power Densities (VA/m²)")} — {selectedCountry}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ROOM_TYPES.map((room) => (
                  <div key={room.value} className="bg-[var(--card-bg-subtle,rgba(17,24,39,0.4))] p-2.5 rounded-lg border border-[var(--border-color,#1f2937)]">
                    <label className="block text-[11px] font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                      {room.label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={currentSettings.roomDensities[room.value.toLowerCase() as keyof typeof currentSettings.roomDensities] || 0}
                        onChange={(e) => updateRoomDensity(room.value.toLowerCase(), parseFloat(e.target.value) || 0)}
                        disabled={isReadOnly}
                        className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                        min="0"
                        step="5"
                      />
                      <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] shrink-0 font-mono">VA/m²</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AC Sizing Rules Card */}
          {currentSettings && (
            <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color,#1f2937)] pb-2">
                <div>
                  <h4 className="text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider">
                    {t("settings.acSizingRules", "AC Sizing Rules (BTU → Watts)")}
                  </h4>
                  <p className="text-[11px] text-[var(--table-header-color,#9ca3af)]">
                    {t("settings.acHelp", "Area thresholds and rated compressor power consumption.")}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addAcRule}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                  >
                    {t("settings.addRule", "+ Add Sizing Rule")}
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {currentSettings.acSizingRules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-[var(--card-bg-subtle,rgba(17,24,39,0.4))] p-2.5 rounded-lg border border-[var(--border-color,#1f2937)]"
                  >
                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--table-header-color,#9ca3af)] mb-0.5">
                        {t("settings.maxArea", "Max Area (m²)")}
                      </label>
                      <input
                        type="number"
                        value={rule.maxArea === Infinity || rule.maxArea == null ? "" : rule.maxArea}
                        onChange={(e) => {
                          const val = e.target.value === "" ? Infinity : parseFloat(e.target.value);
                          updateAcRule(index, "maxArea", val);
                        }}
                        disabled={isReadOnly || rule.maxArea === Infinity}
                        className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                        placeholder="∞"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--table-header-color,#9ca3af)] mb-0.5">
                        {t("settings.btu", "BTU Rating")}
                      </label>
                      <input
                        type="number"
                        value={rule.btu}
                        onChange={(e) => updateAcRule(index, "btu", parseInt(e.target.value, 10) || 0)}
                        disabled={isReadOnly}
                        className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--table-header-color,#9ca3af)] mb-0.5">
                        {t("settings.watts", "Running Watts")}
                      </label>
                      <input
                        type="number"
                        value={rule.watts}
                        onChange={(e) => updateAcRule(index, "watts", parseInt(e.target.value, 10) || 0)}
                        disabled={isReadOnly}
                        className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                      />
                    </div>

                    {!isReadOnly && currentSettings.acSizingRules.length > 1 && rule.maxArea !== Infinity && (
                      <button
                        type="button"
                        onClick={() => removeAcRule(index)}
                        className="mt-4 p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove Rule"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voltage Drop Limits Card */}
          <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-3">
            <h4 className="text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider border-b border-[var(--border-color,#1f2937)] pb-2">
              {t("settings.voltageDropLimits", "Voltage Drop Compliance Limits (IEC 60364-5-52)")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("settings.lightingLimit", "Lighting Circuits Limit (%)")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={vdLimits.lighting}
                    onChange={(e) => setVdLimits({ ...vdLimits, lighting: parseFloat(e.target.value) || 3 })}
                    disabled={isReadOnly}
                    className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                  />
                  <span className="text-xs font-mono text-[var(--table-header-color,#9ca3af)]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("settings.powerLimit", "Power & Motor Circuits Limit (%)")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="15"
                    value={vdLimits.power}
                    onChange={(e) => setVdLimits({ ...vdLimits, power: parseFloat(e.target.value) || 5 })}
                    disabled={isReadOnly}
                    className="dense-input w-full rounded font-mono text-xs disabled:opacity-60"
                  />
                  <span className="text-xs font-mono text-[var(--table-header-color,#9ca3af)]">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUBTAB 3: COMPANY & BRANDING
          ========================================================================= */}
      {activeSubtab === "company" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground-color,#f8fafc)] flex items-center gap-2">
                <Building2 size={16} className="text-orange-500" />
                {t("settings.company", "Company & Branding")}
              </h3>
              <p className="text-xs text-[var(--table-header-color,#9ca3af)] mt-0.5">
                {t("settings.brandingSubtitle", "Set your organization's logo and official corporate branding for PDF reports.")}
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSaveCompanyBranding}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
              >
                <Save size={14} />
                {saving ? t("settings.saving", "Saving…") : t("settings.saveCompany", "Save Branding")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Company Info Card */}
            <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-4">
              <h4 className="text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider border-b border-[var(--border-color,#1f2937)] pb-2">
                {t("settings.companyInfo", "Corporate Identity")}
              </h4>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("settings.companyName", "Company Name")}
                </label>
                <input
                  type="text"
                  value={company.companyName}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  disabled={isReadOnly}
                  className="dense-input w-full rounded disabled:opacity-60 text-xs"
                  placeholder={t("settings.companyNamePlaceholder", "e.g. Apex Engineering Consultants")}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("settings.companyLogo", "Company Logo (Global)")}
                </label>
                <div className="flex items-center gap-4 pt-1">
                  {company.logoUrl ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={company.logoUrl}
                        alt="Company logo"
                        className="h-16 w-auto max-w-[180px] object-contain rounded border border-slate-700 bg-white p-1 shadow-xs"
                      />
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setCompany({ ...company, logoUrl: "" })}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500 shadow-sm"
                          title="Remove logo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : isReadOnly ? (
                    <p className="text-xs text-slate-500 italic">{t("projects.noLogo", "No company logo uploaded")}</p>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-36 h-16 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-lg cursor-pointer transition-colors bg-slate-900/40">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Upload size={13} />
                        {uploadingCompanyLogo ? t("settings.uploading", "Uploading…") : t("settings.clickToUpload", "Upload Logo")}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadCompanyLogo}
                      />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-[var(--table-header-color,#9ca3af)] mt-1.5">
                  {t("settings.logoFormats", "PNG, JPG, SVG, or WebP. Max 2MB.")}
                </p>
              </div>

              {/* Project Specific Logo */}
              <div className="border-t border-[var(--border-color,#1f2937)] pt-3">
                <label className="block text-xs font-medium text-[var(--table-header-color,#9ca3af)] mb-1">
                  {t("projects.projectLogo", "Project-Specific Logo (Overrides company logo for this project)")}
                </label>
                <div className="flex items-center gap-4 pt-1">
                  {projectForm.logoUrl ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={projectForm.logoUrl}
                        alt="Project logo"
                        className="h-16 w-auto max-w-[180px] object-contain rounded border border-slate-700 bg-white p-1 shadow-xs"
                      />
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setProjectForm({ ...projectForm, logoUrl: "" })}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500 shadow-sm"
                          title="Remove project logo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : isReadOnly ? (
                    <p className="text-xs text-slate-500 italic">{t("projects.noLogo", "No project logo uploaded")}</p>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-36 h-16 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-lg cursor-pointer transition-colors bg-slate-900/40">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Upload size={13} />
                        {uploadingProjectLogo ? t("settings.uploading", "Uploading…") : t("projects.clickToUpload", "Project Logo")}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadProjectLogo}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Live Branding Preview Card */}
            <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,rgba(17,24,39,0.7))] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-color,#1f2937)] pb-2">
                <h4 className="text-xs font-bold text-[var(--foreground-color,#f8fafc)] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  {t("settings.brandingPreview", "Live Report Header Preview")}
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">PDF & Print Output</span>
              </div>

              <div className="border border-slate-700 rounded-lg p-3 bg-slate-950 shadow-inner">
                {/* Simulated Report Header */}
                <div className="w-full border-b-2 border-slate-800 bg-slate-900 text-white p-3 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-black uppercase text-white tracking-tight">
                        {projectForm.name || selectedProject?.name || "Project Name"}
                      </h5>
                      <p className="text-[10px] font-semibold text-slate-300">
                        CABLE SIZING &amp; INSTALLATION SCHEDULE
                      </p>
                      <p className="text-[9px] text-slate-400">
                        ProCal — Low-voltage Electrical design, Solved | IEC 60364 &amp; BS 7671 / NEC Compliant
                      </p>
                    </div>

                    <div className="text-right text-[9px] font-mono text-slate-300 flex flex-col items-end shrink-0">
                      {displayReportLogo ? (
                        <div className="flex items-center justify-end max-h-9 max-w-[120px] mb-1 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayReportLogo}
                            alt="Preview logo"
                            className="max-h-9 max-w-[120px] w-auto h-auto object-contain bg-white/95 p-0.5 rounded shadow-xs"
                          />
                        </div>
                      ) : (
                        <div className="font-bold text-[11px] text-amber-400 mb-0.5">
                          {displayCompanyName}
                        </div>
                      )}
                      <div>
                        Ref: <span className="font-semibold text-white">PRJ-{projectId.slice(-6).toUpperCase()}</span>
                      </div>
                      <div>
                        Date: <span className="font-semibold text-white">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-2 text-center italic">
                  {displayReportLogo
                    ? t("settings.logoAttached", "Your logo is rendered on every schedule page and cover sheet.")
                    : t("settings.textFallback", "No logo uploaded — company name renders as standard text mark.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
