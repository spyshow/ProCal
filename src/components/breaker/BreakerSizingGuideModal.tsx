'use client';

import React from 'react';
import {
  X,
  BookOpen,
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { useTranslation } from '@/i18n';

export interface BreakerSizingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

export function BreakerSizingGuideModal({
  isOpen,
  onClose,
  onStartTour,
}: BreakerSizingGuideModalProps) {
  const { t, isRtl } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground-color)] tracking-tight flex items-center gap-2">
                {t('breakerGuide.title', 'Breaker Sizing & Selectivity Engineering Guide')}
              </h2>
              <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                {t('breakerGuide.subtitle', 'IEC 60947-2 & IEC 60364-5-52 Protection Principles')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--table-header-color)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[var(--foreground-color)] leading-relaxed">
          {/* Quick Case Study Banner (Addressing the 125A for 76.5A load question directly) */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20 text-orange-700 dark:text-orange-400 shrink-0 mt-0.5">
                <HelpCircle size={18} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300">
                  {t('breakerGuide.caseStudyTitle', 'Frequently Asked: Why choose a 125A breaker for a 76.5A load (e.g. F4 – SMDB)?')}
                </h3>
                <p className="text-xs text-[var(--foreground-color)]">
                  {t('breakerGuide.caseStudyText', 'For Sub-Main Distribution Boards (SMDB), ProCal selects molded case circuit breakers (MCCB) with electronic trip units sized to satisfy both continuous load safety and upstream-to-downstream selectivity grading (IEC 60947-2). Sizing an SMDB riser at 125A ensures full discrimination against downstream 63A branch breakers, prevents nuisance floor blackouts, and protects 35 mm² cables (Iz = 147A >= 125A).')}
                </p>
              </div>
            </div>
          </div>

          {/* Sizing Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[var(--foreground-color)] font-semibold">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center justify-center text-xs font-bold">1</span>
                <span>{t('breakerGuide.rule1Title', 'Sub-Panel (SMDB) Feeder Role & MCCBs')}</span>
              </div>
              <p className="text-xs text-[var(--table-header-color)]">
                {t('breakerGuide.rule1Text', 'Riser feeders from the MDB to floor SMDB sub-panels require 3-pole MCCBs with high breaking capacity (e.g. 50kA) and electronic trip units (MicroLogic 2.2 / Ekip Dip) to handle potential short-circuit fault levels.')}
              </p>
            </div>

            {/* Rule 2 */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[var(--foreground-color)] font-semibold">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">2</span>
                <span>{t('breakerGuide.rule2Title', 'Selectivity & 1.6x Discrimination Rule')}</span>
              </div>
              <p className="text-xs text-[var(--table-header-color)]">
                {t('breakerGuide.rule2Text', 'To achieve FULL Selectivity, the upstream breaker rating In must maintain a grading ratio of at least 1.6x against the largest downstream MCB (63A × 1.6 = 100.8A → requires 125A). An 80A breaker would cause cascading trips on branch faults.')}
              </p>
            </div>

            {/* Rule 3 */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[var(--foreground-color)] font-semibold">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs font-bold">3</span>
                <span>{t('breakerGuide.rule3Title', 'Continuous Load Headroom (1.25x Rule)')}</span>
              </div>
              <p className="text-xs text-[var(--table-header-color)]">
                {t('breakerGuide.rule3Text', 'Sub-distribution feeders serving continuous multi-circuit loads apply a 1.25 safety factor (76.5A × 1.25 = 95.6A). Standard industrial MCCB ratings above 95.6A in this frame line are 100A and 125A.')}
              </p>
            </div>

            {/* Rule 4 */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[var(--foreground-color)] font-semibold">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center text-xs font-bold">4</span>
                <span>{t('breakerGuide.rule4Title', 'Electronic Trip Units (Ir Dial Adjustment)')}</span>
              </div>
              <p className="text-xs text-[var(--table-header-color)]">
                {t('breakerGuide.rule4Text', 'With electronic trip units (MicroLogic 2.2 / Ekip Dip), the physical frame is 125A/160A, while the adjustable overload pickup dial Ir (0.4–1.0 × In) can be tuned to protect the exact 76.5A operational current.')}
              </p>
            </div>
          </div>

          {/* Cable Protection Inequality Box */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--foreground-color)] text-xs">
                <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>{t('breakerGuide.cableCoordTitle', 'IEC 60364-5-52 Cable Coordination Condition')}</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-600/40 px-2 py-0.5 rounded font-bold">
                Ib ≤ In ≤ Iz
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xs">
                <span className="text-[var(--table-header-color)] block text-[10px] uppercase font-semibold">{t('breakerGuide.designCurrent', 'Design Current (Ib)')}</span>
                <strong className="text-[var(--foreground-color)] text-sm font-mono font-bold">76.5 A</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xs">
                <span className="text-sky-700 dark:text-sky-400 block text-[10px] uppercase font-semibold">{t('breakerGuide.breakerRating', 'Breaker Rating (In)')}</span>
                <strong className="text-sky-700 dark:text-sky-400 text-sm font-mono font-bold">125 A</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xs">
                <span className="text-emerald-700 dark:text-emerald-400 block text-[10px] uppercase font-semibold">{t('breakerGuide.cableAmpacity', 'Cable Capacity (Iz - 35mm²)')}</span>
                <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-mono font-bold">147 A</strong>
              </div>
            </div>

            <p className="text-[11px] text-[var(--table-header-color)]">
              {t('breakerGuide.cableCoordExplain', 'Because Iz (147A) is greater than In (125A), the 35 mm² XLPE copper cable is 100% protected against continuous thermal overload and short-circuit thermal damage.')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex items-center justify-between gap-3">
          {onStartTour ? (
            <button
              onClick={() => {
                onClose();
                onStartTour();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20 text-xs font-semibold transition-all cursor-pointer"
            >
              <Compass size={14} className="text-orange-600 dark:text-orange-400" />
              {t('breakerGuide.startTourBtn', 'Launch Interactive Tour')}
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-xs font-semibold text-[var(--foreground-color)] hover:border-orange-500/40 transition-all shadow-2xs cursor-pointer"
          >
            {t('breakerGuide.closeBtn', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
}
