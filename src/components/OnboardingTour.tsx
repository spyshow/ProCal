'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import {
  Zap,
  Building2,
  CircuitBoard,
  GitBranch,
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
  icon: React.ElementType;
}

const TOUR_STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to ProCal',
    subtitle: 'Executive Electrical Engineering Suite',
    content: 'ProCal is an advanced electrical design suite for load calculation, vector phase balancing, IEC 60364 cable sizing, breaker selection, and Single Line Diagram (SLD) generation.',
    targetAttr: 'brand-logo',
    icon: Compass,
  },
  {
    id: 'projects',
    title: 'Active Project Selector',
    subtitle: 'Manage Buildings & Projects',
    content: 'Easily select your active project, switch between multi-building complexes (towers, malls, apartments), or manage your engineering project portfolio.',
    targetAttr: 'project-selector',
    icon: Building2,
  },
  {
    id: 'calculator',
    title: 'Load Calculator & Phase Balancing',
    subtitle: 'Electrical Demand Calculations',
    content: 'Calculate load currents, power factor displacement, demand factors, and vector neutral currents to ensure optimal 3-phase load balance across all floors.',
    targetAttr: 'tour-calculator',
    icon: Zap,
  },
  {
    id: 'breaker-schedule',
    title: 'Breaker & Cable Schedules',
    subtitle: 'IEC 60364 Sizing & Catalog Matching',
    content: 'Automatically size power cables and match MCB, MCCB, and ACB breaker families from top manufacturers like Schneider, ABB, and Siemens.',
    targetAttr: 'tour-breaker-schedule',
    icon: CircuitBoard,
  },
  {
    id: 'sld-designer',
    title: 'SLD Designer Workstation',
    subtitle: 'Interactive Single Line Diagram Editor',
    content: 'Inspect floor-by-floor Single Line Diagrams with collapsible tree explorer, interactive node details, and live schematic diagram rendering.',
    targetAttr: 'tour-sld',
    icon: GitBranch,
  },
  {
    id: 'reports',
    title: 'Executive PDF Reports',
    subtitle: 'Print & Export Drawing Packages',
    content: 'Generate executive summary cover reports with color-coded key performance cards, distribution hierarchy tables, and complete landscape drawing packages.',
    targetAttr: 'tour-reports',
    icon: FileText,
  },
  {
    id: 'controls',
    title: 'Workspace Controls & Settings',
    subtitle: 'Collapsible Menu & Customization',
    content: 'Collapse the sidebar anytime for an expanded workstation layout. You can also re-trigger this product tour anytime from the Settings page!',
    targetAttr: 'sidebar-toggle',
    icon: Sparkles,
  },
];

export function OnboardingTour() {
  const { user } = useUser();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const storageKey = user?.id ? `procal_tour_completed_${user.id}` : 'procal_tour_completed_guest';

  // Check if tour should auto-trigger on first sign-in
  useEffect(() => {
    const hasCompleted = localStorage.getItem(storageKey);
    if (!hasCompleted && user) {
      // Small delay for UI layout to settle
      const timer = setTimeout(() => {
        setActiveStep(0);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user, storageKey]);

  // Listen for manual "trigger-procal-tour" custom event
  useEffect(() => {
    const handleTrigger = () => {
      setActiveStep(0);
    };
    window.addEventListener('trigger-procal-tour', handleTrigger);
    return () => window.removeEventListener('trigger-procal-tour', handleTrigger);
  }, []);

  // Update target bounding rect when step changes
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
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  const handleNext = () => {
    if (activeStep < TOUR_STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true');
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
      {/* Background Dim Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleComplete}
      />

      {/* Target Spotlight Highlight Ring */}
      {targetRect && (
        <div
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
          className="absolute rounded-xl border-2 border-orange-500 shadow-[0_0_25px_rgba(234,88,12,0.6)] pointer-events-none transition-all duration-300 animate-pulse"
        />
      )}

      {/* Tour Card Popover Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-slate-900/95 border border-orange-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200 text-white">
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
