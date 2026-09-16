'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { useProject } from '@/context/ProjectContext';
import { type ProjectPageKey } from '@/lib/project-permissions';
import {
  Zap,
  Cpu,
  GitBranch,
  CircuitBoard,
  Shield,
  Cable,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
  step: number;
  id: string;
  pageKey: ProjectPageKey;
  nameKey: string;
  defaultName: string;
  shortNameKey: string;
  defaultShortName: string;
  href: string;
  icon: React.ElementType;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: 1,
    id: 'calculator',
    pageKey: 'calculator',
    nameKey: 'workflow.loadsDemand',
    defaultName: 'Loads & Demand',
    shortNameKey: 'workflow.short.loads',
    defaultShortName: 'Loads',
    href: '/calculator',
    icon: Zap,
  },
  {
    step: 2,
    id: 'breaker-schedule',
    pageKey: 'breakerSchedule',
    nameKey: 'workflow.circuitBreakers',
    defaultName: 'Circuit Breakers',
    shortNameKey: 'workflow.short.breakers',
    defaultShortName: 'Breakers',
    href: '/breaker-schedule',
    icon: CircuitBoard,
  },
  {
    step: 3,
    id: 'coordination',
    pageKey: 'coordination',
    nameKey: 'workflow.selectivityTcc',
    defaultName: 'Selectivity & TCC',
    shortNameKey: 'workflow.short.coordination',
    defaultShortName: 'Coordination',
    href: '/coordination',
    icon: Shield,
  },
  {
    step: 4,
    id: 'cable-schedule',
    pageKey: 'cableSchedule',
    nameKey: 'workflow.cableSizing',
    defaultName: 'Cable Sizing',
    shortNameKey: 'workflow.short.cables',
    defaultShortName: 'Cables',
    href: '/cable-schedule',
    icon: Cable,
  },
  {
    step: 5,
    id: 'panel',
    pageKey: 'panelDesigner',
    nameKey: 'workflow.distributionMdb',
    defaultName: 'Distribution & MDB',
    shortNameKey: 'workflow.short.panels',
    defaultShortName: 'Panels',
    href: '/panel',
    icon: Cpu,
  },
  {
    step: 6,
    id: 'riser',
    pageKey: 'riserDiagram',
    nameKey: 'workflow.riserSystem',
    defaultName: 'Riser System',
    shortNameKey: 'workflow.short.risers',
    defaultShortName: 'Risers',
    href: '/riser',
    icon: GitBranch,
  },
  {
    step: 7,
    id: 'sld',
    pageKey: 'sldDesigner',
    nameKey: 'workflow.sldSchematic',
    defaultName: 'SLD Schematic',
    shortNameKey: 'workflow.short.sld',
    defaultShortName: 'SLD',
    href: '/sld',
    icon: GitBranch,
  },
  {
    step: 8,
    id: 'reports',
    pageKey: 'reports',
    nameKey: 'workflow.reportsBom',
    defaultName: 'Reports & BOM',
    shortNameKey: 'workflow.short.reports',
    defaultShortName: 'Reports',
    href: '/reports',
    icon: FileText,
  },
];

export interface WorkflowStepperProps {
  currentStep?: number;
  className?: string;
}

export default function WorkflowStepper({ currentStep, className }: WorkflowStepperProps) {
  const pathname = usePathname();
  const { t, isRtl } = useTranslation();
  const { canView } = useProject();

  const activeIndex =
    currentStep != null
      ? currentStep - 1
      : WORKFLOW_STEPS.findIndex((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  const StepChevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xs p-2.5 sm:p-3',
        className
      )}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 min-w-0 sm:justify-between">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isRestricted = !canView(step.pageKey);
          const isActive = idx === activeIndex;
          const isCompleted = activeIndex >= 0 && idx < activeIndex;
          const name = t(step.nameKey, step.defaultName);
          const shortName = t(step.shortNameKey, step.defaultShortName);
          const stepPrefix = t('workflow.step', 'Step');

          return (
            <div key={step.id} className="flex items-center gap-2 shrink-0">
              <Link
                href={isRestricted ? '#' : step.href}
                onClick={(e) => {
                  if (isRestricted) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                aria-disabled={isRestricted}
                tabIndex={isRestricted ? -1 : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all group outline-none',
                  isRestricted
                    ? 'opacity-40 text-[var(--table-header-color)] hover:text-[var(--table-header-color)] bg-transparent border border-transparent cursor-not-allowed select-none'
                    : isActive
                    ? 'bg-orange-500/15 border border-orange-500 text-slate-900 dark:text-white font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[var(--foreground-color)] hover:border-orange-500/40'
                    : 'text-[var(--table-header-color)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg-subtle)] border border-transparent'
                )}
                title={
                  isRestricted
                    ? `${stepPrefix} ${step.step}: ${name} (${t('rbac.accessRestricted', 'Restricted')})`
                    : `${stepPrefix} ${step.step}: ${name}`
                }
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 transition-colors',
                    isRestricted
                      ? 'bg-[var(--card-bg-subtle)] text-[var(--table-header-color)] border border-[var(--border-color)]'
                      : isActive
                      ? 'bg-orange-600 text-white shadow-xs shadow-orange-600/30'
                      : isCompleted
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/40'
                      : 'bg-[var(--card-bg-subtle)] text-[var(--table-header-color)] border border-[var(--border-color)] group-hover:text-[var(--foreground-color)]'
                  )}
                >
                  {isRestricted ? <Lock size={10} /> : isCompleted ? <Check size={11} strokeWidth={3} /> : step.step}
                </span>

                <div className="flex flex-col">
                  <span className={cn("hidden sm:inline whitespace-nowrap text-[11px] leading-tight", isActive ? "font-bold text-slate-900 dark:text-white" : "font-medium")}>
                    {name}
                  </span>
                  <span className={cn("sm:hidden whitespace-nowrap text-[11px] leading-tight", isActive ? "font-bold text-slate-900 dark:text-white" : "font-medium")}>
                    {shortName}
                  </span>
                </div>
              </Link>

              {idx < WORKFLOW_STEPS.length - 1 && (
                <StepChevron size={13} className="text-[var(--border-color)] shrink-0 select-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
