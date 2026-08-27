"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Calculator,
  Copy,
  Check,
  Pin,
  PinOff,
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  TraceDefinition,
  formatTraceAsPlainText,
} from "@/lib/calculations/trace-engine";
import { useTranslation } from "@/i18n";

export interface CalculationTracePopoverProps {
  trace: TraceDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

// ---------------------------------------------------------------------------
// Translation Helpers for Dynamic Trace Engine Content
// ---------------------------------------------------------------------------

function getTranslatedTitle(title: string, t: (key: string, fallback?: string, options?: Record<string, any>) => string): string {
  if (title.startsWith("Design Current Trace: ")) {
    const name = title.replace("Design Current Trace: ", "");
    return t("trace.titles.designCurrent", `Design Current Trace: ${name}`, { name });
  }
  if (title === "Design Current (Ib) Calculation Trace") {
    return t("trace.titles.designCurrentGeneric", "Design Current (Ib) Calculation Trace");
  }
  if (title.startsWith("Voltage Drop Trace: ")) {
    const name = title.replace("Voltage Drop Trace: ", "");
    return t("trace.titles.voltageDrop", `Voltage Drop Trace: ${name}`, { name });
  }
  if (title === "Voltage Drop Calculation Trace") {
    return t("trace.titles.voltageDropGeneric", "Voltage Drop Calculation Trace");
  }
  if (title.startsWith("Cable Ampacity Trace: ")) {
    const name = title.replace("Cable Ampacity Trace: ", "");
    return t("trace.titles.cableAmpacity", `Cable Ampacity Trace: ${name}`, { name });
  }
  if (title === "Cable Ampacity & Derating Trace") {
    return t("trace.titles.cableAmpacityGeneric", "Cable Ampacity & Derating Trace");
  }
  if (title.startsWith("Short Circuit Trace: ")) {
    const name = title.replace("Short Circuit Trace: ", "");
    return t("trace.titles.shortCircuit", `Short Circuit Trace: ${name}`, { name });
  }
  if (title.includes("Short Circuit") && title.includes("IEEE")) {
    return t("trace.titles.shortCircuitIeeeGeneric", "Short Circuit (IEEE / IEC 60909) Trace");
  }
  if (title.includes("Short Circuit") && title.includes("Trace")) {
    return t("trace.titles.shortCircuitGeneric", "Short Circuit (IEC 60909) Trace");
  }
  if (title.startsWith("Breaker Sizing Trace: ")) {
    const name = title.replace("Breaker Sizing Trace: ", "");
    return t("trace.titles.breakerSizing", `Breaker Sizing Trace: ${name}`, { name });
  }
  if (title === "Breaker Selection & Protection Trace") {
    return t("trace.titles.breakerSizingGeneric", "Breaker Selection & Protection Trace");
  }
  if (title.startsWith("Phase Balance Trace: ")) {
    const name = title.replace("Phase Balance Trace: ", "");
    return t("trace.titles.phaseBalance", `Phase Balance Trace: ${name}`, { name });
  }
  if (title === "Phase Balancing Trace") {
    return t("trace.titles.phaseBalanceGeneric", "Phase Balancing Trace");
  }
  return title;
}

function getTranslatedMetric(metric: string, t: (key: string, fallback?: string) => string): string {
  const metricMap: Record<string, string> = {
    "Design Current (Ib)": "trace.metrics.designCurrent",
    "Voltage Drop (ΔV%)": "trace.metrics.voltageDrop",
    "Derated Ampacity (Iz)": "trace.metrics.deratedAmpacity",
    "3-Phase Fault Level (Ik\")": "trace.metrics.faultLevel",
    "Breaker Rating (In)": "trace.metrics.breakerRating",
    "Phase Unbalance (%)": "trace.metrics.phaseUnbalance",
  };
  const key = metricMap[metric];
  return key ? t(key, metric) : metric;
}

function getTranslatedBadge(badge: string | undefined, t: (key: string, fallback?: string) => string): string {
  if (!badge || badge === "IEC Standards Verified") {
    return t("trace.iecStandardsVerified", "IEC Standards Verified");
  }
  if (badge === "NEC / NEMA Standards Verified") {
    return t("trace.necStandardsVerified", "NEC / NEMA Standards Verified");
  }
  if (badge === "IEEE / NEMA Standards Verified" || badge === "NEMA / IEEE Standards Verified") {
    return t("trace.ieeeStandardsVerified", "IEEE / NEMA Standards Verified");
  }
  return badge;
}

function getTranslatedStepLabel(label: string | undefined, t: (key: string, fallback?: string) => string): string | undefined {
  if (!label) return undefined;
  const labelMap: Record<string, string> = {
    "Demand Load Application": "trace.steps.demandLoadApp",
    "Three-Phase Design Current (Ib)": "trace.steps.threePhaseDesignCurrent",
    "Single-Phase Design Current (Ib)": "trace.steps.singlePhaseDesignCurrent",
    "Phase Impedance Component (Z)": "trace.steps.phaseImpedance",
    "Voltage Drop in Volts (ΔV)": "trace.steps.voltageDropVolts",
    "Percentage Voltage Drop (ΔV %)": "trace.steps.voltageDropPercent",
    "Combined Derating Factor (Ctot)": "trace.steps.combinedDerating",
    "Derated Cable Ampacity (Iz)": "trace.steps.deratedAmpacity",
    "Coordination Check (IEC 60364-4-43)": "trace.steps.coordinationCheckIec",
    "Coordination Check (NEC 240.4 & IEC 60364-4-43)": "trace.steps.coordinationCheckNec",
    "Transformer Internal Impedance (Zt)": "trace.steps.transformerImpedance",
    "Symmetrical Initial Short-Circuit Current (Ik\")": "trace.steps.symmetricalIsc",
    "Peak Short-Circuit Current (Ip)": "trace.steps.peakIsc",
    "Nominal Trip Rating Selection (In)": "trace.steps.nominalTripSelection",
    "Cable Protection Overload Condition": "trace.steps.cableProtectionOverload",
    "Ultimate Breaking Capacity (Icu) Verification": "trace.steps.breakingCapacityCheck",
    "Average Phase Current (I_avg)": "trace.steps.avgPhaseCurrent",
    "Maximum Phase Deviation (ΔI_max)": "trace.steps.maxPhaseDev",
    "Current Unbalance Percentage": "trace.steps.currentUnbalancePct",
  };
  const key = labelMap[label];
  return key ? t(key, label) : label;
}

function getTranslatedStepDescription(desc: string | undefined, t: (key: string, fallback?: string) => string): string | undefined {
  if (!desc) return undefined;
  const descMap: Record<string, string> = {
    "Effective cable AC resistance and reactance at operating temperature.": "trace.stepDescriptions.effectiveCableZ",
    "Three-phase line-to-line voltage drop": "trace.stepDescriptions.threePhaseVd",
    "Single-phase line-to-neutral loop voltage drop": "trace.stepDescriptions.singlePhaseVd",
    "Correction factors for ambient temperature, circuit grouping, and installation method.": "trace.stepDescriptions.correctionFactors",
    "Maximum continuous current capacity of the installed cable.": "trace.stepDescriptions.maxContinuousAmpacity",
    "Verifies cable is fully protected against overloads by upstream breaker.": "trace.stepDescriptions.cableOverloadProtection",
    "Maximum instantaneous peak value for electrodynamic stress verification.": "trace.stepDescriptions.peakStressVerification",
    "Trip rating chosen from standard IEC ratings to carry continuous design current without nuisance tripping.": "trace.stepDescriptions.tripRatingIec",
    "Trip rating chosen from standard NEC 240.6(A) ratings to carry continuous design current without nuisance tripping.": "trace.stepDescriptions.tripRatingNec",
    "Guarantees the cable conductor is shielded from thermal overload damage.": "trace.stepDescriptions.conductorThermalShield",
    "Ensures breaker safely clears prospective short-circuit energy without destruction.": "trace.stepDescriptions.breakerClearsIsc",
  };
  const key = descMap[desc];
  return key ? t(key, desc) : desc;
}

function getTranslatedParamName(name: string, t: (key: string, fallback?: string) => string): string {
  const paramMap: Record<string, string> = {
    "Active Power": "trace.params.activePower",
    "Demand Factor": "trace.params.demandFactor",
    "Power Factor": "trace.params.powerFactor",
    "Nominal Voltage": "trace.params.nominalVoltage",
    "Design Current": "trace.params.designCurrent",
    "Circuit Length": "trace.params.circuitLength",
    "Cable Section": "trace.params.cableSection",
    "Cable Size (NEC)": "trace.params.cableSizeNec",
    "Selected Cable Size": "trace.params.selectedCableSize",
    "Selected Cable Size (NEC)": "trace.params.selectedCableSizeNec",
    "Conductor Material": "trace.params.conductorMaterial",
    "Nominal System Voltage": "trace.params.nominalSystemVoltage",
    "Base Tabulated Ampacity": "trace.params.baseTabulatedAmpacity",
    "Ambient Temperature Factor": "trace.params.ambientTempFactor",
    "Grouping Factor": "trace.params.groupingFactor",
    "Insulation & Material": "trace.params.insulationMaterial",
    "Transformer Rating": "trace.params.transformerRating",
    "Transformer Impedance": "trace.params.transformerImpedance",
    "Nominal Secondary Voltage": "trace.params.nominalSecondaryVoltage",
    "Earthing System": "trace.params.earthingSystem",
    "Continuous Load Current": "trace.params.continuousLoadCurrent",
    "Selected Breaker Rating": "trace.params.selectedBreakerRating",
    "Breaker Frame Size": "trace.params.breakerFrameSize",
    "Breaking Capacity": "trace.params.breakingCapacity",
    "Phase L1 Current": "trace.params.phaseL1Current",
    "Phase L2 Current": "trace.params.phaseL2Current",
    "Phase L3 Current": "trace.params.phaseL3Current",
  };
  const key = paramMap[name];
  return key ? t(key, name) : name;
}

function getTranslatedParamSource(source: string, t: (key: string, fallback?: string) => string): string {
  const sourceMap: Record<string, string> = {
    "Equipment Schedule": "trace.sources.equipmentSchedule",
    "Diversity Table": "trace.sources.diversityTable",
    "Load Type Default": "trace.sources.loadTypeDefault",
    "400V (3-Phase)": "trace.sources.grid400V3Ph",
    "230V (1-Phase)": "trace.sources.grid230V1Ph",
    "Load Calculation": "trace.sources.loadCalculation",
    "Project Cable Routing": "trace.sources.projectCableRouting",
    "Cable Schedule": "trace.sources.cableSchedule",
    "Cable Schedule (NEC)": "trace.sources.cableScheduleNec",
    "Project Spec": "trace.sources.projectSpec",
    "Load Profile": "trace.sources.loadProfile",
    "3-Phase 400V Grid": "trace.sources.grid3Ph400V",
    "1-Phase 230V Grid": "trace.sources.grid1Ph230V",
    "Catalog Sizing": "trace.sources.catalogSizing",
    "NEC / Catalog Sizing": "trace.sources.necCatalogSizing",
    "Specification": "trace.sources.specification",
    "Main Substation": "trace.sources.mainSubstation",
    "Distribution Grid": "trace.sources.distributionGrid",
    "Project Earthing Spec": "trace.sources.projectEarthingSpec",
    "Load Sizing": "trace.sources.loadSizing",
    "Catalog Standard": "trace.sources.catalogStandard",
    "NEC 240.6(A) Standard": "trace.sources.necStandard2406A",
    "Manufacturer Series": "trace.sources.manufacturerSeries",
    "IEC 60947-2 Test Duty": "trace.sources.iec609472TestDuty",
    "NEMA AB-1 / UL 489 / IEC 60947-2": "trace.sources.nemaUlIec",
    "Sub-circuit aggregation": "trace.sources.subCircuitAggregation",
    "IEC 60076 Standard Table": "trace.sources.iec60076Table",
    "IEEE / ANSI Standard Table": "trace.sources.ieeeAnsiTable",
  };
  if (sourceMap[source]) {
    return t(sourceMap[source], source);
  }
  if (source.startsWith("Temp: ")) {
    return source.replace("Temp: ", t("trace.sources.tempPrefix", "Temp: "));
  }
  if (source.startsWith("Grouping: ")) {
    return source.replace("Grouping: ", t("trace.sources.groupingPrefix", "Grouping: "));
  }
  if (source.startsWith("IEC 60364-5-52 Table (")) {
    return source.replace("IEC 60364-5-52 Table (", t("trace.sources.iecTablePrefix", "IEC 60364-5-52 Table ("));
  }
  if (source.startsWith("NEC / IEC Table (")) {
    return source.replace("NEC / IEC Table (", t("trace.sources.necIecTablePrefix", "NEC / IEC Table ("));
  }
  return source;
}

function getTranslatedMargin(margin: string | undefined, t: (key: string, fallback?: string) => string): string | undefined {
  if (!margin) return undefined;
  let result = margin;
  if (result.includes("(Adequate)")) {
    result = result.replace("(Adequate)", `(${t("trace.complianceMargins.adequate", "Adequate")})`);
  }
  if (result.includes("(Exceeds Allowable Limit)")) {
    result = result.replace("(Exceeds Allowable Limit)", `(${t("trace.complianceMargins.exceedsLimit", "Exceeds Allowable Limit")})`);
  }
  if (result.includes("safety margin above In")) {
    result = result.replace("safety margin above In", t("trace.complianceMargins.safetyMarginAboveIn", "safety margin above In"));
  }
  if (result.includes("under breaker rating")) {
    result = result.replace("under breaker rating", t("trace.complianceMargins.underBreakerRating", "under breaker rating")).replace("Deficit:", t("trace.complianceMargins.deficit", "Deficit:"));
  }
  if (result.includes("under load current")) {
    result = result.replace("under load current", t("trace.complianceMargins.underLoadCurrent", "under load current")).replace("Deficit:", t("trace.complianceMargins.deficit", "Deficit:"));
  }
  if (result.includes("continuous margin")) {
    result = result.replace("continuous margin", t("trace.complianceMargins.continuousMargin", "continuous margin"));
  }
  if (result === "Requires Phase Rebalancing") {
    result = t("trace.complianceMargins.requiresRebalancing", "Requires Phase Rebalancing");
  }
  return result;
}

function getTranslatedNote(note: string, t: (key: string, fallback?: string) => string): string {
  if (note.startsWith("Allowable limit per standard:")) {
    return note.replace("Allowable limit per standard:", t("trace.notes.allowableLimitPerStandard", "Allowable limit per standard:"));
  }
  if (note === "Single circuit configuration.") {
    return t("trace.notes.singleCircuitConfig", "Single circuit configuration.");
  }
  return note;
}

function getTranslatedStatus(status: "PASS" | "WARN" | "FAIL", t: (key: string, fallback?: string) => string): string {
  switch (status) {
    case "PASS":
      return t("trace.statusPass", "PASS");
    case "WARN":
      return t("trace.statusWarn", "WARN");
    case "FAIL":
      return t("trace.statusFail", "FAIL");
    default:
      return status;
  }
}

export function CalculationTracePopover({
  trace,
  isOpen,
  onClose,
  anchorRect,
}: CalculationTracePopoverProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  }>({
    left: 20,
    maxHeight: 600,
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position and bounded maxHeight so the popover never clips off-screen
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (typeof window === "undefined") return;
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      const popoverWidth = Math.min(480, vWidth - 32);

      let left = anchorRect ? anchorRect.left : (vWidth - popoverWidth) / 2;
      // Clamp left so it stays inside the viewport with margin
      left = Math.max(16, Math.min(left, vWidth - popoverWidth - 16));

      let top: number | undefined = undefined;
      let bottom: number | undefined = undefined;
      let maxHeight = vHeight - 32;

      if (anchorRect) {
        const spaceBelow = vHeight - anchorRect.bottom - 16;
        const spaceAbove = anchorRect.top - 16;
        const measuredHeight = popoverRef.current ? popoverRef.current.offsetHeight : 540;

        if (spaceBelow >= Math.min(measuredHeight, 460) || spaceBelow >= spaceAbove) {
          // Open below anchor
          top = anchorRect.bottom + 8;
          maxHeight = Math.max(260, vHeight - top - 16);
        } else if (spaceAbove >= 280) {
          // Open above anchor
          bottom = vHeight - anchorRect.top + 8;
          maxHeight = Math.max(260, anchorRect.top - 16);
        } else {
          // Both spaces are cramped (e.g. small screen): center vertically in viewport
          top = Math.max(16, (vHeight - Math.min(measuredHeight, vHeight - 32)) / 2);
          maxHeight = vHeight - 32;
        }
      } else {
        // Center in viewport
        top = Math.max(16, (vHeight - Math.min(600, vHeight - 32)) / 2);
        maxHeight = vHeight - 32;
      }

      setCoords({ top, bottom, left, maxHeight });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, anchorRect, trace]);

