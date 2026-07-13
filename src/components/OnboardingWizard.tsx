"use client";

import { useState, useCallback } from "react";
import {
  Building2,
  Home,
  Zap,
  Calculator,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export interface OnboardingWizardProps {
  steps: WizardStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  title?: string;
  subtitle?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: WizardStep[];
  currentIndex: number;
}) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden mb-6">
        <div
          className="absolute top-0 left-0 h-full bg-orange-600 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Step circles and labels */}
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1 px-1"
            >
              <div
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-200 mb-2",
                  isCompleted
                    ? "bg-orange-600 border-orange-600 text-white"
                    : isActive
                    ? "bg-gray-800 border-orange-500 text-orange-400"
                    : "bg-gray-800 border-gray-700 text-gray-500",
                ].join(" ")}
              >
                {isCompleted ? (
                  <Check size={16} />
                ) : (
                  <step.icon size={16} />
                )}
              </div>
              <span
                className={[
                  "text-[10px] font-medium text-center leading-tight max-w-[80px]",
                  isActive ? "text-orange-400" : "text-gray-500",
                ].join(" ")}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between mb-2">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close wizard"
        className={[
          "p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800",
          "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
        ].join(" ")}
      >
        <X size={18} />
      </button>
    </div>
  );
}

function NavigationButtons({
  currentIndex,
  totalSteps,
  onBack,
  onNext,
  onComplete,
  canGoNext,
}: {
  currentIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  canGoNext: boolean;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-800 mt-6">
      <button
        onClick={onBack}
        disabled={isFirst}
        className={[
          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
          isFirst
            ? "text-gray-600 cursor-not-allowed"
            : "text-gray-300 hover:bg-gray-800 hover:text-white",
        ].join(" ")}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="text-xs text-gray-500">
        Step {currentIndex + 1} of {totalSteps}
      </div>

      {isLast ? (
        <button
          onClick={onComplete}
          disabled={!canGoNext}
          className={[
            "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
            canGoNext
              ? "bg-orange-600 hover:bg-orange-500 text-white"
              : "bg-orange-600/50 text-orange-100 cursor-not-allowed",
          ].join(" ")}
        >
          Finish
          <Check size={16} />
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={[
            "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
            canGoNext
              ? "bg-orange-600 hover:bg-orange-500 text-white"
              : "bg-orange-600/50 text-orange-100 cursor-not-allowed",
          ].join(" ")}
        >
          Next
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default steps for the IEC first-run workflow
// ---------------------------------------------------------------------------
export const DEFAULT_ONBOARDING_STEPS: WizardStep[] = [
  {
    id: "project",
    title: "Project",
    description: "Create your first project with location and standards.",
    icon: Building2,
    content: null,
  },
  {
    id: "building",
    title: "Building",
    description: "Add a building and define its floors and apartments.",
    icon: Home,
    content: null,
  },
  {
    id: "template",
    title: "Template",
    description: "Save an apartment template for reuse across floors.",
    icon: Zap,
    content: null,
  },
  {
    id: "loads",
    title: "Loads",
    description: "Enter the first floor item and let ProCal size the circuit.",
    icon: Calculator,
    content: null,
  },
  {
    id: "reports",
    title: "Reports",
    description: "Generate cable and breaker schedules instantly.",
    icon: FileText,
    content: null,
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function OnboardingWizard({
  steps,
  isOpen,
  onClose,
  onComplete,
  title = "Welcome to ProCal",
  subtitle = "Follow these steps to complete your first IEC electrical design.",
}: OnboardingWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const safeIndex = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const currentStep = steps[safeIndex];

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const handleBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!isOpen || steps.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl p-6 md:p-8">
        <WizardHeader
          title={title}
          subtitle={subtitle}
          onClose={onClose}
        />

        <StepIndicator steps={steps} currentIndex={safeIndex} />

        <div className="min-h-[180px]">
          <h3
            id="onboarding-title"
            className="text-lg font-semibold text-white mb-2"
          >
            {currentStep.title}
          </h3>
          <p className="text-sm text-gray-400 mb-6">
            {currentStep.description}
          </p>
          <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-5">
            {currentStep.content ?? (
              <p className="text-sm text-gray-500 italic">
                Step content is provided by the parent page.
              </p>
            )}
          </div>
        </div>

        <NavigationButtons
          currentIndex={safeIndex}
          totalSteps={steps.length}
          onBack={handleBack}
          onNext={handleNext}
          onComplete={handleComplete}
          canGoNext={true}
        />
      </div>
    </div>
  );
}
