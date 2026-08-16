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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {t('breakerGuide.title', 'Breaker Sizing & Selectivity Engineering Guide')}
              </h2>
              <p className="text-xs text-orange-400 font-medium">
                {t('breakerGuide.subtitle', 'IEC 60947-2 & IEC 60364-5-52 Protection Principles')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Quick Case Study Banner (Addressing the 125A for 76.5A load question directly) */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 shrink-0 mt-0.5">
                <HelpCircle size={18} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-orange-300">
                  {t('breakerGuide.caseStudyTitle', 'Frequently Asked: Why choose a 125A breaker for a 76.5A load (e.g. F4 – SMDB)?')}
                </h3>
                <p className="text-xs text-slate-300">
                  {t('breakerGuide.caseStudyText', 'For Sub-Main Distribution Boards (SMDB), ProCal selects molded case circuit breakers (MCCB) with electronic trip units sized to satisfy both continuous load safety and upstream-to-downstream selectivity grading (IEC 60947-2). Sizing an SMDB riser at 125A ensures full discrimination against downstream 63A branch breakers, prevents nuisance floor blackouts, and protects 35 mm² cables (Iz = 147A >= 125A).')}
                </p>
              </div>
            </div>
          </div>

          {/* Sizing Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold">1</span>
                <span>{t('breakerGuide.rule1Title', 'Sub-Panel (SMDB) Feeder Role & MCCBs')}</span>
              </div>
              <p className="text-xs text-slate-400">
                {t('breakerGuide.rule1Text', 'Riser feeders from the MDB to floor SMDB sub-panels require 3-pole MCCBs with high breaking capacity (e.g. 50kA) and electronic trip units (MicroLogic 2.2 / Ekip Dip) to handle potential short-circuit fault levels.')}
              </p>
            </div>

            {/* Rule 2 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">2</span>
                <span>{t('breakerGuide.rule2Title', 'Selectivity & 1.6x Discrimination Rule')}</span>
              </div>
              <p className="text-xs text-slate-400">
                {t('breakerGuide.rule2Text', 'To achieve FULL Selectivity, the upstream breaker rating In must maintain a grading ratio of at least 1.6x against the largest downstream MCB (63A × 1.6 = 100.8A → requires 125A). An 80A breaker would cause cascading trips on branch faults.')}
              </p>
            </div>

            {/* Rule 3 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold">3</span>
                <span>{t('breakerGuide.rule3Title', 'Continuous Load Headroom (1.25x Rule)')}</span>
              </div>
              <p className="text-xs text-slate-400">
                {t('breakerGuide.rule3Text', 'Sub-distribution feeders serving continuous multi-circuit loads apply a 1.25 safety factor (76.5A × 1.25 = 95.6A). Standard industrial MCCB ratings above 95.6A in this frame line are 100A and 125A.')}
              </p>
            </div>

            {/* Rule 4 */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-bold">4</span>
                <span>{t('breakerGuide.rule4Title', 'Electronic Trip Units (Ir Dial Adjustment)')}</span>
              </div>
              <p className="text-xs text-slate-400">
                {t('breakerGuide.rule4Text', 'With electronic trip units (MicroLogic 2.2 / Ekip Dip), the physical frame is 125A/160A, while the adjustable overload pickup dial Ir (0.4–1.0 × In) can be tuned to protect the exact 76.5A operational current.')}
              </p>
            </div>
          </div>

          {/* Cable Protection Inequality Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-semibold text-white text-xs">
                <ShieldCheck size={16} className="text-green-400" />
                <span>{t('breakerGuide.cableCoordTitle', 'IEC 60364-5-52 Cable Coordination Condition')}</span>
              </div>
              <span className="text-[11px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                Ib ≤ In ≤ Iz
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-gray-400 block text-[10px] uppercase">{t('breakerGuide.designCurrent', 'Design Current (Ib)')}</span>
                <strong className="text-slate-200 text-sm font-mono">76.5 A</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-blue-400 block text-[10px] uppercase">{t('breakerGuide.breakerRating', 'Breaker Rating (In)')}</span>
                <strong className="text-blue-400 text-sm font-mono">125 A</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-green-400 block text-[10px] uppercase">{t('breakerGuide.cableAmpacity', 'Cable Capacity (Iz - 35mm²)')}</span>
                <strong className="text-green-400 text-sm font-mono">147 A</strong>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              {t('breakerGuide.cableCoordExplain', 'Because Iz (147A) is greater than In (125A), the 35 mm² XLPE copper cable is 100% protected against continuous thermal overload and short-circuit thermal damage.')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
          {onStartTour ? (
            <button
              onClick={() => {
                onClose();
                onStartTour();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 text-xs font-semibold transition-all"
            >
              <Compass size={14} className="text-orange-400" />
              {t('breakerGuide.startTourBtn', 'Launch Interactive Tour')}
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all"
          >
            {t('breakerGuide.closeBtn', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
}
