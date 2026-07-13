'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  generateCurvePoints,
  verifyCoordination,
  recommendBreakerSettings,
  type BreakerCurveSettings,
  type CoordinationResult,
  type CurvePoint,
} from '@/lib/calculations/selectivity';

type SelectivityStatus = 'FULL' | 'PARTIAL' | 'NONE';

const STATUS_CONFIG: Record<SelectivityStatus, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  FULL: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle, label: 'Full Selectivity' },
  PARTIAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: AlertTriangle, label: 'Partial Selectivity' },
  NONE: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'No Selectivity' },
};

export default function CoordinationPage() {
  // Upstream breaker settings
  const [upstream, setUpstream] = useState<BreakerCurveSettings>({
    inRating: 630,
    ir: 500,
    tr: 12,
    isd: 2500,
    tsd: 0.3,
    i2t: false,
    ii: 5000,
    ig: 200,
    tg: 0.2,
  });

  // Downstream breaker settings
  const [downstream, setDownstream] = useState<BreakerCurveSettings>({
    inRating: 160,
    ir: 128,
    tr: 12,
    isd: 640,
    tsd: 0.1,
    i2t: true,
    ii: 1280,
    ig: 50,
    tg: 0.1,
  });

  const [faultCurrent, setFaultCurrent] = useState(25000);
  const [showSettings, setShowSettings] = useState<'upstream' | 'downstream' | null>(null);

  // Generate curve data
  const upstreamCurve = useMemo(() => generateCurvePoints(upstream), [upstream]);
  const downstreamCurve = useMemo(() => generateCurvePoints(downstream), [downstream]);

  // Cable damage curve (simplified: t = (k*S/I)^2 for copper, k=143, S=50mm²)
  const cableDamageCurve = useMemo(() => {
    const k = 143;
    const S = 50;
    const points: CurvePoint[] = [];
    for (let i = 0; i <= 100; i++) {
      const logI = Math.log10(100) + i * (Math.log10(50000) - Math.log10(100)) / 100;
      const I = Math.pow(10, logI);
      const t = Math.pow((k * S) / I, 2);
      if (t >= 0.01 && t <= 10000) {
        points.push({ current: parseFloat(I.toFixed(1)), time: parseFloat(t.toFixed(4)) });
      }
    }
    return points;
  }, []);

  // Coordination check
  const result: CoordinationResult = useMemo(
    () => verifyCoordination(upstream, downstream, faultCurrent, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' }),
    [upstream, downstream, faultCurrent]
  );

  const statusConfig = STATUS_CONFIG[result.status];
  const StatusIcon = statusConfig.icon;

  // SVG Dimensions
  const svgWidth = 700;
  const svgHeight = 500;
  const plotLeft = 80;
  const plotTop = 40;
  const plotWidth = svgWidth - plotLeft - 40;
  const plotHeight = svgHeight - plotTop - 60;

  // Log scale mapping
  const logMinI = Math.log10(Math.max(10, downstream.ir * 0.3));
  const logMaxI = Math.log10(Math.max(faultCurrent, upstream.inRating * 20));
  const logMinT = Math.log10(0.01);
  const logMaxT = Math.log10(10000);

  const mapX = (current: number) => {
    return plotLeft + ((Math.log10(current) - logMinI) / (logMaxI - logMinI)) * plotWidth;
  };
  const mapY = (time: number) => {
    const logT = Math.log10(Math.max(0.01, Math.min(10000, time)));
    return plotTop + plotHeight - ((logT - logMinT) / (logMaxT - logMinT)) * plotHeight;
  };

  const toPath = (points: CurvePoint[]) => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(p.current).toFixed(1)},${mapY(p.time).toFixed(1)}`).join(' ');
  };

  // Grid lines
  const currentGridLines = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].filter(
    (v) => v >= Math.pow(10, logMinI) && v <= Math.pow(10, logMaxI)
  );
  const timeGridLines = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

  const applyRecommended = (which: 'upstream' | 'downstream') => {
    // Simple recommendation based on nominal rating
    if (which === 'upstream') {
      setUpstream(recommendBreakerSettings(450, 600, 630));
    } else {
      setDownstream(recommendBreakerSettings(100, 180, 160));
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-orange-500" />
            Coordination Studio
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            IEC 60947-2 selectivity verification with logarithmic TCC curves
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${statusConfig.bg}`}>
          <StatusIcon size={18} className={statusConfig.color} />
          <span className={`text-sm font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Panel: Breaker Settings */}
        <div className="space-y-4">
          {/* Upstream Breaker */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Upstream Breaker
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowSettings(showSettings === 'upstream' ? null : 'upstream')}
                  className="p-1 rounded text-gray-500 hover:text-gray-300"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => applyRecommended('upstream')}
                  className="p-1 rounded text-gray-500 hover:text-orange-400"
                  title="Auto-configure"
                >
                  <Play size={14} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              In={upstream.inRating}A
            </div>

            {showSettings === 'upstream' && (
              <BreakerSettingsForm settings={upstream} onChange={setUpstream} />
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-gray-500">Ir (A)</label>
                <input
                  type="number"
                  value={upstream.ir}
                  onChange={(e) => setUpstream({ ...upstream, ir: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">tr (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={upstream.tr}
                  onChange={(e) => setUpstream({ ...upstream, tr: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">Isd (A)</label>
                <input
                  type="number"
                  value={upstream.isd ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, isd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">tsd (s)</label>
                <input
                  type="number"
                  step="0.01"
                  value={upstream.tsd ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, tsd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">Ii (A)</label>
                <input
                  type="number"
                  value={upstream.ii ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, ii: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">I²t</label>
                <select
                  value={upstream.i2t ? 'on' : 'off'}
                  onChange={(e) => setUpstream({ ...upstream, i2t: e.target.value === 'on' })}
                  className="dense-input w-full rounded"
                >
                  <option value="off">OFF</option>
                  <option value="on">ON</option>
                </select>
              </div>
            </div>
          </div>

          {/* Downstream Breaker */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                Downstream Breaker
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowSettings(showSettings === 'downstream' ? null : 'downstream')}
                  className="p-1 rounded text-gray-500 hover:text-gray-300"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => applyRecommended('downstream')}
                  className="p-1 rounded text-gray-500 hover:text-orange-400"
                  title="Auto-configure"
                >
                  <Play size={14} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              In={downstream.inRating}A
            </div>

            {showSettings === 'downstream' && (
              <BreakerSettingsForm settings={downstream} onChange={setDownstream} />
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-gray-500">Ir (A)</label>
                <input
                  type="number"
                  value={downstream.ir}
                  onChange={(e) => setDownstream({ ...downstream, ir: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">tr (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={downstream.tr}
                  onChange={(e) => setDownstream({ ...downstream, tr: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">Isd (A)</label>
                <input
                  type="number"
                  value={downstream.isd ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, isd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">tsd (s)</label>
                <input
                  type="number"
                  step="0.01"
                  value={downstream.tsd ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, tsd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">Ii (A)</label>
                <input
                  type="number"
                  value={downstream.ii ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, ii: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded"
                />
              </div>
              <div>
                <label className="text-gray-500">I²t</label>
                <select
                  value={downstream.i2t ? 'on' : 'off'}
                  onChange={(e) => setDownstream({ ...downstream, i2t: e.target.value === 'on' })}
                  className="dense-input w-full rounded"
                >
                  <option value="off">OFF</option>
                  <option value="on">ON</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fault Current */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400">Fault Parameters</h3>
            <div>
              <label className="text-xs text-gray-500">Available Fault Current (A)</label>
              <input
                type="number"
                value={faultCurrent}
                onChange={(e) => setFaultCurrent(parseInt(e.target.value) || 25000)}
                className="dense-input w-full rounded"
              />
            </div>
            {result.overlapDetails && (
              <p className="text-xs text-gray-400 mt-2">{result.overlapDetails}</p>
            )}
          </div>
        </div>

        {/* Right: TCC Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Time-Current Characteristic (TCC) — Log-Log Scale
          </h3>
          <div className="bg-gray-950 rounded-lg border border-gray-800 p-2 overflow-x-auto">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" xmlns="http://www.w3.org/2000/svg">
              {/* Plot area background */}
              <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} fill="#0a0f1a" stroke="#1f2937" strokeWidth="1" />

              {/* Horizontal grid lines (time) */}
              {timeGridLines.map((t) => {
                const y = mapY(t);
                if (y < plotTop || y > plotTop + plotHeight) return null;
                return (
                  <g key={`t-${t}`}>
                    <line x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} stroke="#1f2937" strokeWidth="0.5" />
                    <text x={plotLeft - 5} y={y + 3} textAnchor="end" fill="#6b7280" fontSize="8" fontFamily="monospace">
                      {t >= 1 ? t : t.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical grid lines (current) */}
              {currentGridLines.map((i) => {
                const x = mapX(i);
                if (x < plotLeft || x > plotLeft + plotWidth) return null;
                return (
                  <g key={`i-${i}`}>
                    <line x1={x} y1={plotTop} x2={x} y2={plotTop + plotHeight} stroke="#1f2937" strokeWidth="0.5" />
                    <text x={x} y={plotTop + plotHeight + 14} textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="monospace">
                      {i >= 1000 ? `${i / 1000}k` : i}
                    </text>
                  </g>
                );
              })}

              {/* Axis labels */}
              <text x={plotLeft + plotWidth / 2} y={svgHeight - 8} textAnchor="middle" fill="#9ca3af" fontSize="10">
                Current (Amperes)
              </text>
              <text
                x="15"
                y={plotTop + plotHeight / 2}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="10"
                transform={`rotate(-90, 15, ${plotTop + plotHeight / 2})`}
              >
                Time (Seconds)
              </text>

              {/* Cable Damage Curve */}
              {cableDamageCurve.length > 0 && (
                <path
                  d={toPath(cableDamageCurve)}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeDasharray="6,3"
                  opacity="0.6"
                />
              )}

              {/* Fault current line */}
              <line
                x1={mapX(faultCurrent)}
                y1={plotTop}
                x2={mapX(faultCurrent)}
                y2={plotTop + plotHeight}
                stroke="#ef4444"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.6"
              />
              <text
                x={mapX(faultCurrent)}
                y={plotTop - 5}
                textAnchor="middle"
                fill="#ef4444"
                fontSize="8"
                fontFamily="monospace"
              >
                If={faultCurrent >= 1000 ? `${faultCurrent / 1000}kA` : `${faultCurrent}A`}
              </text>

              {/* Upstream curve */}
              <path d={toPath(upstreamCurve)} fill="none" stroke="#3b82f6" strokeWidth="2" />

              {/* Downstream curve */}
              <path d={toPath(downstreamCurve)} fill="none" stroke="#f97316" strokeWidth="2" />

              {/* Legend */}
              <g transform={`translate(${plotLeft + 10}, ${plotTop + 10})`}>
                <rect x="0" y="0" width="180" height="70" fill="#111827" fillOpacity="0.8" stroke="#1f2937" rx="4" />
                <line x1="8" y1="15" x2="28" y2="15" stroke="#3b82f6" strokeWidth="2" />
                <text x="34" y="18" fill="#93c5fd" fontSize="9">Upstream ({upstream.inRating}A)</text>
                <line x1="8" y1="32" x2="28" y2="32" stroke="#f97316" strokeWidth="2" />
                <text x="34" y="35" fill="#fdba74" fontSize="9">Downstream ({downstream.inRating}A)</text>
                <line x1="8" y1="49" x2="28" y2="49" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4,2" />
                <text x="34" y="52" fill="#c4b5fd" fontSize="9">Cable Damage</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakerSettingsForm({
  settings,
  onChange,
}: {
  settings: BreakerCurveSettings;
  onChange: (s: BreakerCurveSettings) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-gray-500">In (A)</label>
          <input
            type="number"
            value={settings.inRating}
            onChange={(e) => onChange({ ...settings, inRating: parseFloat(e.target.value) || 0 })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">Ir (A)</label>
          <input
            type="number"
            value={settings.ir}
            onChange={(e) => onChange({ ...settings, ir: parseFloat(e.target.value) || 0 })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">tr (s)</label>
          <input
            type="number"
            step="0.1"
            value={settings.tr}
            onChange={(e) => onChange({ ...settings, tr: parseFloat(e.target.value) || 0 })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">Isd (A)</label>
          <input
            type="number"
            value={settings.isd ?? ''}
            onChange={(e) => onChange({ ...settings, isd: parseFloat(e.target.value) || undefined })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">tsd (s)</label>
          <input
            type="number"
            step="0.01"
            value={settings.tsd ?? ''}
            onChange={(e) => onChange({ ...settings, tsd: parseFloat(e.target.value) || undefined })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">Ii (A)</label>
          <input
            type="number"
            value={settings.ii ?? ''}
            onChange={(e) => onChange({ ...settings, ii: parseFloat(e.target.value) || undefined })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">Ig (A)</label>
          <input
            type="number"
            value={settings.ig ?? ''}
            onChange={(e) => onChange({ ...settings, ig: parseFloat(e.target.value) || undefined })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="text-gray-500">tg (s)</label>
          <input
            type="number"
            step="0.01"
            value={settings.tg ?? ''}
            onChange={(e) => onChange({ ...settings, tg: parseFloat(e.target.value) || undefined })}
            className="dense-input w-full rounded"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">I²t:</label>
        <button
          onClick={() => onChange({ ...settings, i2t: !settings.i2t })}
          className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
            settings.i2t ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
          }`}
        >
          {settings.i2t ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
