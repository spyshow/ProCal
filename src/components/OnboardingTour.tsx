'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import {
  LayoutDashboard,
  Building2,
  Zap,
  Cable,
  CircuitBoard,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  targetAttr: string;
  route: string;
  icon: React.ElementType;
}

const TOUR_STEPS: Step[] = [
  {
    id: 'dashboard',
    title: 'Dashboard & Engineering Metrics',
    subtitle: 'Real-Time Project Overview',
    content: 'Welcome to ProCal! The Dashboard provides real-time statistics on active electrical loads, maximum demand, and overall project summaries.',
    targetAttr: 'tour-dashboard',
    route: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'projects',
    title: 'Projects & Building Management',
    subtitle: 'Manage Projects & Buildings',
    content: 'Manage your engineering project portfolio, create new projects, and configure multi-building complexes (residential towers, commercial malls, office blocks).',
    targetAttr: 'tour-projects',
    route: '/projects',
    icon: Building2,
  },
  {
    id: 'calculator',
    title: 'Load Calculator & Phase Balancing',
    subtitle: 'Electrical Demand & Neutral Current',
    content: 'Calculate load currents, power factor displacement angles, demand factors, and vector 3-phase neutral unbalance across all floors.',
    targetAttr: 'tour-calculator',
    route: '/calculator',
    icon: Zap,
  },
  {
    id: 'cable-schedule',
    title: 'Cable Schedule & Derating',
    subtitle: 'IEC 60364 Cable Sizing',
    content: 'Automatically size copper/aluminum XLPE cables based on installation methods, ambient temperature, grouping factors, and voltage drop limits.',
    targetAttr: 'tour-cable-schedule',
    route: '/cable-schedule',
    icon: Cable,
  },
  {
    id: 'breaker-schedule',
    title: 'Breaker Schedule & Selection',
    subtitle: 'MCB, MCCB & ACB Catalog Matching',
    content: 'Match miniature circuit breakers (MCB), molded case circuit breakers (MCCB), and air circuit breakers (ACB) from Schneider, ABB, and Siemens.',
    targetAttr: 'tour-breaker-schedule',
    route: '/breaker-schedule',
    icon: CircuitBoard,
  },
  {
    id: 'panel-designer',
    title: 'Panel Designer & Main Incomer',
    subtitle: 'Busbar & Switchboard Configuration',
    content: 'Configure main distribution boards (MDB) and sub-distribution boards (SMDB), transformer secondaries, and main busbar current ratings.',
    targetAttr: 'tour-panel',
    route: '/panel',
    icon: Cpu,
  },
  {
    id: 'riser-diagram',
    title: 'Riser Diagram & Feeder Distribution',
    subtitle: 'Vertical Building Power Distribution',
    content: 'Visualize vertical electrical risers, feeder distribution trunks, and sub-panel floor connections throughout multi-story structures.',
    targetAttr: 'tour-riser',
    route: '/riser',
    icon: GitBranch,
  },
  {
    id: 'coordination',
    title: 'Protection Coordination',
    subtitle: 'Selectivity & Trip Curves',
    content: 'Analyze protection selectivity, discrimination, and tripping characteristics between upstream MCCBs/ACBs and downstream MCBs.',
    targetAttr: 'tour-coordination',
    route: '/coordination',
    icon: Shield,
  },
  {
    id: 'sld-designer',
    title: 'SLD Designer Workstation',
    subtitle: 'Interactive Single Line Diagrams',
    content: 'Inspect floor-by-floor Single Line Diagrams with collapsible tree explorer, interactive node details, and live schematic rendering.',
    targetAttr: 'tour-sld',
    route: '/sld',
    icon: GitBranch,
  },
  {
    id: 'reports',
    title: 'Executive PDF Reports',
    subtitle: 'Print & Export Drawing Packages',
    content: 'Generate executive summary cover reports with color-coded key performance cards, distribution hierarchy tables, and complete landscape drawing packages.',
    targetAttr: 'tour-reports',
    route: '/reports',
    icon: FileText,
  },
  {
    id: 'settings',
    title: 'Workspace Settings & Controls',
    subtitle: 'Customization & Replay',
    content: 'Configure country engineering defaults, company logos, voltage drop limits, or replay this guided product tour anytime!',
    targetAttr: 'tour-settings',
    route: '/settings',
    icon: Sparkles,
  },
];

