'use client';
/* eslint-disable @next/next/no-img-element */

import type React from 'react';
import { Shield } from 'lucide-react';
import { useTranslation } from '@/i18n';
import InfoTooltip from '@/components/InfoTooltip';

export interface ProjectSettingsModalProps {
  projectForm: Record<string, string>;
  setProjectForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isReadOnly: boolean;
  projectLogoUploading: boolean;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearLogo: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function ProjectSettingsModal({
  projectForm,
  setProjectForm,
  isReadOnly,
  projectLogoUploading,
  onLogoUpload,
  onClearLogo,
  onSave,
  onClose,
}: ProjectSettingsModalProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-orange-500/30 bg-gray-900/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-orange-400">{t('projects.projectSettings', 'Project Settings')}</h3>
        {isReadOnly && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1">
            <Shield size={12} />
            QA / Reviewer (Read-Only)
          </span>
        )}
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <Shield size={14} className="shrink-0 text-amber-400" />
          <span>{t('team.readOnlyNotice', 'Read-Only Mode: You have QA / Reviewer permissions. Parameters and calculations can be inspected but not modified.')}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['name', t('projects.projectName', 'Project Name *').replace(' *', ''), '', 'Project name used across reports and schedules.'],
          ['client', t('projects.client', 'Client'), '', 'Client or owner name shown on the project cover sheet.'],
          ['consultant', t('projects.consultant', 'Consultant'), '', 'Electrical consultant or designer name.'],
          ['contractor', t('projects.contractor', 'Contractor'), '', 'Main contractor name for project records.'],
          ['location', t('projects.location', 'Location'), '', 'Project site location.'],
          ['engineer', t('projects.engineer', 'Engineer'), '', 'Responsible engineer for stamping.'],
          ['voltage',
           <span key="voltage" className="inline-flex items-center gap-1.5">{t('common.voltage', 'Voltage (V)')} <InfoTooltip label="System Voltage" helper="Nominal line-to-line or line-to-neutral system voltage used for current, cable, and breaker sizing." /></span>,
           'e.g. 230 or 400',
           ''],
          ['frequency',
           <span key="frequency" className="inline-flex items-center gap-1.5">{t('common.frequency', 'Frequency (Hz)')} <InfoTooltip label="System Frequency" helper="Nominal grid frequency. 50 Hz is standard in IEC regions; must match impedance and cable tables." /></span>,
           'e.g. 50',
           ''],
          ['powerFactor',
           <span key="powerFactor" className="inline-flex items-center gap-1.5">{t('common.powerFactor', 'Power Factor')} <InfoTooltip label="Power Factor" helper="Average load power factor (cos φ). Used to convert active power (kW) into apparent power (kVA) and calculate running current." /></span>,
           'e.g. 0.85',
           ''],
          ['maxDemandFactor',
           <span key="maxDemandFactor" className="inline-flex items-center gap-1.5">{t('projects.maxDemandFactor', 'Max Demand Factor')} <InfoTooltip label="Max Demand Factor" helper="Diversity factor applied to the total connected load to estimate realistic maximum demand. IEC 61400 / local utility tables provide typical values." /></span>,
           'e.g. 0.7',
           ''],
          ['maxVoltageDropLighting',
           <span key="maxVoltageDropLighting" className="inline-flex items-center gap-1.5">{t('settings.lightingLimit', 'VD Limit — Lighting (%)')} <InfoTooltip label="Lighting Voltage Drop Limit" helper="IEC 60364-5-52 recommends ≤ 3% voltage drop for lighting circuits. Used in cable sizing and schedules." /></span>,
           '3',
           ''],
          ['maxVoltageDropPower',
           <span key="maxVoltageDropPower" className="inline-flex items-center gap-1.5">{t('settings.powerLimit', 'VD Limit — Power (%)')} <InfoTooltip label="Power Voltage Drop Limit" helper="IEC 60364-5-52 recommends ≤ 5% voltage drop for power circuits (sockets, HVAC, motors)." /></span>,
           '5',
           ''],
          [null, t('common.standard', 'Calculation Standard'), '', ''],
        ].map(([key, label, placeholder, helper]) => key === null ? (
          <div key="calculationStandard">
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <select
              value={projectForm.calculationStandard || 'IEC'}
              onChange={(e) => setProjectForm({ ...projectForm, calculationStandard: e.target.value })}
              disabled={isReadOnly}
              className="dense-input w-full rounded disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="IEC">IEC 60364 (EN)</option>
              <option value="NEMA">NEC / NEMA (US)</option>
            </select>
          </div>
        ) : (
          <div key={key as string}>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <input
              value={projectForm[key as string] || ''}
              onChange={(e) => setProjectForm({ ...projectForm, [key as string]: e.target.value })}
              placeholder={(placeholder as string) || undefined}
              disabled={isReadOnly}
              className="dense-input w-full rounded disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {helper && <p className="text-[10px] text-gray-600 mt-1 leading-snug">{helper}</p>}
          </div>
        ))}
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">{t('projects.projectLogo', 'Project Logo')}</label>
        <div className="flex items-center gap-4">
          {projectForm.logoUrl ? (
            <div className="relative">
              <img
                src={projectForm.logoUrl}
                alt="Project logo"
                className="h-20 w-auto object-contain rounded border border-gray-700 bg-white p-1"
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onClearLogo}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500"
                >
                  ×
                </button>
              )}
            </div>
          ) : isReadOnly ? (
            <p className="text-xs text-gray-500 italic">{t('projects.noLogo', 'No logo uploaded')}</p>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
              <span className="text-xs text-gray-500">
                {projectLogoUploading ? t('projects.uploading', 'Uploading…') : t('projects.clickToUpload', 'Click to upload')}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoUpload}
              />
            </label>
          )}
        </div>
        {!isReadOnly && <p className="text-[10px] text-gray-600 mt-1">{t('projects.logoConstraints', 'PNG, JPG, SVG, or WebP. Max 2MB.')}</p>}
      </div>

      <div className="flex items-center gap-2">
        {!isReadOnly ? (
          <button onClick={onSave} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
            {t('common.save', 'Save')}
          </button>
        ) : (
          <span className="px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/60 text-gray-400 text-xs font-medium flex items-center gap-1.5">
            <Shield size={13} className="text-amber-400" />
            {t('team.readOnlyActionDisabled', 'Action disabled in QA / Reviewer read-only mode')}
          </span>
        )}
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">
          {isReadOnly ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  );
}
