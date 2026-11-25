'use client';

import { useState, useEffect } from 'react';
import type { Project } from '@/types';

export interface CableEntry {
  id: string;
  name: string;
  cableName: string;
  building: string;
  floor: number;
  length: number;
  cableSize: number;
  parallelRuns: number;
  formattedSize: string;
  current: number;
  isThreePhase: boolean;
  assignedPhase: number | null;
  phaseCurrent: [number, number, number];
  neutralCurrent: number;
  unbalancePct: number;
  imbalanced: boolean;
  newCableSize: number | null;
  newParallelRuns: number;
  newFormattedSize: string;
  newVD: number | null;
  changed: boolean;
  method: string;
  insulation: 'PVC' | 'XLPE';
  material: 'copper' | 'aluminum';
  ambientTemp: number;
  groupingCount: number;
  ampacity: number;
  singleAmpacity: number;
  isOverloaded: boolean;
  breakerSize?: number;
  kind: 'floor' | 'building' | 'sdb' | 'incomer';
  /** True for lighting-classified rows (apartments / light loads) — checked
   *  against the lighting ΔV limit, matching the VD schedule & reports. */
  isLighting: boolean;
  /** The project's ΔV limit this row is evaluated against. */
  vdLimit: number;
  /** ΔV of the INSTALLED cable at design current, before any upsize proposal. */
  installedVd: number | null;
  /** True when the installed cable's ΔV exceeds this row's vdLimit. */
  vdFail: boolean;
}

/**
 * Resolve the per-project voltage-drop limits, matching the reports/VD
 * schedule (which read project.maxVoltageDropLighting/Power). The legacy
 * localStorage override only applies when the project has no limit stored.
 */
export function resolveVdLimits(project: Project | null): { lighting: number; power: number } {
  let saved: { lighting?: number; power?: number } | null = null;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('procal-vd-limits') : null;
    if (raw) saved = JSON.parse(raw) as { lighting?: number; power?: number };
  } catch {
    // ignore malformed saved data
  }
  return {
    lighting: project?.maxVoltageDropLighting ?? saved?.lighting ?? 3,
    power: project?.maxVoltageDropPower ?? saved?.power ?? 5,
  };
}

/** Lighting classification mirroring aggregateVoltageDropRows (reports). */
export function isLightingItem(
  type: string | null | undefined,
  name: string | null | undefined,
  category: string | null | undefined
): boolean {
  return (
    type === 'APARTMENT' ||
    (name || '').toLowerCase().includes('light') ||
    (category || '').toLowerCase().includes('light')
  );
}

export function CableLengthInput({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (newVal: number) => void;
  ariaLabel?: string;
}) {
  const [localVal, setLocalVal] = useState<string>(() => String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleCommit = () => {
    const parsed = parseFloat(localVal);
    if (Number.isNaN(parsed)) {
      setLocalVal(String(value));
      return;
    }
    const clamped = Math.max(1, Math.min(1000, Math.round(parsed * 10) / 10));
    setLocalVal(String(clamped));
    if (clamped !== value) {
      onCommit(clamped);
    }
  };

  return (
    <div className="inline-flex items-center justify-center gap-1 bg-[var(--input-bg)] border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 rounded-md px-2 py-0.5 focus-within:border-orange-500/60 focus-within:ring-1 focus-within:ring-orange-500/30 transition-all shadow-2xs">
      <input
        type="number"
        aria-label={ariaLabel}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setLocalVal(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-12 bg-transparent text-center text-xs font-mono font-medium text-[var(--foreground-color,#f8fafc)] focus:outline-none"
        min="1"
        max="1000"
        step="1"
      />
      <span className="text-[10px] text-[var(--table-header-color,#64748b)] font-medium select-none">m</span>
    </div>
  );
}
