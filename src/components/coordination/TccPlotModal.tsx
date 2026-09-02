'use client';

import { useMemo } from 'react';
import { X, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Lightbulb, Sparkles, ArrowUpRight, Zap } from 'lucide-react';
import {
  generateCurvePoints,
  generateCableDamageCurve,
  type BreakerCurveSettings,
  type CurvePoint,
  type BreakerAlternativeSuggestion,
} from '@/lib/calculations/selectivity';

export interface TccPlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  feederName: string;
  upstreamFeederName: string | null;
  downstreamBreakerModel: string;
  downstreamBreakerSize: number;
  downstreamCurrent: number;
  downstreamCableSize: number;
  downstreamParallelRuns?: number;
  downstreamCategory?: 'MCB' | 'MCCB' | 'ACB';
  upstreamBreakerModel?: string;
  upstreamBreakerSize?: number;
  upstreamCurrent?: number;
  faultCurrentKa?: number;
  selectivityStatus?: 'FULL' | 'PARTIAL' | 'NONE' | null;
  /** Selectivity limit in kA (only set for PARTIAL). */
  selectivityLimitKa?: number | null;
  cableDamageOk?: boolean;
  selectivityReason?: string | null;
  alternativeSuggestions?: BreakerAlternativeSuggestion[];
  onApplySuggestion?: (sug: BreakerAlternativeSuggestion) => Promise<void>;
  applyingId?: string | null;
}

