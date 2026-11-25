'use client';

import { useTranslation } from '@/i18n';
import {
  Activity,
  Sliders,
  BookOpen,
  FileCode,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from 'lucide-react';
import type { ComponentProperty } from './sld-types';

export interface SldInspectorPanelProps {
  activeMode: 'analyze' | 'simulate' | 'library';
  showDsl: boolean;
  setShowDsl: (v: boolean) => void;
  selectedComponent: ComponentProperty | null;
  activeStatus: 'Closed' | 'Open' | 'Tripped';
  updateStatus: (id: string, status: 'Closed' | 'Open' | 'Tripped') => void;
}

export function SldInspectorPanel({
  activeMode,
  showDsl,
  setShowDsl,
  selectedComponent,
  activeStatus,
  updateStatus,
}: SldInspectorPanelProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-80 border-l border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex flex-col shrink-0 print:hidden">
      <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground-color)]">
          {activeMode === 'analyze' && <Activity size={14} className="text-orange-400" />}
          {activeMode === 'simulate' && <Sliders size={14} className="text-orange-400" />}
          {activeMode === 'library' && <BookOpen size={14} className="text-orange-400" />}
          <span>
            {activeMode === 'analyze' && t('sld.modeAnalyze', 'System Analytics')}
            {activeMode === 'simulate' && t('sld.propertiesInspector', 'Properties Inspector')}
            {activeMode === 'library' && t('sld.symbolLibrary', 'Symbol Library')}
          </span>
        </div>
        <button
          onClick={() => setShowDsl(!showDsl)}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] cursor-pointer"
          title="View DSL Code"
        >
          <FileCode size={14} />
        </button>
      </div>

      {/* MODE 1: ANALYZE DRAWER */}
      {activeMode === 'analyze' && (
        <div className="p-4 pb-16 space-y-4 flex-1 overflow-y-auto no-scrollbar text-xs">
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 block font-semibold">
              {t('sld.diagReport', 'IEC 60364 Diagnostic Report')}
            </span>
            <h4 className="text-sm font-extrabold text-[var(--foreground-color)]">{t('sld.systemPass', 'System Compliance: PASS')}</h4>
            <p className="text-xs text-[var(--text-muted)]">
              Calculated voltage drop and short circuit values are within allowable limits.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
              Key System Metrics
            </span>

            <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[var(--foreground-color)]">{t('sld.maxLightingVd', 'Max Lighting VD')}</span>
              <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">1.8% (Limit ≤ 3%)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[var(--foreground-color)]">{t('sld.maxPowerVd', 'Max Power VD')}</span>
              <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">3.2% (Limit ≤ 5%)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[var(--foreground-color)]">{t('sld.shortCircuitRating', 'Short Circuit Rating')}</span>
              <span className="font-mono font-bold text-amber-500 dark:text-amber-400">15.4 kA</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[var(--foreground-color)]">{t('sld.systemDiversity', 'System Diversity')}</span>
              <span className="font-mono font-bold text-sky-500 dark:text-sky-400">0.75</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[var(--foreground-color)]">{t('sld.phaseBalanceScore', 'Phase Balance Score')}</span>
              <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">98.4%</span>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SIMULATE / PROPERTIES DRAWER */}
      {activeMode === 'simulate' && selectedComponent && (
        <div className="p-4 pb-16 space-y-4 flex-1 overflow-y-auto no-scrollbar text-xs">
          <div className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                {selectedComponent.id}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  activeStatus === 'Closed'
                    ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeStatus === 'Closed' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
                  }`}
                />
                {activeStatus === 'Closed' ? t('sld.activeClosed', 'Active (Closed)') : activeStatus === 'Open' ? t('sld.open', 'Open') : t('sld.tripped', 'Tripped')}
              </span>
            </div>
            <h4 className="text-sm font-extrabold text-[var(--foreground-color)]">{selectedComponent.name}</h4>
            <p className="text-xs text-[var(--text-muted)]">{selectedComponent.type}</p>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label htmlFor="sld-prop-rating" className="block text-[var(--text-muted)] text-[11px] mb-1">{t('sld.protectionRating', 'Protection Rating')}</label>
              <input
                id="sld-prop-rating"
                aria-label={t('sld.protectionRating', 'Protection Rating')}
                type="text"
                value={selectedComponent.rating}
                readOnly
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--foreground-color)] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sld-prop-cable" className="block text-[var(--text-muted)] text-[11px] mb-1 flex items-center justify-between">
                <span>{t('sld.cableConductorSchedule', 'Cable Conductor Schedule')}</span>
                <span className="text-[10px] text-amber-500 dark:text-amber-400 font-mono">IEC 60228</span>
              </label>
              <input
                id="sld-prop-cable"
                aria-label={t('sld.cableConductorSchedule', 'Cable Conductor Schedule')}
                type="text"
                value={selectedComponent.cableSize || '3x2.5mm² Cu/PVC'}
                readOnly
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-amber-500 dark:text-amber-300 font-mono font-medium focus:outline-none shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="sld-prop-sim-switch" className="block text-[var(--text-muted)] text-[11px] mb-1">{t('sld.simulationSwitch', 'Simulation Switch')}</label>
              <select
                id="sld-prop-sim-switch"
                aria-label={t('sld.simulationSwitch', 'Simulation Switch')}
                value={activeStatus}
                onChange={(e) =>
                  updateStatus(selectedComponent.id, e.target.value as 'Closed' | 'Open' | 'Tripped')
                }
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--foreground-color)] focus:outline-none focus:border-orange-500/50 cursor-pointer"
              >
                <option value="Closed">{t('sld.closedNormal', 'Closed (Normal Power Flow)')}</option>
                <option value="Open">{t('sld.openManual', 'Open (Manual Disconnect)')}</option>
                <option value="Tripped">{t('sld.trippedFault', 'Tripped (Simulate Fault)')}</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              {t('sld.liveCalculations', 'LIVE PROJECT CALCULATIONS')}
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[var(--card-bg-subtle)] p-2 rounded-lg border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">{t('sld.currentLoad', 'Current Load')}</span>
                <span className="font-mono font-bold text-orange-400">
                  {selectedComponent.current}
                </span>
              </div>
              <div className="bg-[var(--card-bg-subtle)] p-2 rounded-lg border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">{t('common.maxDemand', 'Max Demand')}</span>
                <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
                  {selectedComponent.power}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-500 dark:text-sky-400 flex items-center gap-1 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>{t('sld.upstreamSupplySource', 'UPSTREAM SUPPLY SOURCE')}</span>
              </span>
              {selectedComponent.upstream && selectedComponent.upstream.length > 0 ? (
                selectedComponent.upstream.map((conn, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-200"
                  >
                    <span className="truncate max-w-[210px]">{conn}</span>
                    <ArrowUpRight className="w-3 h-3 text-sky-500 dark:text-sky-400 shrink-0" />
                  </div>
                ))
              ) : (
                <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] italic">
                  {t('sld.directGridSupply', 'Direct High-Voltage Grid Supply')}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{t('sld.downstreamDistribution', 'DOWNSTREAM DISTRIBUTION')} ({selectedComponent.downstream?.length || selectedComponent.connections.length || 0})</span>
              </span>
              {(selectedComponent.downstream && selectedComponent.downstream.length > 0) || selectedComponent.connections.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 no-scrollbar">
                  {(selectedComponent.downstream || selectedComponent.connections).map((conn, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--foreground-color)] hover:border-orange-500/40 transition-colors"
                    >
                      <span className="truncate max-w-[210px]">{conn}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] italic">
                  {t('sld.finalOutlets', 'Final Load Outlets / Equipment')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: LIBRARY DRAWER */}
      {activeMode === 'library' && (
        <div className="p-4 space-y-3 flex-1 overflow-y-auto no-scrollbar text-xs">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
            IEC / IEEE Symbol Catalog
          </span>

          {[
            { name: 'Moulded Case Circuit Breaker', symbol: 'MCCB', spec: '100A – 800A | 36kA–70kA' },
            { name: 'Air Circuit Breaker', symbol: 'ACB', spec: '1000A – 4000A | 65kA–100kA' },
            { name: 'Miniature Circuit Breaker', symbol: 'MCB', spec: '6A – 63A | C-Curve / D-Curve' },
            { name: 'Dy11 Step-Down Transformer', symbol: 'XFMR', spec: '500kVA – 2500kVA | 11kV/415V' },
            { name: 'Automatic Transfer Switch', symbol: 'ATS', spec: 'Dual Grid & Gen Incomer' },
            { name: 'Distribution Busbar', symbol: 'BUS', spec: 'Copper / Aluminum 100A–2000A' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] space-y-1 cursor-pointer hover:border-orange-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--foreground-color)] text-xs">{item.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-500 dark:text-orange-400 font-mono text-[10px]">
                  {item.symbol}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{item.spec}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
