'use client';

import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import MethodSelector from '@/components/MethodSelector';
import InfoTooltip from '@/components/InfoTooltip';
import type { Project } from '@/types';
import type { CableEntry } from './cable-schedule-types';

export interface CableDefaultsDrawerProps {
  defaultMaxCableSize: number;
  setDefaultMaxCableSize: (v: number) => void;
  defaultMethod: string;
  setDefaultMethod: (v: string) => void;
  defaultInsulation: 'PVC' | 'XLPE';
  setDefaultInsulation: (v: 'PVC' | 'XLPE') => void;
  defaultMaterial: 'copper' | 'aluminum';
  setDefaultMaterial: (v: 'copper' | 'aluminum') => void;
  defaultAmbientTemp: number;
  setDefaultAmbientTemp: (v: number) => void;
  defaultGroupingCount: number;
  setDefaultGroupingCount: (v: number) => void;
  standard?: string | null;
  applyingDefaults: boolean;
  onApplyDefaultsToAll: () => void;
}

export function CableDefaultsDrawer({
  defaultMaxCableSize,
  setDefaultMaxCableSize,
  defaultMethod,
  setDefaultMethod,
  defaultInsulation,
  setDefaultInsulation,
  defaultMaterial,
  setDefaultMaterial,
  defaultAmbientTemp,
  setDefaultAmbientTemp,
  defaultGroupingCount,
  setDefaultGroupingCount,
  standard,
  applyingDefaults,
  onApplyDefaultsToAll,
}: CableDefaultsDrawerProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end shadow-xs">
      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.maxSizeMm2', 'Max Size (mm²)')}
        </label>
        <select
          value={defaultMaxCableSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 300;
            setDefaultMaxCableSize(val);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-max-cable-size', String(val));
          }}
          className="dense-input w-full rounded text-xs py-1.5 cursor-pointer"
        >
          {[120, 150, 185, 240, 300, 400, 500].map((size) => (
            <option key={size} value={size}>{size} mm²</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.defaultMethod', 'Default Method')}
        </label>
        <MethodSelector
          value={defaultMethod}
          onChange={(method) => {
            setDefaultMethod(method);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-method', method);
          }}
          compact
          standard={standard ?? undefined}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.defaultInsulation', 'Default Insulation')}
        </label>
        <select
          value={defaultInsulation}
          onChange={(e) => {
            const val = e.target.value as 'PVC' | 'XLPE';
            setDefaultInsulation(val);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-insulation', val);
          }}
          className="dense-input w-full rounded text-xs py-1.5 cursor-pointer"
        >
          <option value="XLPE">XLPE (90°C)</option>
          <option value="PVC">PVC (70°C)</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.defaultMaterial', 'Default Material')}
        </label>
        <select
          value={defaultMaterial}
          onChange={(e) => {
            const val = e.target.value as 'copper' | 'aluminum';
            setDefaultMaterial(val);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-material', val);
          }}
          className="dense-input w-full rounded text-xs py-1.5 cursor-pointer"
        >
          <option value="copper">{t('cableSchedule.copper', 'Copper')}</option>
          <option value="aluminum">{t('cableSchedule.aluminum', 'Aluminum')}</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.ambientTemp', 'Ambient Temp (°C)')}
        </label>
        <select
          value={defaultAmbientTemp}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 30;
            setDefaultAmbientTemp(val);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-ambient-temp', String(val));
          }}
          className="dense-input w-full rounded text-xs py-1.5 cursor-pointer"
        >
          {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((temp) => (
            <option key={temp} value={temp}>{temp}°C</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider block mb-1">
          {t('cableSchedule.groupingCount', 'Grouping (cables)')}
        </label>
        <select
          value={defaultGroupingCount}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 1;
            setDefaultGroupingCount(val);
            if (typeof window !== 'undefined') localStorage.setItem('procal-default-grouping-count', String(val));
          }}
          className="dense-input w-full rounded text-xs py-1.5 cursor-pointer"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 20].map((num) => (
            <option key={num} value={num}>
              {num === 1 ? t('cableSchedule.cableUnit', '1 cable', { count: num }) : t('cableSchedule.cablesUnit', '{{count}} cables', { count: num })}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onApplyDefaultsToAll}
        disabled={applyingDefaults}
        className="w-full py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs shadow-orange-600/25 cursor-pointer"
      >
        {applyingDefaults ? (
          <>
            <RefreshCw size={12} className="animate-spin" />
            {t('common.applying', 'Applying…')}
          </>
        ) : (
          t('cableSchedule.apply', 'Apply to All Cables')
        )}
      </button>
    </div>
  );
}

