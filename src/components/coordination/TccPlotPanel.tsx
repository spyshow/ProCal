'use client';

import { Sparkles, Zap } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type {
  BreakerAlternativeSuggestion,
  BreakerCurveSettings,
  CoordinationResult,
  CurvePoint,
} from '@/lib/calculations/selectivity';

export interface TccPlotPanelProps {
  result: CoordinationResult;
  alternativeSuggestions: BreakerAlternativeSuggestion[];
  applyingId: string | null;
  onApplyAutoTune: () => void;
  onApplySuggestion: (sug: BreakerAlternativeSuggestion) => void;
  upstream: BreakerCurveSettings;
  downstream: BreakerCurveSettings;
  cableSize: number;
  cableInsulation: 'XLPE' | 'PVC';
  faultCurrent: number;
  cableDamageCurve: CurvePoint[];
  upstreamCurve: CurvePoint[];
  downstreamCurve: CurvePoint[];
}

export function TccPlotPanel({
  result,
  alternativeSuggestions,
  applyingId,
  onApplyAutoTune,
  onApplySuggestion,
  upstream,
  downstream,
  cableSize,
  cableInsulation,
  faultCurrent,
  cableDamageCurve,
  upstreamCurve,
  downstreamCurve,
}: TccPlotPanelProps) {
  const { t } = useTranslation();

  const svgWidth = 720;
  const svgHeight = 480;
  const plotLeft = 80;
  const plotTop = 35;
  const plotWidth = svgWidth - plotLeft - 35;
  const plotHeight = svgHeight - plotTop - 55;

  const logMinI = Math.log10(10);
  const logMaxI = Math.log10(Math.max(50000, faultCurrent * 1.5));
  const logMinT = Math.log10(0.01);
  const logMaxT = Math.log10(10000);

  const mapX = (current: number) => {
    const clampedI = Math.max(10, Math.min(100000, current));
    return plotLeft + ((Math.log10(clampedI) - logMinI) / (logMaxI - logMinI)) * plotWidth;
  };

  const mapY = (time: number) => {
    const clampedT = Math.max(0.01, Math.min(10000, time));
    return plotTop + plotHeight - ((Math.log10(clampedT) - logMinT) / (logMaxT - logMinT)) * plotHeight;
  };

  const toPath = (points: CurvePoint[]) => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(p.current).toFixed(1)},${mapY(p.time).toFixed(1)}`).join(' ');
  };

  const currentGridLines = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const timeGridLines = [0.01, 0.1, 1, 10, 60, 300, 3600, 10000];

  const formatTccTimeTick = (tVal: number): string => {
    if (tVal >= 3600) {
      const hours = tVal / 3600;
      return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    }
    if (tVal >= 60) {
      const mins = tVal / 60;
      return Number.isInteger(mins) ? `${mins}m` : `${mins.toFixed(1)}m`;
    }
    return `${tVal}s`;
  };

  return (
    <div className="lg:col-span-2 space-y-4">
      {/* Recommendations Banner (Shown when non-selective) */}
      {result.status !== 'FULL' && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-orange-400" />
              <h2 className="text-sm font-bold text-[var(--foreground-color)]">
                Alternative Breaker & Coordination Solutions
              </h2>
            </div>
            <button
              onClick={onApplyAutoTune}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Zap size={13} />
              Auto-Tune for Full Selectivity
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {alternativeSuggestions.slice(0, 2).map((sug) => (
              <div key={sug.id} className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex flex-col justify-between gap-2 hover:border-orange-500/40 transition-all shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 dark:text-orange-400 border border-orange-500/20">
                      {sug.badge}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-600/50 dark:border-emerald-500/40 shadow-xs">✓ FULL</span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--foreground-color)]">{sug.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-snug">{sug.description}</p>
                  {sug.suggestedModel && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-600 dark:text-sky-400 pt-0.5 flex-wrap">
                      <Zap size={11} className="text-sky-500 shrink-0" />
                      <span>{sug.suggestedModel}</span>
                      {sug.fallbackType === 'OTHER_FAMILY' && (
                        <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          Other Family
                        </span>
                      )}
                      {sug.fallbackType === 'OTHER_BRAND' && (
                        <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-600/40 dark:border-amber-500/30">
                          Alt Brand
                        </span>
                      )}
                      {sug.fallbackType === 'GENERIC_SPEC' && (
                        <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                          Generic Spec
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  disabled={Boolean(applyingId)}
                  onClick={() => onApplySuggestion(sug)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 text-white text-white-force font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap size={12} className={applyingId === sug.id ? 'animate-spin' : ''} />
                  <span>{applyingId === sug.id ? 'Saving to Project...' : sug.actionText || 'Apply & Save to Project'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TCC SVG Chart */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider">
            {t('coordination.tccTitle', 'Time-Current Characteristic (TCC) — Log-Log Scale')}
          </h2>
          <div className="text-xs text-[var(--text-muted)] font-mono">
            IEC 60947-2 &bull; IEC 60898 &bull; IEC 60364-5-54
          </div>
        </div>

        <div className="bg-[var(--card-bg-subtle)] rounded-xl border border-[var(--border-color)] p-2 overflow-x-auto flex justify-center">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" className="select-none font-mono text-[9px]">
            <rect
              x={plotLeft}
              y={plotTop}
              width={plotWidth}
              height={plotHeight}
              fill="var(--card-bg)"
              stroke="var(--border-color)"
              strokeWidth="1"
            />

            {currentGridLines.map((iVal) => {
              const x = mapX(iVal);
              return (
                <g key={`grid-x-${iVal}`}>
                  <line
                    x1={x}
                    y1={plotTop}
                    x2={x}
                    y2={plotTop + plotHeight}
                    stroke="var(--border-color)"
                    strokeDasharray="2,2"
                  />
                  <text x={x} y={plotTop + plotHeight + 16} fill="currentColor" className="text-[var(--text-muted)]" textAnchor="middle">
                    {iVal >= 1000 ? `${iVal / 1000}k` : iVal}
                  </text>
                </g>
              );
            })}

            {timeGridLines.map((tVal) => {
              const y = mapY(tVal);
              return (
                <g key={`grid-y-${tVal}`}>
                  <line
                    x1={plotLeft}
                    y1={y}
                    x2={plotLeft + plotWidth}
                    y2={y}
                    stroke="var(--border-color)"
                    strokeDasharray="2,2"
                  />
                  <text x={plotLeft - 8} y={y + 3} fill="currentColor" className="text-[var(--text-muted)]" textAnchor="end">
                    {formatTccTimeTick(tVal)}
                  </text>
                </g>
              );
            })}

            <text
              x={plotLeft + plotWidth / 2}
              y={plotTop + plotHeight + 35}
              fill="currentColor"
              textAnchor="middle"
              className="text-[var(--foreground-color)] font-sans text-[10px] font-semibold tracking-wider"
            >
              {t('coordination.currentAmperes', 'Current (Amperes) — Logarithmic Scale')}
            </text>

            <path
              d={toPath(cableDamageCurve)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="4,4"
            />
            <path
              d={toPath(upstreamCurve)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <path
              d={toPath(downstreamCurve)}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
            />
            <line
              x1={mapX(faultCurrent)}
              y1={plotTop}
              x2={mapX(faultCurrent)}
              y2={plotTop + plotHeight}
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
            <text
              x={mapX(faultCurrent) + 4}
              y={plotTop + 14}
              fill="#ef4444"
              className="font-bold text-[9px]"
            >
              Isc: {(faultCurrent / 1000).toFixed(1)}kA
            </text>
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--card-bg-subtle)] border border-[var(--border-color)] p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[#38bdf8] inline-block"></span>
            <span className="text-[var(--foreground-color)] font-medium">Upstream ({upstream.model || `${upstream.inRating}A`})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[#f97316] inline-block"></span>
            <span className="text-[var(--foreground-color)] font-medium">Downstream ({downstream.model || `${downstream.inRating}A`})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[#ef4444] inline-block border-b border-dashed border-red-500"></span>
            <span className="text-[var(--text-muted)]">Cable Damage ({cableSize} mm² {cableInsulation})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
