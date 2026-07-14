"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useCallback, useEffect } from "react";
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
  Loader2,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { RoomList } from "@/components/RoomList";
import type { RoomData } from "@/components/RoomInput";
import {
  COUNTRY_DEFAULTS,
  getCountryDefaults,
  calculateRoomLoad,
} from "@/lib/country-defaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content?: React.ReactNode;
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
  isLoading,
}: {
  currentIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => Promise<void> | void;
  onComplete: () => void;
  canGoNext: boolean;
  isLoading: boolean;
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-800 mt-6">
      <button
        onClick={onBack}
        disabled={isFirst || isLoading}
        className={[
          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
          isFirst || isLoading
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
          disabled={isLoading}
          className={[
            "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
            isLoading
              ? "bg-orange-600/50 text-orange-100 cursor-not-allowed"
              : "bg-orange-600 hover:bg-orange-500 text-white",
          ].join(" ")}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          Finish
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={!canGoNext || isLoading}
          className={[
            "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-orange-500 outline-none",
            canGoNext && !isLoading
              ? "bg-orange-600 hover:bg-orange-500 text-white"
              : "bg-orange-600/50 text-orange-100 cursor-not-allowed",
          ].join(" ")}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Next
              <ChevronRight size={16} />
            </>
          )}
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
  },
  {
    id: "building",
    title: "Building",
    description: "Add a building and define its floors and apartments.",
    icon: Home,
  },
  {
    id: "template",
    title: "Template",
    description: "Save an apartment template for reuse across floors.",
    icon: Zap,
  },
  {
    id: "loads",
    title: "Loads",
    description: "Enter the first floor item and let ProCal size the circuit.",
    icon: Calculator,
  },
  {
    id: "reports",
    title: "Reports",
    description: "Generate cable and breaker schedules instantly.",
    icon: FileText,
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
  const { selectProject } = useProject();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Created resources
  const [createdProject, setCreatedProject] = useState<{ id: string; name: string } | null>(null);
  const [createdBuilding, setCreatedBuilding] = useState<{ id: string; name: string } | null>(null);
  const [firstFloorDesignId, setFirstFloorDesignId] = useState<string | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<{ id: string; name: string } | null>(null);

  // Project form
  const [projectForm, setProjectForm] = useState({
    name: "Sample Project",
    country: "Syria",
    voltage: "400",
    frequency: "50",
    powerFactor: "0.85",
    maxDemandFactor: "0.8",
  });

  // Building form
  const [buildingForm, setBuildingForm] = useState({
    name: "Tower A",
    floors: "10",
    serviceFloors: "0",
    apartmentsPerFloor: "4",
  });

  // Template form
  const [templateForm, setTemplateForm] = useState({
    name: "Type A – 2BR",
    phases: "1",
  });
  const [templateRooms, setTemplateRooms] = useState<RoomData[]>(() => {
    const defaults = getCountryDefaults("Syria");
    return [
      { id: "r1", type: "LIVING_ROOM", name: "Living Room", area: 25, hasAc: true, loadDensity: 100, connectedLoad: calculateRoomLoad(25, 100, true, defaults.acSizingRules) },
      { id: "r2", type: "BEDROOM", name: "Master Bedroom", area: 16, hasAc: true, loadDensity: 80, connectedLoad: calculateRoomLoad(16, 80, true, defaults.acSizingRules) },
      { id: "r3", type: "BEDROOM", name: "Bedroom 2", area: 12, hasAc: true, loadDensity: 80, connectedLoad: calculateRoomLoad(12, 80, true, defaults.acSizingRules) },
      { id: "r4", type: "KITCHEN", name: "Kitchen", area: 10, hasAc: false, loadDensity: 150, connectedLoad: calculateRoomLoad(10, 150, false, defaults.acSizingRules) },
      { id: "r5", type: "BATHROOM", name: "Bathroom", area: 6, hasAc: false, loadDensity: 60, connectedLoad: calculateRoomLoad(6, 60, false, defaults.acSizingRules) },
    ];
  });

  // Load form
  const [itemName, setItemName] = useState("Apartment 101");

  const safeIndex = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const currentStep = steps[safeIndex];

  // Apply country defaults to room densities/loads when the country changes.
  const [appliedCountry, setAppliedCountry] = useState(projectForm.country);
  if (projectForm.country !== appliedCountry) {
    const defaults = getCountryDefaults(projectForm.country);
    setTemplateRooms((prev) =>
      prev.map((room) => {
        const density =
          defaults.roomDensities[
            room.type.toLowerCase() as keyof typeof defaults.roomDensities
          ] || room.loadDensity;
        return {
          ...room,
          loadDensity: density,
          connectedLoad: calculateRoomLoad(
            room.area,
            density,
            room.hasAc,
            defaults.acSizingRules
          ),
        };
      })
    );
    setAppliedCountry(projectForm.country);
  }

  const createProject = async (): Promise<boolean> => {
    setIsLoading(true);
    setStepError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...projectForm,
          client: "",
          consultant: "",
          contractor: "",
          location: "",
          engineer: "",
          notes: "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create project");
      }
      const project = await res.json();
      setCreatedProject({ id: project.id, name: project.name });
      selectProject(project.id);
      return true;
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Failed to create project");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createBuilding = async (): Promise<boolean> => {
    if (!createdProject) return false;
    setIsLoading(true);
    setStepError(null);
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildingForm,
          projectId: createdProject.id,
          lightningProtection: false,
          supplyVoltage: "400V 3-Phase",
          earthingSystem: "TN-S",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create building");
      }
      const building = await res.json();
      setCreatedBuilding({ id: building.id, name: building.name });

      // Fetch full project details to locate Floor 1
      const projectRes = await fetch(`/api/projects/${createdProject.id}`);
      if (!projectRes.ok) {
        throw new Error("Failed to load project details");
      }
      const project = await projectRes.json();
      interface FetchedFloorDesign {
        id: string;
        floorNumber: number;
      }
      interface FetchedBuilding {
        id: string;
        floorDesigns?: FetchedFloorDesign[];
      }
      const bldg = (project.buildings as FetchedBuilding[] | undefined)?.find((b) => b.id === building.id);
      const firstFloor = bldg?.floorDesigns?.find((fd) => fd.floorNumber === 1);
      if (!firstFloor?.id) {
        throw new Error("No first floor found");
      }
      setFirstFloorDesignId(firstFloor.id);
      return true;
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Failed to create building");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (): Promise<boolean> => {
    if (!createdProject) return false;
    setIsLoading(true);
    setStepError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: createdProject.id,
          name: templateForm.name,
          phases: Number(templateForm.phases),
          rooms: templateRooms.map(({ id, ...rest }) => rest),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create template");
      }
      const tpl = await res.json();
      setCreatedTemplate({ id: tpl.id, name: tpl.name });
      return true;
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Failed to create template");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createFloorItem = async (): Promise<boolean> => {
    if (!firstFloorDesignId || !createdTemplate) return false;
    setIsLoading(true);
    setStepError(null);
    try {
      const res = await fetch(`/api/floors/${firstFloorDesignId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "APARTMENT",
          name: itemName,
          apartmentTemplateId: createdTemplate.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add floor item");
      }
      return true;
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Failed to add floor item");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    let ok = true;
    if (safeIndex === 0) {
      ok = await createProject();
    } else if (safeIndex === 1) {
      ok = await createBuilding();
    } else if (safeIndex === 2) {
      ok = await createTemplate();
    } else if (safeIndex === 3) {
      ok = await createFloorItem();
    }
    if (!ok) return;
    setStepError(null);
    setCurrentIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setStepError(null);
  };

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const canGoNext = (() => {
    switch (currentStep.id) {
      case "project":
        return projectForm.name.trim().length > 0;
      case "building":
        return (
          createdProject != null &&
          buildingForm.name.trim().length > 0 &&
          Number(buildingForm.floors) > 0 &&
          Number(buildingForm.apartmentsPerFloor) > 0
        );
      case "template":
        return (
          createdProject != null &&
          templateForm.name.trim().length > 0 &&
          templateRooms.length > 0
        );
      case "loads":
        return (
          firstFloorDesignId != null &&
          createdTemplate != null &&
          itemName.trim().length > 0
        );
      case "reports":
        return true;
      default:
        return true;
    }
  })();

  const renderProjectStep = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Project Name *</label>
        <input
          value={projectForm.name}
          onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
          className="dense-input w-full rounded"
          placeholder="e.g. Marina Residence"
          required
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Country *</label>
        <select
          value={projectForm.country}
          onChange={(e) => {
            const country = e.target.value;
            const defaults = COUNTRY_DEFAULTS[country];
            setProjectForm({
              ...projectForm,
              country,
              voltage: String(defaults?.voltage || 400),
              frequency: String(defaults?.frequency || 50),
              powerFactor: String(defaults?.powerFactor || 0.85),
            });
          }}
          className="dense-input w-full rounded"
        >
          {Object.keys(COUNTRY_DEFAULTS).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Voltage (V)</label>
          <input
            value={projectForm.voltage}
            onChange={(e) => setProjectForm({ ...projectForm, voltage: e.target.value })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Frequency (Hz)</label>
          <input
            value={projectForm.frequency}
            onChange={(e) => setProjectForm({ ...projectForm, frequency: e.target.value })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Power Factor</label>
          <input
            value={projectForm.powerFactor}
            onChange={(e) => setProjectForm({ ...projectForm, powerFactor: e.target.value })}
            className="dense-input w-full rounded"
          />
        </div>
      </div>
    </div>
  );

  const renderBuildingStep = () => (
    <div className="space-y-3">
      {createdProject && (
        <p className="text-xs text-gray-500">
          Project: <span className="text-gray-300 font-medium">{createdProject.name}</span>
        </p>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Building Name *</label>
        <input
          value={buildingForm.name}
          onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
          className="dense-input w-full rounded"
          placeholder="e.g. Tower A"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Floors *</label>
          <input
            type="number"
            min="1"
            value={buildingForm.floors}
            onChange={(e) => setBuildingForm({ ...buildingForm, floors: e.target.value })}
            className="dense-input w-full rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Apartments / Floor *</label>
          <input
            type="number"
            min="1"
            value={buildingForm.apartmentsPerFloor}
            onChange={(e) => setBuildingForm({ ...buildingForm, apartmentsPerFloor: e.target.value })}
            className="dense-input w-full rounded"
          />
        </div>
      </div>
    </div>
  );

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Template Name *</label>
          <input
            value={templateForm.name}
            onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
            className="dense-input w-full rounded"
            placeholder="e.g. Type A – 2BR"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-400 mb-1">Phase</label>
          <select
            value={templateForm.phases}
            onChange={(e) => setTemplateForm({ ...templateForm, phases: e.target.value })}
            className="dense-input w-full rounded"
          >
            <option value="1">1Φ</option>
            <option value="3">3Φ</option>
          </select>
        </div>
      </div>
      <RoomList
        rooms={templateRooms}
        onChange={setTemplateRooms}
        country={projectForm.country}
      />
    </div>
  );

  const renderLoadsStep = () => (
    <div className="space-y-4">
      {createdTemplate && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-xs text-gray-500">
            Apartment Template: <span className="text-gray-300 font-medium">{createdTemplate.name}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Floor: <span className="text-gray-300 font-medium">1</span>
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">First Floor Item Name *</label>
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="dense-input w-full rounded"
          placeholder="e.g. Apartment 101"
        />
      </div>
      <p className="text-xs text-gray-500">
        This creates the first apartment item on Floor 1 and sizes its breaker and cable automatically.
      </p>
    </div>
  );

  const renderReportsStep = () => (
    <div className="space-y-4 text-center py-2">
      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
        <Check size={28} className="text-green-500" />
      </div>
      <div>
        <h4 className="text-base font-semibold text-white">Sample Project Ready</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          You created <span className="text-gray-200">{createdProject?.name || "a project"}</span> with a building,
          apartment template, and a first-floor item.
        </p>
      </div>
      <p className="text-xs text-gray-500">
        Finish to open the dashboard, then visit Reports to generate cable and breaker schedules.
      </p>
    </div>
  );

  const renderStepContent = () => {
    if (currentStep.content) return currentStep.content;
    switch (currentStep.id) {
      case "project":
        return renderProjectStep();
      case "building":
        return renderBuildingStep();
      case "template":
        return renderTemplateStep();
      case "loads":
        return renderLoadsStep();
      case "reports":
        return renderReportsStep();
      default:
        return (
          <p className="text-sm text-gray-500 italic">
            Step content is provided by the parent page.
          </p>
        );
    }
  };

  if (!isOpen || steps.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        <WizardHeader title={title} subtitle={subtitle} onClose={onClose} />

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

          {stepError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs text-red-400">{stepError}</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-5">
            {renderStepContent()}
          </div>
        </div>

        <NavigationButtons
          currentIndex={safeIndex}
          totalSteps={steps.length}
          onBack={handleBack}
          onNext={handleNext}
          onComplete={handleComplete}
          canGoNext={canGoNext}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