export function OnboardingTour() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const storageKey = user?.id ? `procal_tour_completed_${user.id}` : 'procal_tour_completed_guest';

  // Restore active step from sessionStorage if resuming across page navigation
  useEffect(() => {
    const savedStepStr = sessionStorage.getItem('procal_tour_active_step');
    if (savedStepStr !== null) {
      const stepIdx = parseInt(savedStepStr, 10);
      if (!isNaN(stepIdx) && stepIdx >= 0 && stepIdx < TOUR_STEPS.length) {
        setActiveStep(stepIdx);
      }
    } else {
      const hasCompleted = localStorage.getItem(storageKey);
      if (!hasCompleted && user) {
        const timer = setTimeout(() => {
          goToStep(0);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [user, storageKey]);

  // Listen for manual "trigger-procal-tour" custom event
  useEffect(() => {
    const handleTrigger = () => {
      goToStep(0);
    };
    window.addEventListener('trigger-procal-tour', handleTrigger);
    return () => window.removeEventListener('trigger-procal-tour', handleTrigger);
  }, []);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return;
    setActiveStep(stepIndex);
    sessionStorage.setItem('procal_tour_active_step', String(stepIndex));

    const targetRoute = TOUR_STEPS[stepIndex].route;
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  }, [pathname, router]);

  // Update target bounding rect when step or pathname changes
  const updateTargetRect = useCallback(() => {
    if (activeStep < 0 || activeStep >= TOUR_STEPS.length) {
      setTargetRect(null);
      return;
    }
    const currentStep = TOUR_STEPS[activeStep];
    const el = document.querySelector(`[data-tour="${currentStep.targetAttr}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [activeStep]);

  useEffect(() => {
    // Retry finding element as page loads
    const timer1 = setTimeout(updateTargetRect, 100);
    const timer2 = setTimeout(updateTargetRect, 400);

    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect, pathname, activeStep]);

  const handleNext = () => {
    if (activeStep < TOUR_STEPS.length - 1) {
      goToStep(activeStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      goToStep(activeStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true');
    sessionStorage.removeItem('procal_tour_active_step');
    setActiveStep(-1);
  };

  if (activeStep < 0 || activeStep >= TOUR_STEPS.length) {
    return null;
  }

  const currentStep = TOUR_STEPS[activeStep];
  const Icon = currentStep.icon;
  const isFirst = activeStep === 0;
  const isLast = activeStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* Target Spotlight Cutout Box & Shadow */}
      {targetRect ? (
        <div
          style={{
            top: `${Math.max(4, targetRect.top - 6)}px`,
            left: `${Math.max(4, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.75), 0 0 25px rgba(234, 88, 12, 0.6)',
          }}
          className="absolute rounded-xl border-2 border-orange-500 pointer-events-none transition-all duration-300 z-40"
        />
      ) : (
        /* Full background overlay when no target element */
        <div
          className="absolute inset-0 bg-slate-950/75 transition-opacity duration-300"
          onClick={handleComplete}
        />
      )}

      {/* Tour Card Popover Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-50">
        <div className="pointer-events-auto w-full max-w-lg bg-slate-900/95 border border-orange-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-200 text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.3)]">
                <Icon size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{currentStep.title}</h3>
                <p className="text-xs text-orange-400 font-medium">{currentStep.subtitle}</p>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Tour"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="mb-6">
            <p className="text-sm text-slate-300 leading-relaxed">{currentStep.content}</p>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            {/* Step Counter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                Step <strong className="text-orange-400">{activeStep + 1}</strong> of {TOUR_STEPS.length}
              </span>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
              )}

              <button
                onClick={handleComplete}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 text-xs font-semibold text-white hover:from-orange-500 hover:to-amber-500 shadow-md shadow-orange-950/40 transition-all"
              >
                {isLast ? (
                  <>
                    <span>Finish</span>
                    <CheckCircle2 size={14} />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