export default function TccPlotModal({
  isOpen,
  onClose,
  feederName,
  upstreamFeederName,
  downstreamBreakerModel,
  downstreamBreakerSize,
  downstreamCurrent,
  downstreamCableSize,
  downstreamParallelRuns = 1,
  downstreamCategory,
  upstreamBreakerModel,
  upstreamBreakerSize = 400,
  upstreamCurrent = 300,
  faultCurrentKa = 15,
  selectivityStatus = 'FULL',
  selectivityLimitKa,
  cableDamageOk = true,
  selectivityReason,
  alternativeSuggestions = [],
  onApplySuggestion,
  applyingId,
}: TccPlotModalProps) {
  const faultCurrentAmps = (faultCurrentKa ?? 15) * 1000;

  // Upstream breaker settings
  const upstreamSettings: BreakerCurveSettings = useMemo(() => {
    const inRating = upstreamBreakerSize || 400;
    const ir = Math.max(upstreamCurrent || 0, inRating * 0.85);
    return {
      inRating,
      ir,
      tr: 12,
      isd: inRating * 4,
      tsd: 0.3,
      ii: inRating * 10,
      category: inRating >= 630 ? 'ACB' : 'MCCB',
    };
  }, [upstreamBreakerSize, upstreamCurrent]);

  // Downstream breaker settings
  const downstreamSettings: BreakerCurveSettings = useMemo(() => {
    const inRating = downstreamBreakerSize || 32;
    const ir = downstreamCurrent || inRating * 0.8;
    const category = downstreamCategory ?? (inRating <= 63 ? 'MCB' : 'MCCB');
    return {
      inRating,
      ir,
      tr: 12,
      isd: category === 'MCCB' ? inRating * 4 : undefined,
      tsd: category === 'MCCB' ? 0.1 : undefined,
      ii: inRating * (category === 'MCB' ? 5 : 10),
      category,
      curveType: 'C',
    };
  }, [downstreamBreakerSize, downstreamCurrent, downstreamCategory]);

  const upstreamCurve = useMemo(() => generateCurvePoints(upstreamSettings), [upstreamSettings]);
  const downstreamCurve = useMemo(() => generateCurvePoints(downstreamSettings), [downstreamSettings]);
  const cableDamageCurve = useMemo(
    () => generateCableDamageCurve(downstreamCableSize || 10, 'copper', 'XLPE', downstreamParallelRuns || 1),
    [downstreamCableSize, downstreamParallelRuns]
  );

  // SVG Chart Geometry
  const svgWidth = 650;
  const svgHeight = 400;
  const plotLeft = 70;
  const plotTop = 30;
  const plotWidth = svgWidth - plotLeft - 30;
  const plotHeight = svgHeight - plotTop - 50;

  const logMinI = Math.log10(10);
  const logMaxI = Math.log10(Math.max(50000, faultCurrentAmps * 1.5));
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
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(p.current).toFixed(1)},${mapY(p.time).toFixed(1)}`)
      .join(' ');
  };

  const currentGridLines = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const timeGridLines = [0.01, 0.1, 1, 10, 60, 300, 3600, 10000];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-orange-500" size={20} />
              <h2 className="text-base font-bold text-white">
                Time-Current Characteristic (TCC) & Coordination Analysis
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Feeder: <span className="text-gray-200 font-semibold">{feederName}</span> &bull; Upstream Parent:{' '}
              <span className="text-gray-200 font-semibold">{upstreamFeederName || 'Main Incomer'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-gray-800 bg-gray-950/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                Coordination Status
              </span>
              <div className="flex items-center gap-2">
                {selectivityStatus === 'FULL' ? (
                  <CheckCircle2 size={16} className="text-green-400" />
                ) : selectivityStatus === 'PARTIAL' ? (
                  <AlertTriangle size={16} className="text-yellow-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
                <span
                  className={`text-xs font-bold ${
                    selectivityStatus === 'FULL'
                      ? 'text-green-400'
                      : selectivityStatus === 'PARTIAL'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {selectivityStatus === 'FULL'
                    ? 'FULL SELECTIVITY'
                    : selectivityStatus === 'PARTIAL'
                    ? `PARTIAL (${selectivityLimitKa ? `${selectivityLimitKa} kA` : 'Limited'})`
                    : 'NO SELECTIVITY'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-gray-800 bg-gray-950/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                Prospective Fault (Isc)
              </span>
              <span className="text-xs font-mono font-bold text-orange-400">
                {(faultCurrentAmps / 1000).toFixed(2)} kA
              </span>
            </div>

            <div className="p-3 rounded-xl border border-gray-800 bg-gray-950/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                Cable Thermal Withstand
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold ${
                    cableDamageOk ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {cableDamageOk ? '✓ Protected (Safe)' : '✗ Unprotected (Damage Risk)'}
                </span>
              </div>
            </div>
          </div>

          {/* Alternative Breaker Suggestions Section (Shown when PARTIAL or NONE) */}
          {selectivityStatus !== 'FULL' && alternativeSuggestions.length > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-950/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-orange-400" />
                  <h3 className="text-sm font-bold text-orange-300">
                    Recommended Solutions for Full Selectivity
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {alternativeSuggestions.length} Available Option{alternativeSuggestions.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {alternativeSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-3 rounded-lg border border-gray-800 bg-gray-900/90 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-orange-500/40 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {sug.badge}
                        </span>
                        <strong className="text-xs font-semibold text-gray-200">{sug.title}</strong>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{sug.description}</p>
                      {sug.suggestedModel && (
                        <div className="flex items-center gap-2 text-xs font-mono text-blue-400 pt-0.5 flex-wrap">
                          <Zap size={12} className="text-blue-400 shrink-0" />
                          <span>Suggested Model: <strong>{sug.suggestedModel}</strong></span>
                          {sug.fallbackType === 'OTHER_FAMILY' && (
                            <span className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Catalog Fallback
                            </span>
                          )}
                          {sug.fallbackType === 'OTHER_BRAND' && (
                            <span className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Cross-Brand
                            </span>
                          )}
                          {sug.fallbackType === 'GENERIC_SPEC' && (
                            <span className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20" title={sug.genericSpec?.procurementNotes}>
                              Generic Spec
                            </span>
                          )}
                        </div>
                      )}
                      {sug.genericSpec?.procurementNotes && (
                        <div className="text-[11px] text-gray-400 bg-gray-950/60 p-2 rounded border border-gray-800 font-sans mt-1">
                          <strong className="text-gray-300">Procurement Spec: </strong>
                          {sug.genericSpec.procurementNotes}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end sm:self-center">
                      <span className="text-[10px] font-bold text-green-400 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 flex items-center gap-1">
                        <CheckCircle2 size={11} /> FULL Selectivity
                      </span>
                      {onApplySuggestion && (
                        <button
                          disabled={Boolean(applyingId)}
                          onClick={async () => {
                            await onApplySuggestion(sug);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
                          title="Apply this recommendation and save to project database"
                        >
                          <Zap size={12} className={applyingId === sug.id ? "animate-spin" : ""} />
                          <span>{applyingId === sug.id ? "Saving..." : sug.actionText || "Apply & Save to Project"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SVG Plot */}
          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3 overflow-x-auto flex justify-center">
            <svg width={svgWidth} height={svgHeight} className="select-none font-mono text-[9px]">
              {/* Plot Background */}
              <rect
                x={plotLeft}
                y={plotTop}
                width={plotWidth}
                height={plotHeight}
                fill="#0a0e17"
                stroke="#1f2937"
                strokeWidth="1"
              />

              {/* Grid Lines - Current (X) */}
              {currentGridLines.map((iVal) => {
                const x = mapX(iVal);
                return (
                  <g key={`grid-x-${iVal}`}>
                    <line
                      x1={x}
                      y1={plotTop}
                      x2={x}
                      y2={plotTop + plotHeight}
                      stroke="#1e293b"
                      strokeDasharray="2,2"
                    />
                    <text x={x} y={plotTop + plotHeight + 16} fill="#64748b" textAnchor="middle">
                      {iVal >= 1000 ? `${iVal / 1000}k` : iVal}
                    </text>
                  </g>
                );
              })}

              {/* Grid Lines - Time (Y) */}
              {timeGridLines.map((tVal) => {
                const y = mapY(tVal);
                return (
                  <g key={`grid-y-${tVal}`}>
                    <line
                      x1={plotLeft}
                      y1={y}
                      x2={plotLeft + plotWidth}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="2,2"
                    />
                    <text x={plotLeft - 8} y={y + 3} fill="#64748b" textAnchor="end">
                      {tVal >= 60 ? `${tVal / 60}m` : `${tVal}s`}
                    </text>
                  </g>
                );
              })}

              {/* Axes Labels */}
              <text
                x={plotLeft + plotWidth / 2}
                y={plotTop + plotHeight + 35}
                fill="#94a3b8"
                textAnchor="middle"
                className="font-sans text-[10px] font-semibold tracking-wider"
              >
                Current (A) &mdash; Log Scale
              </text>

              {/* Cable Damage Curve (Red Dashed) */}
              <path
                d={toPath(cableDamageCurve)}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4,4"
              />

              {/* Upstream Curve (Blue) */}
              <path
                d={toPath(upstreamCurve)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />

              {/* Downstream Curve (Orange) */}
              <path
                d={toPath(downstreamCurve)}
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
              />

              {/* Fault Current Marker (Red Vertical Line) */}
              <line
                x1={mapX(faultCurrentAmps)}
                y1={plotTop}
                x2={mapX(faultCurrentAmps)}
                y2={plotTop + plotHeight}
                stroke="#dc2626"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <text
                x={mapX(faultCurrentAmps) + 4}
                y={plotTop + 14}
                fill="#ef4444"
                className="font-bold text-[9px]"
              >
                Isc: {(faultCurrentAmps / 1000).toFixed(1)}kA
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-gray-950/40 border border-gray-800 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#38bdf8] inline-block"></span>
              <span className="text-gray-300 font-medium">Upstream ({upstreamBreakerModel || `${upstreamBreakerSize}A`})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#f97316] inline-block"></span>
              <span className="text-gray-300 font-medium">Downstream ({downstreamBreakerModel || `${downstreamBreakerSize}A`})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#ef4444] inline-block border-b border-dashed border-red-500"></span>
              <span className="text-gray-400">Cable Damage ({downstreamCableSize} mm² XLPE)</span>
            </div>
          </div>

          {selectivityReason && (
            <p className="text-xs text-gray-400 italic">
              {selectivityReason}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

