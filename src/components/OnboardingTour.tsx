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

import { useTranslation } from '@/i18n';

interface Step {
  id: string;
  titleKey: string;
  titleDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  contentKey: string;
  contentDefault: string;
  targetAttr: string;
  route: string;
  icon: React.ElementType;
}

const RAW_TOUR_STEPS: Step[] = [
  {
    id: 'dashboard',
    titleKey: 'tour.dashboard.title',
    titleDefault: 'Dashboard & Engineering Metrics',
    subtitleKey: 'tour.dashboard.subtitle',
    subtitleDefault: 'Real-Time Project Overview',
    contentKey: 'tour.dashboard.content',
    contentDefault: 'Welcome to ProCal! The Dashboard provides real-time statistics on active electrical loads, maximum demand, and overall project summaries.',
    targetAttr: 'tour-dashboard',
    route: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'projects',
    titleKey: 'tour.projects.title',
    titleDefault: 'Projects & Building Management',
    subtitleKey: 'tour.projects.subtitle',
    subtitleDefault: 'Manage Projects & Buildings',
    contentKey: 'tour.projects.content',
    contentDefault: 'Manage your engineering project portfolio, create new projects, and configure multi-building complexes (residential towers, commercial malls, office blocks).',
    targetAttr: 'tour-projects',
    route: '/projects',
    icon: Building2,
  },
  {
    id: 'calculator',
    titleKey: 'tour.calculator.title',
    titleDefault: 'Load Calculator & Phase Balancing',
    subtitleKey: 'tour.calculator.subtitle',
    subtitleDefault: 'Electrical Demand & Neutral Current',
    contentKey: 'tour.calculator.content',
    contentDefault: 'Calculate load currents, power factor displacement angles, demand factors, and vector 3-phase neutral unbalance across all floors.',
    targetAttr: 'tour-calculator',
    route: '/calculator',
    icon: Zap,
  },
  {
    id: 'cable-schedule',
    titleKey: 'tour.cableSchedule.title',
    titleDefault: 'Cable Schedule & Derating',
    subtitleKey: 'tour.cableSchedule.subtitle',
    subtitleDefault: 'IEC 60364 Cable Sizing',
    contentKey: 'tour.cableSchedule.content',
    contentDefault: 'Automatically size copper/aluminum XLPE cables based on installation methods, ambient temperature, grouping factors, and voltage drop limits.',
    targetAttr: 'tour-cable-schedule',
    route: '/cable-schedule',
    icon: Cable,
  },
  {
    id: 'breaker-schedule',
    titleKey: 'tour.breakerSchedule.title',
    titleDefault: 'Breaker Schedule & Selection',
    subtitleKey: 'tour.breakerSchedule.subtitle',
    subtitleDefault: 'MCB, MCCB & ACB Catalog Matching',
    contentKey: 'tour.breakerSchedule.content',
    contentDefault: 'Match miniature circuit breakers (MCB), molded case circuit breakers (MCCB), and air circuit breakers (ACB) from Schneider, ABB, and Siemens.',
    targetAttr: 'tour-breaker-schedule',
    route: '/breaker-schedule',
    icon: CircuitBoard,
  },
  {
    id: 'panel-designer',
    titleKey: 'tour.panelDesigner.title',
    titleDefault: 'Panel Designer & Main Incomer',
    subtitleKey: 'tour.panelDesigner.subtitle',
    subtitleDefault: 'Busbar & Switchboard Configuration',
    contentKey: 'tour.panelDesigner.content',
    contentDefault: 'Configure main distribution boards (MDB) and sub-distribution boards (SMDB), transformer secondaries, and main busbar current ratings.',
    targetAttr: 'tour-panel',
    route: '/panel',
    icon: Cpu,
  },
  {
    id: 'riser-diagram',
    titleKey: 'tour.riserDiagram.title',
    titleDefault: 'Riser Diagram & Feeder Distribution',
    subtitleKey: 'tour.riserDiagram.subtitle',
    subtitleDefault: 'Vertical Building Power Distribution',
    contentKey: 'tour.riserDiagram.content',
    contentDefault: 'Visualize vertical electrical risers, feeder distribution trunks, and sub-panel floor connections throughout multi-story structures.',
    targetAttr: 'tour-riser',
    route: '/riser',
    icon: GitBranch,
  },
  {
    id: 'coordination',
    titleKey: 'tour.coordination.title',
    titleDefault: 'Protection Coordination',
    subtitleKey: 'tour.coordination.subtitle',
    subtitleDefault: 'Selectivity & Trip Curves',
    contentKey: 'tour.coordination.content',
    contentDefault: 'Analyze protection selectivity, discrimination, and tripping characteristics between upstream MCCBs/ACBs and downstream MCBs.',
    targetAttr: 'tour-coordination',
    route: '/coordination',
    icon: Shield,
  },
  {
    id: 'sld-designer',
    titleKey: 'tour.sldDesigner.title',
    titleDefault: 'SLD Designer Workstation',
    subtitleKey: 'tour.sldDesigner.subtitle',
    subtitleDefault: 'Interactive Single Line Diagrams',
    contentKey: 'tour.sldDesigner.content',
    contentDefault: 'Inspect floor-by-floor Single Line Diagrams with collapsible tree explorer, interactive node details, and live schematic rendering.',
    targetAttr: 'tour-sld',
    route: '/sld',
    icon: GitBranch,
  },
  {
    id: 'reports',
    titleKey: 'tour.reports.title',
    titleDefault: 'Executive PDF Reports',
    subtitleKey: 'tour.reports.subtitle',
    subtitleDefault: 'Print & Export Drawing Packages',
    contentKey: 'tour.reports.content',
    contentDefault: 'Generate executive summary cover reports with color-coded key performance cards, distribution hierarchy tables, and complete landscape drawing packages.',
    targetAttr: 'tour-reports',
    route: '/reports',
    icon: FileText,
  },
  {
    id: 'settings',
    titleKey: 'tour.settings.title',
    titleDefault: 'Workspace Settings & Controls',
    subtitleKey: 'tour.settings.subtitle',
    subtitleDefault: 'Customization & Replay',
    contentKey: 'tour.settings.content',
    contentDefault: 'Configure country engineering defaults, company logos, voltage drop limits, or replay this guided product tour anytime!',
    targetAttr: 'tour-settings',
    route: '/settings',
    icon: Sparkles,
  },
];