  // Auto-close on escape key if not pinned
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPinned) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !isPinned
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isPinned, onClose]);

  if (!isOpen || !trace || !mounted) return null;

  const handleCopy = async () => {
    try {
      const text = formatTraceAsPlainText(trace);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const translatedTitle = getTranslatedTitle(trace.title, t);
  const translatedMetric = getTranslatedMetric(trace.metric, t);
  const translatedBadge = getTranslatedBadge(trace.standardBadge, t);

  const content = (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        zIndex: 99999,
        left: `${coords.left}px`,
        ...(coords.top !== undefined ? { top: `${coords.top}px` } : {}),
        ...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : {}),
        maxHeight: `${coords.maxHeight}px`,
      }}
      className="w-[92vw] sm:w-[480px] flex flex-col rounded-2xl border border-orange-500/40 bg-slate-950/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(234,88,12,0.15)] text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Popover Header */}
      <div className="p-3.5 px-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 shadow-xs">
            <Calculator size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white tracking-tight truncate flex items-center gap-1.5">
              <span>{translatedTitle}</span>
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
                {translatedMetric}: {trace.resultValue}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1 ${
              copied
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            }`}
            title={t("trace.copyTooltip", "Copy formula & calculation trace to clipboard")}
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="text-[11px] font-medium hidden sm:inline">
              {copied ? t("trace.copied", "Copied") : t("trace.copyMath", "Copy Math")}
            </span>
          </button>

          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isPinned
                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title={isPinned ? t("trace.unpinTooltip", "Unpin popover") : t("trace.pinTooltip", "Pin popover to stay open")}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={t("trace.close", "Close")}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Governing Standard Citation Bar */}
      <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <BookOpen size={12} className="text-amber-400 shrink-0" />
          <span className="font-medium text-slate-300">{trace.standardCitation}</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {translatedBadge}
        </span>
      </div>

      {/* Scrollable Body */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
        {/* Step-by-step Math Formulas */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-orange-400" />
            <span>{t("trace.mathFormulaSection", "Mathematical Formula & Substituted Values")}</span>
          </h5>

          <div className="space-y-2">
            {trace.steps.map((step, idx) => {
              const stepLabel = getTranslatedStepLabel(step.label, t);
              const stepDesc = getTranslatedStepDescription(step.description, t);

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-1.5 shadow-inner"
                >
                  {stepLabel && (
                    <div className="text-[11px] font-semibold text-orange-300/90 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>{stepLabel}</span>
                    </div>
                  )}

                  {/* Symbolic Formula */}
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">
                      {t("trace.formula", "Formula:")}
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/60 font-mono text-xs text-slate-200 overflow-x-auto tracking-wide whitespace-pre">
                      {step.formula}
                    </div>
                  </div>

                  {/* Substituted Numerical Values */}
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-orange-400/90 flex items-center gap-1">
                      <span>{t("trace.appliedCalculation", "Applied Calculation:")}</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-orange-950/20 border border-orange-900/30 font-mono text-xs text-orange-200 overflow-x-auto tracking-wide font-medium whitespace-pre">
                      {step.substituted}
                    </div>
                  </div>

                  {stepDesc && (
                    <p className="text-[10px] text-slate-400 italic pt-0.5 leading-tight">
                      {stepDesc}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Input Parameters & Provenance Table */}
        {trace.parameters.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers size={12} className="text-amber-400" />
              <span>{t("trace.parametersSection", "Input Parameters & Source Provenance")}</span>
            </h5>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden text-[11px]">
              <table className="w-full text-center">
                <thead className="bg-slate-900/90 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-3 text-center">{t("trace.parameter", "Parameter")}</th>
                    <th className="py-1.5 px-2 text-center">{t("trace.symbol", "Symbol")}</th>
                    <th className="py-1.5 px-2 text-center">{t("trace.value", "Value")}</th>
                    <th className="py-1.5 px-3 text-center">{t("trace.sourceOrigin", "Source / Origin")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {trace.parameters.map((p, i) => {
                    const paramName = getTranslatedParamName(p.name, t);
                    const paramSource = getTranslatedParamSource(p.source, t);

                    return (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-1.5 px-3 font-medium text-white text-center">{paramName}</td>
                        <td className="py-1.5 px-2 font-mono text-orange-400 text-center">{p.symbol}</td>
                        <td className="py-1.5 px-2 font-mono text-slate-100 text-center">
                          {p.value} {p.unit ? <span className="text-slate-400 text-[10px]">{p.unit}</span> : null}
                        </td>
                        <td className="py-1.5 px-3 text-[10px] text-center text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 inline-block truncate max-w-[150px]" title={paramSource}>
                            {paramSource}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compliance / Safety Margin Banner */}
        {trace.compliance && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              trace.compliance.status === "PASS"
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                : trace.compliance.status === "WARN"
                ? "bg-amber-950/40 border-amber-800/60 text-amber-200"
                : "bg-rose-950/40 border-rose-800/60 text-rose-200"
            }`}
          >
            {trace.compliance.status === "PASS" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : trace.compliance.status === "WARN" ? (
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-current">
                  {getTranslatedStatus(trace.compliance.status, t)}
                </span>
                <span className="font-semibold text-xs text-white">
                  {t("trace.complianceRule", "Compliance Rule:")} <code className="font-mono text-[11px] text-orange-300">{trace.compliance.rule}</code>
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {t("trace.calculatedValue", "Calculated Value:")} <strong>{trace.compliance.actual}</strong> {t("trace.vsLimit", "vs Limit:")} <strong>{trace.compliance.limit}</strong>
                {trace.compliance.margin ? ` (${getTranslatedMargin(trace.compliance.margin, t)})` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Engineering Notes */}
        {trace.notes && trace.notes.length > 0 && (
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 space-y-1">
            {trace.notes.map((note, idx) => (
              <p key={idx} className="text-[10px] text-slate-400 leading-tight">
                • {getTranslatedNote(note, t)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}