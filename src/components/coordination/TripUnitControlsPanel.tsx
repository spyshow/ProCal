'use client';

import type React from 'react';
import type { BreakerCurveSettings, CoordinationResult } from '@/lib/calculations/selectivity';

export interface TripUnitControlsPanelProps {
  upstreamFeederLabel: string;
  downstreamFeederLabel: string;
  upstream: BreakerCurveSettings;
  setUpstream: React.Dispatch<React.SetStateAction<BreakerCurveSettings>>;
  downstream: BreakerCurveSettings;
  setDownstream: React.Dispatch<React.SetStateAction<BreakerCurveSettings>>;
  result: CoordinationResult;
  cableSize: number;
  setCableSize: (v: number) => void;
  cableRuns: number;
  setCableRuns: (v: number) => void;
  faultCurrent: number;
  setFaultCurrent: (v: number) => void;
}

export function TripUnitControlsPanel({
  upstreamFeederLabel,
  downstreamFeederLabel,
  upstream,
  setUpstream,
  downstream,
  setDownstream,
  result,
  cableSize,
  setCableSize,
  cableRuns,
  setCableRuns,
  faultCurrent,
  setFaultCurrent,
}: TripUnitControlsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Upstream Breaker Card */}
      <div className="rounded-xl border border-sky-500/30 bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-sky-500" />
            <h2 className="text-sm font-bold text-sky-600 dark:text-sky-400">
              Upstream ({upstreamFeederLabel})
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30">
            In = {upstream.inRating}A ({upstream.category || 'MCCB'})
          </span>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] truncate" title={upstream.model}>
          {upstream.model || 'Standard Electronic Trip Unit'}
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label htmlFor="upstream-ir" className="text-[var(--text-muted)] flex justify-between">
              <span>Ir (A)</span>
              <span className="text-[var(--text-muted)] font-mono">{(upstream.ir / upstream.inRating).toFixed(2)}x</span>
            </label>
            <input
              id="upstream-ir"
              type="number"
              value={upstream.ir}
              onChange={(e) => setUpstream({ ...upstream, ir: parseFloat(e.target.value) || 0 })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="upstream-tr" className="text-[var(--text-muted)]">tr (s)</label>
            <input
              id="upstream-tr"
              type="number"
              step="0.5"
              value={upstream.tr}
              onChange={(e) => setUpstream({ ...upstream, tr: parseFloat(e.target.value) || 0 })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="upstream-isd" className="text-[var(--text-muted)] flex justify-between">
              <span>Isd (A)</span>
              <span className="text-[var(--text-muted)] font-mono">{upstream.isd ? `${(upstream.isd / upstream.ir).toFixed(1)}x` : '—'}</span>
            </label>
            <input
              id="upstream-isd"
              type="number"
              value={upstream.isd ?? ''}
              onChange={(e) => setUpstream({ ...upstream, isd: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="upstream-tsd" className="text-[var(--text-muted)]">tsd (s)</label>
            <input
              id="upstream-tsd"
              type="number"
              step="0.01"
              value={upstream.tsd ?? ''}
              onChange={(e) => setUpstream({ ...upstream, tsd: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="upstream-ii" className="text-[var(--text-muted)]">Ii (A)</label>
            <input
              id="upstream-ii"
              type="number"
              value={upstream.ii ?? ''}
              onChange={(e) => setUpstream({ ...upstream, ii: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="upstream-i2t" className="text-[var(--text-muted)]">I²t Curve</label>
            <select
              id="upstream-i2t"
              value={upstream.i2t ? 'on' : 'off'}
              onChange={(e) => setUpstream({ ...upstream, i2t: e.target.value === 'on' })}
              className="dense-input w-full rounded font-mono"
            >
              <option value="off">OFF (Flat)</option>
              <option value="on">ON (Inverse)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Downstream Breaker Card */}
      <div className="rounded-xl border border-orange-500/30 bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <h2 className="text-sm font-bold text-orange-500 dark:text-orange-400">
              Downstream ({downstreamFeederLabel})
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/30">
            In = {downstream.inRating}A ({downstream.category || 'MCCB'})
          </span>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] truncate" title={downstream.model}>
          {downstream.model || 'Standard Trip Unit'}
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label htmlFor="downstream-ir" className="text-[var(--text-muted)] flex justify-between">
              <span>Ir (A)</span>
              <span className="text-[var(--text-muted)] font-mono">{(downstream.ir / downstream.inRating).toFixed(2)}x</span>
            </label>
            <input
              id="downstream-ir"
              type="number"
              value={downstream.ir}
              onChange={(e) => setDownstream({ ...downstream, ir: parseFloat(e.target.value) || 0 })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="downstream-tr" className="text-[var(--text-muted)]">tr (s)</label>
            <input
              id="downstream-tr"
              type="number"
              step="0.5"
              value={downstream.tr}
              onChange={(e) => setDownstream({ ...downstream, tr: parseFloat(e.target.value) || 0 })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="downstream-isd" className="text-[var(--text-muted)] flex justify-between">
              <span>Isd (A)</span>
              <span className="text-[var(--text-muted)] font-mono">{downstream.isd ? `${(downstream.isd / downstream.ir).toFixed(1)}x` : '—'}</span>
            </label>
            <input
              id="downstream-isd"
              type="number"
              value={downstream.isd ?? ''}
              onChange={(e) => setDownstream({ ...downstream, isd: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="downstream-tsd" className="text-[var(--text-muted)]">tsd (s)</label>
            <input
              id="downstream-tsd"
              type="number"
              step="0.01"
              value={downstream.tsd ?? ''}
              onChange={(e) => setDownstream({ ...downstream, tsd: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="downstream-ii" className="text-[var(--text-muted)]">Ii (A)</label>
            <input
              id="downstream-ii"
              type="number"
              value={downstream.ii ?? ''}
              onChange={(e) => setDownstream({ ...downstream, ii: parseFloat(e.target.value) || undefined })}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="downstream-i2t" className="text-[var(--text-muted)]">I²t Curve</label>
            <select
              id="downstream-i2t"
              value={downstream.i2t ? 'on' : 'off'}
              onChange={(e) => setDownstream({ ...downstream, i2t: e.target.value === 'on' })}
              className="dense-input w-full rounded font-mono"
            >
              <option value="off">OFF (Flat)</option>
              <option value="on">ON (Inverse)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fault & Cable Card */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
        <h2 className="text-sm font-semibold text-[var(--foreground-color)] flex items-center justify-between">
          <span>Cable & Fault Parameters</span>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${
              result.cableDamageOk
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/50 dark:border-emerald-500/40'
                : 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-600/50 dark:border-rose-500/40'
            }`}
          >
            {result.cableDamageOk ? '✓ Cable Protected' : '✗ Thermal Damage Risk'}
          </span>
        </h2>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label htmlFor="cable-size" className="text-[var(--text-muted)]">Cable Size (mm²)</label>
            <input
              id="cable-size"
              type="number"
              value={cableSize}
              onChange={(e) => setCableSize(parseFloat(e.target.value) || 10)}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="cable-runs" className="text-[var(--text-muted)]">Runs</label>
            <input
              id="cable-runs"
              type="number"
              min={1}
              value={cableRuns}
              onChange={(e) => setCableRuns(Math.max(1, parseInt(e.target.value) || 1))}
              className="dense-input w-full rounded font-mono"
            />
          </div>
          <div>
            <label htmlFor="fault-isc" className="text-[var(--text-muted)]">Fault Isc (A)</label>
            <input
              id="fault-isc"
              type="number"
              value={faultCurrent}
              onChange={(e) => setFaultCurrent(parseInt(e.target.value) || 15000)}
              className="dense-input w-full rounded font-mono"
            />
          </div>
        </div>

        {result.overlapDetails && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed italic bg-[var(--card-bg-subtle)] p-2.5 rounded-lg border border-[var(--border-color)]">
            {result.overlapDetails}
          </p>
        )}
      </div>
    </div>
  );
}