const RAW_CALCULATOR_TOUR_STEPS: Step[] = [
  {
    id: 'calc-summary',
    titleKey: 'tour.calcSummary.title',
    titleDefault: 'Load Demand Summary & Incomer Current',
    subtitleKey: 'tour.calcSummary.subtitle',
    subtitleDefault: 'Aggregated Electrical Demands',
    contentKey: 'tour.calcSummary.content',
    contentDefault: 'View total connected load (kW), maximum demand after diversity factors, and calculated incomer line current (A) for your selected building.',
    targetAttr: 'calc-summary',
    route: '/calculator',
    icon: Zap,
  },
  {
    id: 'calc-buildings',
    titleKey: 'tour.calcBuildings.title',
    titleDefault: 'Building Selector & Multi-Structure Tabs',
    subtitleKey: 'tour.calcBuildings.subtitle',
    subtitleDefault: 'Complex Building Tabs',
    contentKey: 'tour.calcBuildings.content',
    contentDefault: 'Switch between individual towers, commercial blocks, or podium buildings in your project to calculate their independent load schedules.',
    targetAttr: 'calc-buildings',
    route: '/calculator',
    icon: Building2,
  },
  {
    id: 'calc-building-loads',
    titleKey: 'tour.calcBuildingLoads.title',
    titleDefault: 'Mechanical & Central Building Loads',
    subtitleKey: 'tour.calcBuildingLoads.subtitle',
    subtitleDefault: 'Elevators, Pumps & Plant Equipment',
    contentKey: 'tour.calcBuildingLoads.content',
    contentDefault: 'Configure shared building mechanical loads such as passenger elevators, domestic booster pumps, and HVAC chillers.',
    targetAttr: 'calc-building-loads',
    route: '/calculator',
    icon: Cpu,
  },
  {
    id: 'calc-floors',
    titleKey: 'tour.calcFloors.title',
    titleDefault: 'Floor Load Designs & 3-Phase Phase Balance',
    subtitleKey: 'tour.calcFloors.subtitle',
    subtitleDefault: 'Floor Breakdown & Neutral Current',
    contentKey: 'tour.calcFloors.content',
    contentDefault: 'Inspect floor-by-floor loads, apartment template densities, and automatic vector phase balancing (L1, L2, L3) to prevent neutral overload.',
    targetAttr: 'calc-floors',
    route: '/calculator',
    icon: CircuitBoard,
  },
];