export function CableSummaryCards({ cables, project }: { cables: CableEntry[]; project: Project }) {
  const { t } = useTranslation();

  return (
    <div data-tour="cable-summary" className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {[
        {
          label: t('cableSchedule.totalCables', 'Total Cables'),
          value: `${cables.length}`,
          sub: `${project.buildings.length} building${project.buildings.length > 1 ? 's' : ''}`,
          color: 'text-[var(--foreground-color,#f8fafc)]',
          accent: 'border-l-4 border-l-slate-400 dark:border-l-slate-500',
          helper: 'Total distribution and branch feeder cables across all buildings, floors, and services.'
        },
        {
          label: t('cableSchedule.totalLength', 'Total Length'),
          value: `${cables.reduce((sum, c) => sum + c.length, 0).toFixed(0)} m`,
          sub: `${(cables.reduce((sum, c) => sum + c.length, 0) / 1000).toFixed(2)} km routed`,
          color: 'text-sky-600 dark:text-sky-400',
          accent: 'border-l-4 border-l-sky-500',
          helper: 'Sum of all physical cable route lengths. Basis for bill of quantities and voltage drop analysis.'
        },
        {
          label: t('cableSchedule.needUpsize', 'Need Upsize'),
          value: `${cables.filter(c => c.changed || (c.breakerSize && c.ampacity < c.breakerSize)).length}`,
          sub: cables.filter(c => c.changed || (c.breakerSize && c.ampacity < c.breakerSize)).length > 0 ? t('cableSchedule.requiresAttention', 'Requires attention') : t('cableSchedule.allSizesOptimal', 'All sizes optimal'),
          color: cables.filter(c => c.changed || (c.breakerSize && c.ampacity < c.breakerSize)).length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400',
          accent: 'border-l-4 border-l-amber-500',
          helper: 'Circuits requiring larger conductor section to satisfy thermal ampacity or voltage drop limit.'
        },
        {
          label: t('cableSchedule.compliant', 'Compliant'),
          value: `${cables.filter(c => c.newVD !== null && !c.changed && !(c.breakerSize && c.ampacity < c.breakerSize)).length}/${cables.filter(c => c.newVD !== null).length || '—'}`,
          sub: `${Math.round((cables.filter(c => c.newVD !== null && !c.changed && !(c.breakerSize && c.ampacity < c.breakerSize)).length / (cables.filter(c => c.newVD !== null).length || 1)) * 100)}% verified`,
          color: 'text-emerald-800 dark:text-emerald-400',
          accent: 'border-l-4 border-l-emerald-500',
          helper: 'Cables that fully comply with IEC 60364-5-52 / NEC 310 ampacity and voltage drop criteria.'
        },
      ].map(({ label, value, sub, color, accent, helper }) => (
        <div key={label} className={`rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] p-4 shadow-xs hover:shadow-md transition-all ${accent}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[var(--table-header-color,#64748b)] uppercase tracking-wider flex items-center gap-1.5">
              {label}
              {helper && <InfoTooltip label={label} helper={helper} />}
            </p>
          </div>
          <p className={`text-xl font-bold font-mono tracking-tight mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-[var(--table-header-color,#64748b)] font-mono mt-0.5 font-medium">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function CableUnsavedDialog({
  saving,
  onDiscard,
  onSaveAndNavigate,
}: {
  saving: boolean;
  onDiscard: () => void;
  onSaveAndNavigate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] rounded-xl shadow-2xl p-6 w-96 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">{t('cableSchedule.unsavedChanges', 'Unsaved Changes')}</h3>
            <p className="text-sm text-[var(--table-header-color,#64748b)]">{t('cableSchedule.unsavedUpsizesDesc', "You have cable upsizes that haven't been applied.")}</p>
          </div>
        </div>
        <p className="text-sm text-[var(--foreground-color,#f8fafc)]">
          {t('cableSchedule.saveBeforeLeavingPrompt', 'Do you want to save the new cable sizes before leaving?')}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] hover:bg-[var(--card-bg)] text-[var(--foreground-color)] text-sm font-medium cursor-pointer"
          >
            {t('common.discard', 'Discard')}
          </button>
          <button
            onClick={onSaveAndNavigate}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-white-force text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-xs shadow-amber-600/25"
          >
            {saving ? t('common.saving', 'Saving…') : t('cableSchedule.saveAndLeave', 'Save & Leave')}
          </button>
        </div>
      </div>
    </div>
  );
}
