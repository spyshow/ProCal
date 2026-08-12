'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
  step: number;
  id: string;
  name: string;
  shortName: string;
  href: string;
  icon: React.ElementType;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { step: 1, id: 'calculator', name: 'Loads & Demand', shortName: 'Loads', href: '/calculator', icon: Zap },
  { step: 2, id: 'breaker-schedule', name: 'Circuit Breakers', shortName: 'Breakers', href: '/breaker-schedule', icon: CircuitBoard },
  { step: 3, id: 'coordination', name: 'Selectivity & TCC', shortName: 'Coordination', href: '/coordination', icon: Shield },
  { step: 4, id: 'cable-schedule', name: 'Cable Sizing', shortName: 'Cables', href: '/cable-schedule', icon: Cable },
  { step: 5, id: 'panel', name: 'Distribution & MDB', shortName: 'Panels', href: '/panel', icon: Cpu },
  { step: 6, id: 'riser', name: 'Riser System', shortName: 'Risers', href: '/riser', icon: GitBranch },
  { step: 7, id: 'sld', name: 'SLD Schematic', shortName: 'SLD', href: '/sld', icon: GitBranch },
  { step: 8, id: 'reports', name: 'Reports & BOM', shortName: 'Reports', href: '/reports', icon: FileText },
];

export interface WorkflowStepperProps {
  currentStep?: number;
  className?: string;
}

export default function WorkflowStepper({ currentStep, className }: WorkflowStepperProps) {
  const pathname = usePathname();

  const activeIndex =
    currentStep != null
      ? currentStep - 1
      : WORKFLOW_STEPS.findIndex((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-800/80 bg-gray-900/60 backdrop-blur-md p-3 shadow-lg shadow-black/20',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar pb-1">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isCompleted = activeIndex >= 0 && idx < activeIndex;

          return (
            <div key={step.id} className="flex items-center gap-2 shrink-0">
              <Link
                href={step.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all group outline-none',
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-300 shadow-[0_0_15px_rgba(234,88,12,0.15)]'
                    : isCompleted
                    ? 'bg-gray-950/60 border border-gray-800/80 text-gray-300 hover:border-gray-700 hover:text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 border border-transparent'
                )}
                title={`Step ${step.step}: ${step.name}`}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 transition-colors',
                    isActive
                      ? 'bg-orange-500 text-white shadow-[0_0_8px_rgba(234,88,12,0.6)]'
                      : isCompleted
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-800 text-gray-500 group-hover:text-gray-300'
                  )}
                >
                  {isCompleted ? <Check size={11} strokeWidth={3} /> : step.step}
                </span>

                <div className="flex flex-col">
                  <span className="hidden sm:inline whitespace-nowrap text-[11px] font-medium leading-tight">
                    {step.name}
                  </span>
                  <span className="sm:hidden whitespace-nowrap text-[11px] font-medium leading-tight">
                    {step.shortName}
                  </span>
                </div>
              </Link>

              {idx < WORKFLOW_STEPS.length - 1 && (
                <ChevronRight size={13} className="text-gray-700 shrink-0 select-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