const RAW_CABLE_SCHEDULE_TOUR_STEPS: Step[] = [
  {
    id: 'cable-header',
    titleKey: 'tour.cableHeader.title',
    titleDefault: 'Cable Schedule & IEC 60364 Sizing',
    subtitleKey: 'tour.cableHeader.subtitle',
    subtitleDefault: 'Conductor Sizing Standards',
    contentKey: 'tour.cableHeader.content',
    contentDefault: 'Automatically size phase conductors, neutral conductors, and protective earth (PE) conductors in compliance with IEC 60364-5-52.',
    targetAttr: 'cable-header',
    route: '/cable-schedule',
    icon: Cable,
  },
  {
    id: 'cable-derating',
    titleKey: 'tour.cableDerating.title',
    titleDefault: 'Derating Factors & Installation Methods',
    subtitleKey: 'tour.cableDerating.subtitle',
    subtitleDefault: 'Insulation & Ambient Conditions',
    contentKey: 'tour.cableDerating.content',
    contentDefault: 'Configure cable insulation (XLPE/PVC), installation method (perforated tray, direct buried, conduit), ambient temperature, and grouping derating factors.',
    targetAttr: 'cable-derating',
    route: '/cable-schedule',
    icon: Sparkles,
  },
  {
    id: 'cable-table',
    titleKey: 'tour.cableTable.title',
    titleDefault: 'Calculated Cable Sizing Table',
    subtitleKey: 'tour.cableTable.subtitle',
    subtitleDefault: 'Cross-Sections & Voltage Drop',
    contentKey: 'tour.cableTable.content',
    contentDefault: 'Review recommended conductor cross-sections (mm²), voltage drop percentage (%ΔV), and short-circuit withstand capability.',
    targetAttr: 'cable-table',
    route: '/cable-schedule',
    icon: FileText,
  },
];

const RAW_BREAKER_SCHEDULE_TOUR_STEPS: Step[] = [
  {
    id: 'breaker-header',
    titleKey: 'tour.breakerHeader.title',
    titleDefault: 'Breaker Schedule & Catalog Selector',
    subtitleKey: 'tour.breakerHeader.subtitle',
    subtitleDefault: 'Manufacturer Database Matching',
    contentKey: 'tour.breakerHeader.content',
    contentDefault: 'Match circuit breakers across MCB, MCCB, and ACB categories from Schneider Electric, ABB, and Siemens catalog databases.',
    targetAttr: 'breaker-header',
    route: '/breaker-schedule',
    icon: CircuitBoard,
  },
  {
    id: 'breaker-family-select',
    titleKey: 'tour.breakerFamilySelect.title',
    titleDefault: 'Default Breaker Family Selection',
    subtitleKey: 'tour.breakerFamilySelect.subtitle',
    subtitleDefault: 'Configured Series & Product Lines',
    contentKey: 'tour.breakerFamilySelect.content',
    contentDefault: 'Configure default series (e.g. Acti9 iC60N, ComPacT NSX, MasterPact MTZ) for final distribution and main incomers.',
    targetAttr: 'breaker-family-select',
    route: '/breaker-schedule',
    icon: Sparkles,
  },
  {
    id: 'breaker-table',
    titleKey: 'tour.breakerTable.title',
    titleDefault: 'Distribution Circuit Breaker Table',
    subtitleKey: 'tour.breakerTable.subtitle',
    subtitleDefault: 'Trip Ratings & Breaking Capacity',
    contentKey: 'tour.breakerTable.content',
    contentDefault: 'Inspect nominal trip ratings (In), pole configurations (1P/3P/4P), breaking capacities (Icu), and trip unit parameters.',
    targetAttr: 'breaker-table',
    route: '/breaker-schedule',
    icon: FileText,
  },
];

const RAW_SLD_TOUR_STEPS: Step[] = [
  {
    id: 'sld-header',
    titleKey: 'tour.sldHeader.title',
    titleDefault: 'Single Line Diagram (SLD) Workstation',
    subtitleKey: 'tour.sldHeader.subtitle',
    subtitleDefault: 'Interactive CAD Schematic Editor',
    contentKey: 'tour.sldHeader.content',
    contentDefault: 'View, edit, and export floor-by-floor Single Line Diagrams with live schematic rendering and component hierarchy.',
    targetAttr: 'sld-header',
    route: '/sld',
    icon: GitBranch,
  },
  {
    id: 'sld-tree',
    titleKey: 'tour.sldTree.title',
    titleDefault: 'Distribution Hierarchy Explorer',
    subtitleKey: 'tour.sldTree.subtitle',
    subtitleDefault: 'Sub-Panel Tree Navigation',
    contentKey: 'tour.sldTree.content',
    contentDefault: 'Navigate incomer transformers, main distribution boards (MDB), sub-main panels (SMDB), and final distribution boards (FDB).',
    targetAttr: 'sld-tree',
    route: '/sld',
    icon: GitBranch,
  },
  {
    id: 'sld-canvas',
    titleKey: 'tour.sldCanvas.title',
    titleDefault: 'Schematic Diagram Canvas & Print Controls',
    subtitleKey: 'tour.sldCanvas.subtitle',
    subtitleDefault: 'Live CAD View & PDF Export',
    contentKey: 'tour.sldCanvas.content',
    contentDefault: 'Inspect electrical schematic symbols, breaker ratings, cable tags, and print full-bleed landscape PDF engineering drawing sheets.',
    targetAttr: 'sld-canvas',
    route: '/sld',
    icon: FileText,
  },
];

type TourMode = 'full' | 'calculator' | 'cable-schedule' | 'breaker-schedule' | 'sld';

export function OnboardingTour() {
  const { user } = useUser();
  const { t, isRtl } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [tourMode, setTourMode] = useState<TourMode>('full');
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const rawStepsList =
    tourMode === 'calculator'
      ? RAW_CALCULATOR_TOUR_STEPS
      : tourMode === 'cable-schedule'
      ? RAW_CABLE_SCHEDULE_TOUR_STEPS
      : tourMode === 'breaker-schedule'
      ? RAW_BREAKER_SCHEDULE_TOUR_STEPS
      : tourMode === 'sld'
      ? RAW_SLD_TOUR_STEPS
      : RAW_TOUR_STEPS;

  const stepsList = rawStepsList.map((s) => ({
    id: s.id,
    title: t(s.titleKey, s.titleDefault),
    subtitle: t(s.subtitleKey, s.subtitleDefault),
    content: t(s.contentKey, s.contentDefault),
    targetAttr: s.targetAttr,
    route: s.route,
    icon: s.icon,
  }));

  const storageKey = user?.id ? `procal_tour_completed_${user.id}` : 'procal_tour_completed_guest';

  // Restore active step from sessionStorage if resuming across page navigation
  useEffect(() => {
    const savedMode = sessionStorage.getItem('procal_tour_mode') as TourMode | null;
    if (savedMode) {
      setTourMode(savedMode);
    }
    const savedStepStr = sessionStorage.getItem('procal_tour_active_step');
    if (savedStepStr !== null) {
      const stepIdx = parseInt(savedStepStr, 10);
      if (!isNaN(stepIdx) && stepIdx >= 0) {
        setActiveStep(stepIdx);
      }
    } else {
      const hasCompleted = localStorage.getItem(storageKey);
      if (!hasCompleted && user) {
        const timer = setTimeout(() => {
          setTourMode('full');
          goToStep(0, 'full');
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [user, storageKey]);

  // Listen for manual tour trigger custom events
  useEffect(() => {
    const handleFullTour = () => {
      setTourMode('full');
      sessionStorage.setItem('procal_tour_mode', 'full');
      goToStep(0, 'full');
    };

    const handleCalculatorTour = () => {
      setTourMode('calculator');
      sessionStorage.setItem('procal_tour_mode', 'calculator');
      goToStep(0, 'calculator');
    };

    const handleCableTour = () => {
      setTourMode('cable-schedule');
      sessionStorage.setItem('procal_tour_mode', 'cable-schedule');
      goToStep(0, 'cable-schedule');
    };

    const handleBreakerTour = () => {
      setTourMode('breaker-schedule');
      sessionStorage.setItem('procal_tour_mode', 'breaker-schedule');
      goToStep(0, 'breaker-schedule');
    };

    const handleSldTour = () => {
      setTourMode('sld');
      sessionStorage.setItem('procal_tour_mode', 'sld');
      goToStep(0, 'sld');
    };

    window.addEventListener('trigger-procal-tour', handleFullTour);
    window.addEventListener('trigger-procal-calculator-tour', handleCalculatorTour);
    window.addEventListener('trigger-procal-cable-schedule-tour', handleCableTour);
    window.addEventListener('trigger-procal-breaker-schedule-tour', handleBreakerTour);
    window.addEventListener('trigger-procal-sld-tour', handleSldTour);

    return () => {
      window.removeEventListener('trigger-procal-tour', handleFullTour);
      window.removeEventListener('trigger-procal-calculator-tour', handleCalculatorTour);
      window.removeEventListener('trigger-procal-cable-schedule-tour', handleCableTour);
      window.removeEventListener('trigger-procal-breaker-schedule-tour', handleBreakerTour);
      window.removeEventListener('trigger-procal-sld-tour', handleSldTour);
    };
  }, []);

  const goToStep = useCallback((stepIndex: number, modeOverride?: TourMode) => {
    const activeMode = modeOverride || tourMode;
    const activeSteps =
      activeMode === 'calculator'
        ? RAW_CALCULATOR_TOUR_STEPS
        : activeMode === 'cable-schedule'
        ? RAW_CABLE_SCHEDULE_TOUR_STEPS
        : activeMode === 'breaker-schedule'
        ? RAW_BREAKER_SCHEDULE_TOUR_STEPS
        : activeMode === 'sld'
        ? RAW_SLD_TOUR_STEPS
        : RAW_TOUR_STEPS;

    if (stepIndex < 0 || stepIndex >= activeSteps.length) return;

    setActiveStep(stepIndex);
    sessionStorage.setItem('procal_tour_active_step', String(stepIndex));

    const targetRoute = activeSteps[stepIndex].route;
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  }, [pathname, router, tourMode]);

  // Update target bounding rect when step or pathname changes
  const updateTargetRect = useCallback(() => {
    if (activeStep < 0 || activeStep >= stepsList.length) {
      setTargetRect(null);
      return;
    }
    const currentStep = stepsList[activeStep];
    const el = document.querySelector(`[data-tour="${currentStep.targetAttr}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [activeStep, stepsList]);

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
    if (activeStep < stepsList.length - 1) {
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
    sessionStorage.removeItem('procal_tour_mode');
    setActiveStep(-1);
  };

  if (activeStep < 0 || activeStep >= stepsList.length) {
    return null;
  }

  const currentStep = stepsList[activeStep];
  const Icon = currentStep.icon;
  const isFirst = activeStep === 0;
  const isLast = activeStep === stepsList.length - 1;

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

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
              title={t('tour.close', 'Close Tour')}
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
                {t('tour.step', 'Step')} <strong className="text-orange-400">{activeStep + 1}</strong> {t('tour.of', 'of')} {stepsList.length}
              </span>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <PrevIcon size={14} />
                  {t('tour.back', 'Back')}
                </button>
              )}

              <button
                onClick={handleComplete}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {t('tour.skip', 'Skip')}
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 text-xs font-semibold text-white hover:from-orange-500 hover:to-amber-500 shadow-md shadow-orange-950/40 transition-all"
              >
                {isLast ? (
                  <>
                    <span>{t('tour.finish', 'Finish')}</span>
                    <CheckCircle2 size={14} />
                  </>
                ) : (
                  <>
                    <span>{t('tour.next', 'Next')}</span>
                    <NextIcon size={14} />
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
