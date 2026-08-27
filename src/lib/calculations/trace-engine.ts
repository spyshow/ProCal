/**
 * Calculation Trace Engine ("Show Your Work")
 *
 * Provides on-demand, step-by-step mathematical traces, substituted values,
 * parameter provenance, governing standard citations (IEC / NEC / NEMA / IEEE),
 * and compliance checks for all engineering calculations across ProCal schedules.
 */

import { CABLE_CATALOG } from "./cablesData";
import { clampPowerFactor } from "./validate";
import { sourceXrRatio, splitSourceImpedance } from "./shortCircuit";
import { currentUnbalancePct } from "./phaseBalance";
import { codeOf, CodeStandard } from "./codes";
import { formatCableSizeFor } from "./cables";

export interface TraceParameter {
  name: string;
  symbol: string;
  value: string | number;
  unit?: string;
  source: string; // e.g. "Project Settings", "Table B.52.14", "User Input", "Calculated"
}

export interface TraceStep {
  label?: string;
  formula: string; // Symbolic mathematical equation
  substituted: string; // Substituted numbers with intermediate / final result
  description?: string;
}

export interface TraceCompliance {
  status: "PASS" | "WARN" | "FAIL";
  rule: string;
  actual: string;
  limit: string;
  margin?: string;
}

export interface TraceDefinition {
  id?: string;
  title: string;
  metric: string;
  resultValue: string;
  resultUnit?: string;
  standardCitation: string; // e.g. "IEC 60364-5-52 §525" or "NEC 210.19(A)"
  standardBadge?: string; // e.g. "IEC Standards Verified" or "NEC / NEMA Standards Verified"
  code?: CodeStandard;
  steps: TraceStep[];
  parameters: TraceParameter[];
  compliance?: TraceCompliance;
  notes?: string[];
}

// ---------------------------------------------------------------------------
// 1. Voltage Drop Trace (ΔV & ΔV%)
// ---------------------------------------------------------------------------
export interface VoltageDropTraceInputs {
  circuitName?: string;
  currentA: number; // Ib
  lengthM: number; // L
  cableSizeMm2: number; // S
  parallelRuns?: number;
  conductorMaterial?: "copper" | "aluminum";
  insulation?: "PVC" | "XLPE";
  powerFactor?: number; // cos(phi)
  systemVoltageV: number; // e.g. 400 or 230
  isThreePhase: boolean;
  dropVolts: number;
  dropPercent: number;
  maxDropPercentLimit?: number; // default 3.0% (lighting/sub-circuits) or 5.0%
  rOhmPerKm?: number;
  xOhmPerKm?: number;
  calculationStandard?: string | null;
  code?: CodeStandard;
  sourceNotes?: {
    lengthSource?: string;
    cableSource?: string;
    tempSource?: string;
  };
}

export function buildVoltageDropTrace(inputs: VoltageDropTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const is3Ph = inputs.isThreePhase;
  const runs = Math.max(1, inputs.parallelRuns || 1);
  const cosPhi = clampPowerFactor(inputs.powerFactor ?? 0.85);
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const b = is3Ph ? 1.732 : 2.0;
  const limit = inputs.maxDropPercentLimit ?? (is3Ph ? 5.0 : 3.0);

  // Default R/X from the SAME catalog lookup calculateVoltageDrop uses
  // (exact match, else floor to the nearest size below; aluminum pays the
  // resistivity ratio) so the trace displays the impedance the engine
  // actually used — not a parallel estimate that can drift from it.
  const spec =
    CABLE_CATALOG.find((c) => c.size === inputs.cableSizeMm2) ??
    CABLE_CATALOG.filter((c) => c.size <= inputs.cableSizeMm2).pop() ??
    CABLE_CATALOG[0];
  const materialFactor = inputs.conductorMaterial === "aluminum" ? 0.0283 / 0.0172 : 1;
  const rNominal = inputs.rOhmPerKm ?? spec.resistance * materialFactor;
  const xNominal = inputs.xOhmPerKm ?? spec.reactance;
  const rEff = rNominal / runs;
  const xEff = xNominal / runs;
  const impedance = rEff * cosPhi + xEff * sinPhi;

  const passed = inputs.dropPercent <= limit;
  const margin = (limit - inputs.dropPercent).toFixed(2);

  const steps: TraceStep[] = [
    {
      label: "Phase Impedance Component (Z)",
      formula: "Z = (R · cos φ + X · sin φ) / runs",
      substituted: `Z = (${rNominal.toFixed(4)} × ${cosPhi.toFixed(2)} + ${xNominal.toFixed(4)} × ${sinPhi.toFixed(3)}) / ${runs} = ${impedance.toFixed(4)} Ω/km`,
      description: "Effective cable AC resistance and reactance at operating temperature.",
    },
    {
      label: "Voltage Drop in Volts (ΔV)",
      formula: is3Ph ? "ΔV = (√3 · Ib · L · Z) / 1000" : "ΔV = (2 · Ib · L · Z) / 1000",
      substituted: `ΔV = (${b.toFixed(3)} × ${inputs.currentA.toFixed(1)} A × ${inputs.lengthM.toFixed(1)} m × ${impedance.toFixed(4)}) / 1000 = ${inputs.dropVolts.toFixed(2)} V`,
      description: is3Ph ? "Three-phase line-to-line voltage drop" : "Single-phase line-to-neutral loop voltage drop",
    },
    {
      label: "Percentage Voltage Drop (ΔV %)",
      formula: "% ΔV = (ΔV / V_system) × 100%",
      substituted: `% ΔV = (${inputs.dropVolts.toFixed(2)} V / ${inputs.systemVoltageV} V) × 100% = ${inputs.dropPercent.toFixed(2)}%`,
    },
  ];

  const cableDisplay = formatCableSizeFor(
    runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2,
    inputs.calculationStandard ?? (isNec ? "NEMA" : "IEC")
  );

  const parameters: TraceParameter[] = [
    { name: "Design Current", symbol: "Ib", value: inputs.currentA.toFixed(1), unit: "A", source: "Load Calculation" },
    { name: "Circuit Length", symbol: "L", value: inputs.lengthM.toFixed(1), unit: "m", source: inputs.sourceNotes?.lengthSource || "Project Cable Routing" },
    {
      name: isNec ? "Cable Size (NEC)" : "Cable Section",
      symbol: "S",
      value: isNec ? cableDisplay : runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2,
      unit: isNec ? undefined : "mm²",
      source: inputs.sourceNotes?.cableSource || (isNec ? "Cable Schedule (NEC)" : "Cable Schedule"),
    },
    { name: "Conductor Material", symbol: "Mat", value: inputs.conductorMaterial === "aluminum" ? "Aluminum (Al)" : "Copper (Cu)", source: "Project Spec" },
    { name: "Power Factor", symbol: "cos φ", value: cosPhi.toFixed(2), source: "Load Profile" },
    { name: "Nominal System Voltage", symbol: "Vn", value: inputs.systemVoltageV, unit: "V", source: is3Ph ? "3-Phase 400V Grid" : "1-Phase 230V Grid" },
  ];

  return {
    title: inputs.circuitName ? `Voltage Drop Trace: ${inputs.circuitName}` : "Voltage Drop Calculation Trace",
    metric: "Voltage Drop (ΔV%)",
    resultValue: `${inputs.dropPercent.toFixed(2)}% (${inputs.dropVolts.toFixed(2)} V)`,
    resultUnit: "%",
    standardCitation: isNec ? "NEC 210.19(A) & NEC Ch. 9 Table 8 / IEEE 141" : "IEC 60364-5-52 §525 & Table F.52-1 / BS 7671",
    standardBadge: isNec ? "NEC / NEMA Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
    compliance: {
      status: passed ? "PASS" : "FAIL",
      rule: `% ΔV ≤ ${limit.toFixed(1)}%`,
      actual: `${inputs.dropPercent.toFixed(2)}%`,
      limit: `${limit.toFixed(1)}%`,
      margin: passed ? `+${margin}% (Adequate)` : `${margin}% (Exceeds Allowable Limit)`,
    },
    notes: [
      `Allowable limit per standard: ${limit.toFixed(1)}% (${isNec ? "NEC 210.19(A) branch / feeder guidance" : is3Ph ? "mains distribution" : "final sub-circuits"}).`,
      runs > 1 ? `Parallel run impedance divided by ${runs} circuits.` : "Single circuit configuration.",
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Cable Ampacity & Derating Trace (Iz & Iz')
// ---------------------------------------------------------------------------
export interface CableAmpacityTraceInputs {
  circuitName?: string;
  cableSizeMm2: number;
  parallelRuns?: number;
  material?: "copper" | "aluminum";
  insulation?: "PVC" | "XLPE";
  installMethod?: string;
  ambientTempC?: number;
  groupingCount?: number;
  tempFactor: number; // Ca
  groupFactor: number; // Cg
  soilFactor?: number; // Cs
  nominalAmpacityPerRun: number; // Iz,tab
  deratedAmpacityPerRun: number;
  totalDeratedAmpacity: number; // Iz total
  breakerSizeA?: number; // In
  designCurrentA?: number; // Ib
  calculationStandard?: string | null;
  code?: CodeStandard;
}

export function buildCableAmpacityTrace(inputs: CableAmpacityTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const runs = Math.max(1, inputs.parallelRuns || 1);
  const totalDerating = inputs.tempFactor * inputs.groupFactor * (inputs.soilFactor ?? 1.0);
  const ib = inputs.designCurrentA ?? 0;
  const inBreaker = inputs.breakerSizeA ?? 0;
  const iz = inputs.totalDeratedAmpacity;

  let complianceStatus: "PASS" | "WARN" | "FAIL" = "PASS";
  let complianceRule = "Iz ≥ In ≥ Ib";
  let marginText = "";

  if (inBreaker > 0 && iz < inBreaker) {
    complianceStatus = "FAIL";
    marginText = `Deficit: ${(inBreaker - iz).toFixed(1)} A under breaker rating`;
  } else if (ib > 0 && iz < ib) {
    complianceStatus = "FAIL";
    marginText = `Deficit: ${(ib - iz).toFixed(1)} A under load current`;
  } else if (inBreaker > 0) {
    marginText = `+${(iz - inBreaker).toFixed(1)} A safety margin above In (${inBreaker}A)`;
  }

  const steps: TraceStep[] = [
    {
      label: "Combined Derating Factor (Ctot)",
      formula: "C_tot = Ca × Cg × Cs",
      substituted: `C_tot = ${inputs.tempFactor.toFixed(2)} (Ca) × ${inputs.groupFactor.toFixed(2)} (Cg)${inputs.soilFactor ? ` × ${inputs.soilFactor.toFixed(2)} (Cs)` : ""} = ${totalDerating.toFixed(3)}`,
      description: "Correction factors for ambient temperature, circuit grouping, and installation method.",
    },
    {
      label: "Derated Cable Ampacity (Iz)",
      formula: "Iz = runs × Iz,tab × C_tot",
      substituted: `Iz = ${runs} × ${inputs.nominalAmpacityPerRun.toFixed(1)} A × ${totalDerating.toFixed(3)} = ${iz.toFixed(1)} A`,
      description: "Maximum continuous current capacity of the installed cable.",
    },
  ];

  if (inBreaker > 0) {
    steps.push({
      label: isNec ? "Coordination Check (NEC 240.4 & IEC 60364-4-43)" : "Coordination Check (IEC 60364-4-43)",
      formula: "Ib ≤ In ≤ Iz",
      substituted: `${ib.toFixed(1)} A (Ib) ≤ ${inBreaker} A (In) ≤ ${iz.toFixed(1)} A (Iz)`,
      description: "Verifies cable is fully protected against overloads by upstream breaker.",
    });
  }

  const cableDisplay = formatCableSizeFor(
    runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2,
    inputs.calculationStandard ?? (isNec ? "NEMA" : "IEC")
  );

  const parameters: TraceParameter[] = [
    {
      name: isNec ? "Selected Cable Size (NEC)" : "Selected Cable Size",
      symbol: "S",
      value: isNec ? cableDisplay : runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2,
      unit: isNec ? undefined : "mm²",
      source: isNec ? "NEC / Catalog Sizing" : "Catalog Sizing",
    },
    {
      name: "Base Tabulated Ampacity",
      symbol: "Iz,tab",
      value: inputs.nominalAmpacityPerRun.toFixed(1),
      unit: "A",
      source: isNec
        ? `NEC / IEC Table (${inputs.installMethod || "Method C"})`
        : `IEC 60364-5-52 Table (${inputs.installMethod || "Method C"})`,
    },
    { name: "Ambient Temperature Factor", symbol: "Ca", value: inputs.tempFactor.toFixed(2), source: `Temp: ${inputs.ambientTempC ?? 45}°C (Table B.52.14)` },
    { name: "Grouping Factor", symbol: "Cg", value: inputs.groupFactor.toFixed(2), source: `Grouping: ${inputs.groupingCount ?? 1} circuits (Table B.52.17)` },
    { name: "Insulation & Material", symbol: "Type", value: `${inputs.material === "aluminum" ? "Al" : "Cu"} / ${inputs.insulation || "XLPE"}`, source: "Specification" },
  ];

  return {
    title: inputs.circuitName ? `Cable Ampacity Trace: ${inputs.circuitName}` : "Cable Ampacity & Derating Trace",
    metric: "Derated Ampacity (Iz)",
    resultValue: `${iz.toFixed(1)} A`,
    resultUnit: "A",
    standardCitation: isNec ? "NEC (NEMA) / IEC 60364-5-52 §523 & Tables B.52.1–B.52.17" : "IEC 60364-5-52 §523 & Tables B.52.1–B.52.17",
    standardBadge: isNec ? "NEC / NEMA Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
    compliance: {
      status: complianceStatus,
      rule: complianceRule,
      actual: `${iz.toFixed(1)} A`,
      limit: inBreaker > 0 ? `${inBreaker} A (Breaker In)` : `${ib.toFixed(1)} A (Load Ib)`,
      margin: marginText,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Design Current Trace (Ib)
// ---------------------------------------------------------------------------
export interface DesignCurrentTraceInputs {
  loadName?: string;
  powerKw: number; // P (kW)
  powerFactor: number; // cos(phi)
  voltageV: number; // e.g. 400 or 230
  isThreePhase: boolean;
  efficiency?: number; // eta (e.g. 0.92 for motor)
  demandFactor?: number;
  coincidentPowerKw?: number;
  calculatedCurrentA: number;
  calculationStandard?: string | null;
  code?: CodeStandard;
}

export function buildDesignCurrentTrace(inputs: DesignCurrentTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const is3Ph = inputs.isThreePhase;
  const cosPhi = Math.max(0.1, Math.min(1.0, inputs.powerFactor || 0.85));
  const df = inputs.demandFactor ?? 1.0;
  const pDesign = inputs.coincidentPowerKw ?? (inputs.powerKw * df);
  const pWatts = pDesign * 1000;
  const eta = inputs.efficiency ?? 1.0;

  const steps: TraceStep[] = [];

  if (df !== 1.0) {
    steps.push({
      label: "Demand Load Application",
      formula: "P_design = P_connected × DF",
      substituted: `P_design = ${inputs.powerKw.toFixed(2)} kW × ${df.toFixed(2)} = ${pDesign.toFixed(2)} kW`,
    });
  }

  if (is3Ph) {
    steps.push({
      label: "Three-Phase Design Current (Ib)",
      formula: eta < 1
        ? "Ib = (P_design × 1000) / (√3 × V_LL × cos φ × η)"
        : "Ib = (P_design × 1000) / (√3 × V_LL × cos φ)",
      substituted: `Ib = (${pWatts.toFixed(0)} W) / (1.732 × ${inputs.voltageV} V × ${cosPhi.toFixed(2)}${eta < 1 ? ` × ${eta.toFixed(2)}` : ""}) = ${inputs.calculatedCurrentA.toFixed(1)} A`,
    });
  } else {
    steps.push({
      label: "Single-Phase Design Current (Ib)",
      formula: eta < 1
        ? "Ib = (P_design × 1000) / (V_LN × cos φ × η)"
        : "Ib = (P_design × 1000) / (V_LN × cos φ)",
      substituted: `Ib = (${pWatts.toFixed(0)} W) / (${inputs.voltageV} V × ${cosPhi.toFixed(2)}${eta < 1 ? ` × ${eta.toFixed(2)}` : ""}) = ${inputs.calculatedCurrentA.toFixed(1)} A`,
    });
  }

  const parameters: TraceParameter[] = [
    { name: "Active Power", symbol: "P", value: inputs.powerKw.toFixed(2), unit: "kW", source: "Equipment Schedule" },
    { name: "Demand Factor", symbol: "DF", value: df.toFixed(2), source: "Diversity Table" },
    { name: "Power Factor", symbol: "cos φ", value: cosPhi.toFixed(2), source: "Load Type Default" },
    { name: "Nominal Voltage", symbol: "V", value: inputs.voltageV, unit: "V", source: is3Ph ? "400V (3-Phase)" : "230V (1-Phase)" },
  ];

  return {
    title: inputs.loadName ? `Design Current Trace: ${inputs.loadName}` : "Design Current (Ib) Calculation Trace",
    metric: "Design Current (Ib)",
    resultValue: `${inputs.calculatedCurrentA.toFixed(1)} A`,
    resultUnit: "A",
    standardCitation: isNec ? "NEC Article 220 & IEEE Standard" : "IEC 60364-1 & IEC 60038",
    standardBadge: isNec ? "NEC / NEMA Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
  };
}

// ---------------------------------------------------------------------------
// 4. Short Circuit Current Trace (Ik" & Ip)
// ---------------------------------------------------------------------------
export interface ShortCircuitTraceInputs {
  locationName?: string;
  transformerKva: number;
  transformerZPercent: number; // e.g. 5.0%
  voltageSecondaryV: number; // e.g. 400V
  upstreamZOhms?: number;
  cableROhms?: number;
  cableXOhms?: number;
  threePhaseIscKa: number; // Ik" (kA)
  peakCurrentKa?: number; // Ip (kA)
  earthingSystem?: string; // TN-S, TT, IT
  calculationStandard?: string | null;
  code?: CodeStandard;
}

export function buildShortCircuitTrace(inputs: ShortCircuitTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const vSec = inputs.voltageSecondaryV;
  const sKva = inputs.transformerKva;
  const zTrafoPercent = inputs.transformerZPercent;

  // Transformer base impedance
  const zTrafoBase = (vSec * vSec) / (sKva * 1000); // Ohms
  const zTrafo = zTrafoBase * (zTrafoPercent / 100);

  // Component-wise IEC 60909 addition via the SAME X/R split the engine uses
  // in calculateIscWithCable — never a scalar |Zt| + |Zc| sum.
  const { r: rTrafo, x: xTrafo } = splitSourceImpedance(zTrafo, sourceXrRatio(vSec));
  const rTotal = rTrafo + (inputs.cableROhms ?? 0);
  const xTotal = xTrafo + (inputs.cableXOhms ?? 0);
  const zTotal = Math.sqrt(rTotal * rTotal + xTotal * xTotal);

  const steps: TraceStep[] = [
    {
      label: "Transformer Internal Impedance (Zt)",
      formula: "Zt = (Un² / Sr) × (uk% / 100), split as R + jX at typical X/R",
      substituted: `Zt = ((${vSec} V)² / ${sKva * 1000} VA) × (${zTrafoPercent}% / 100) = ${zTrafo.toFixed(4)} Ω → R = ${rTrafo.toFixed(4)} Ω, X = ${xTrafo.toFixed(4)} Ω`,
    },
    {
      label: "Symmetrical Initial Short-Circuit Current (Ik\")",
      formula: "Z_total = √((Rt + Rc)² + (Xt + Xc)²),  Ik\" = (c · Un) / (√3 · Z_total)",
      substituted: `Ik\" = (1.05 × ${vSec} V) / (1.732 × ${zTotal.toFixed(4)} Ω) = ${(inputs.threePhaseIscKa * 1000).toFixed(0)} A = ${inputs.threePhaseIscKa.toFixed(2)} kA`,
    },
  ];

  if (inputs.peakCurrentKa) {
    const kappa = (inputs.peakCurrentKa / (1.414 * inputs.threePhaseIscKa)).toFixed(2);
    steps.push({
      label: "Peak Short-Circuit Current (Ip)",
      formula: "Ip = κ · √2 · Ik\"",
      substituted: `Ip = ${kappa} × 1.414 × ${inputs.threePhaseIscKa.toFixed(2)} kA = ${inputs.peakCurrentKa.toFixed(2)} kA`,
      description: "Maximum instantaneous peak value for electrodynamic stress verification.",
    });
  }

  const parameters: TraceParameter[] = [
    { name: "Transformer Rating", symbol: "Sr", value: sKva, unit: "kVA", source: "Main Substation" },
    {
      name: "Transformer Impedance",
      symbol: "uk%",
      value: `${zTrafoPercent}%`,
      source: isNec ? "IEEE / ANSI Standard Table" : "IEC 60076 Standard Table",
    },
    { name: "Nominal Secondary Voltage", symbol: "Un", value: vSec, unit: "V", source: "Distribution Grid" },
    { name: "Earthing System", symbol: "System", value: inputs.earthingSystem || "TN-S", source: "Project Earthing Spec" },
  ];

  return {
    title: inputs.locationName
      ? `Short Circuit Trace: ${inputs.locationName}`
      : isNec
      ? "Short Circuit (IEEE / IEC 60909) Trace"
      : "Short Circuit (IEC 60909) Trace",
    metric: "3-Phase Fault Level (Ik\")",
    resultValue: `${inputs.threePhaseIscKa.toFixed(2)} kA`,
    resultUnit: "kA",
    standardCitation: isNec ? "IEEE 141 / IEEE 242 & IEC 60909-0" : "IEC 60909-0 & IEC 60076 (Power Transformers)",
    standardBadge: isNec ? "IEEE / NEMA Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
  };
}

// ---------------------------------------------------------------------------
// 5. Breaker Sizing & Coordination Trace (In & Icu)
// ---------------------------------------------------------------------------
export interface BreakerSizingTraceInputs {
  circuitName?: string;
  designCurrentA: number; // Ib
  selectedTripA: number; // In
  frameSizeA: number; // Frame
  breakingCapacityKa: number; // Icu
  prospectiveFaultKa?: number; // Isc
  cableAmpacityA?: number; // Iz
  poles?: number;
  calculationStandard?: string | null;
  code?: CodeStandard;
}

export function buildBreakerSizingTrace(inputs: BreakerSizingTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const ib = inputs.designCurrentA;
  const inRating = inputs.selectedTripA;
  const iz = inputs.cableAmpacityA;
  const icu = inputs.breakingCapacityKa;
  const isc = inputs.prospectiveFaultKa ?? 0;

  const steps: TraceStep[] = [
    {
      label: "Nominal Trip Rating Selection (In)",
      formula: "Ib ≤ In",
      substituted: `${ib.toFixed(1)} A (Ib) ≤ ${inRating} A (In)`,
      description: isNec
        ? "Trip rating chosen from standard NEC 240.6(A) ratings to carry continuous design current without nuisance tripping."
        : "Trip rating chosen from standard IEC ratings to carry continuous design current without nuisance tripping.",
    },
  ];

  if (iz != null && iz > 0) {
    steps.push({
      label: "Cable Protection Overload Condition",
      formula: "In ≤ Iz",
      substituted: `${inRating} A (In) ≤ ${iz.toFixed(1)} A (Iz)`,
      description: "Guarantees the cable conductor is shielded from thermal overload damage.",
    });
  }

  if (isc > 0) {
    steps.push({
      label: "Ultimate Breaking Capacity (Icu) Verification",
      formula: "Icu ≥ Isc,fault",
      substituted: `${icu} kA (Icu) ≥ ${isc.toFixed(1)} kA (Isc)`,
      description: "Ensures breaker safely clears prospective short-circuit energy without destruction.",
    });
  }

  const isPass = inRating >= ib && (iz == null || iz >= inRating) && (isc === 0 || icu >= isc);

  const parameters: TraceParameter[] = [
    { name: "Continuous Load Current", symbol: "Ib", value: ib.toFixed(1), unit: "A", source: "Load Sizing" },
    {
      name: "Selected Breaker Rating",
      symbol: "In",
      value: inRating,
      unit: "A",
      source: isNec ? "NEC 240.6(A) Standard" : "Catalog Standard",
    },
    { name: "Breaker Frame Size", symbol: "Frame", value: inputs.frameSizeA, unit: "AF", source: "Manufacturer Series" },
    {
      name: "Breaking Capacity",
      symbol: "Icu",
      value: icu,
      unit: "kA",
      source: isNec ? "NEMA AB-1 / UL 489 / IEC 60947-2" : "IEC 60947-2 Test Duty",
    },
  ];

  return {
    title: inputs.circuitName ? `Breaker Sizing Trace: ${inputs.circuitName}` : "Breaker Selection & Protection Trace",
    metric: "Breaker Rating (In)",
    resultValue: `${inRating} A (${inputs.frameSizeA}AF / ${icu}kA)`,
    resultUnit: "A",
    standardCitation: isNec ? "NEC 240.6(A) / NEMA AB-1 & UL 489 / IEC 60947-2" : "IEC 60947-2 / IEC 60898-1 & IEC 60364-4-43",
    standardBadge: isNec ? "NEC / NEMA Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
    compliance: {
      status: isPass ? "PASS" : "FAIL",
      rule: "Ib ≤ In ≤ Iz  &  Icu ≥ Isc",
      actual: `${inRating} A / ${icu} kA`,
      limit: `Ib: ${ib.toFixed(1)}A | Isc: ${isc > 0 ? `${isc}kA` : "N/A"}`,
      margin: `+${(inRating - ib).toFixed(1)} A continuous margin`,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Phase Balance Trace
// ---------------------------------------------------------------------------
export interface PhaseBalanceTraceInputs {
  panelName?: string;
  /** Per-phase RMS currents — the metric the engine balances on. */
  l1A: number;
  l2A: number;
  l3A: number;
  unbalancePercent: number;
  maxAllowablePercent?: number; // default 10%
  calculationStandard?: string | null;
  code?: CodeStandard;
}

export function buildPhaseBalanceTrace(inputs: PhaseBalanceTraceInputs): TraceDefinition {
  const code: CodeStandard = inputs.code ?? codeOf(inputs.calculationStandard);
  const isNec = code === "NEC";
  const i1 = inputs.l1A;
  const i2 = inputs.l2A;
  const i3 = inputs.l3A;
  const avg = (i1 + i2 + i3) / 3;
  const maxDev = Math.max(Math.abs(i1 - avg), Math.abs(i2 - avg), Math.abs(i3 - avg));
  // Same current-unbalance proxy as the phaseBalance engine:
  // % = (max − min) / avg × 100.
  const calcUnbalance = currentUnbalancePct([i1, i2, i3]);
  const limit = inputs.maxAllowablePercent ?? 10.0;
  const passed = inputs.unbalancePercent <= limit;

  const steps: TraceStep[] = [
    {
      label: "Average Phase Current (I_avg)",
      formula: "I_avg = (I1 + I2 + I3) / 3",
      substituted: `I_avg = (${i1.toFixed(2)} + ${i2.toFixed(2)} + ${i3.toFixed(2)}) / 3 = ${avg.toFixed(2)} A`,
    },
    {
      label: "Maximum Phase Deviation (ΔI_max)",
      formula: "ΔI_max = max(|I1 - I_avg|, |I2 - I_avg|, |I3 - I_avg|)",
      substituted: `ΔI_max = ${maxDev.toFixed(2)} A`,
    },
    {
      label: "Current Unbalance Percentage",
      formula: "% Unbalance = (Imax − Imin) / I_avg × 100%",
      substituted: `% Unbalance = ${calcUnbalance.toFixed(2)}%`,
    },
  ];

  const parameters: TraceParameter[] = [
    { name: "Phase L1 Current", symbol: "I1", value: i1.toFixed(2), unit: "A", source: "Sub-circuit aggregation" },
    { name: "Phase L2 Current", symbol: "I2", value: i2.toFixed(2), unit: "A", source: "Sub-circuit aggregation" },
    { name: "Phase L3 Current", symbol: "I3", value: i3.toFixed(2), unit: "A", source: "Sub-circuit aggregation" },
  ];

  return {
    title: inputs.panelName ? `Phase Balance Trace: ${inputs.panelName}` : "Phase Balancing Trace",
    metric: "Phase Unbalance (%)",
    resultValue: `${inputs.unbalancePercent.toFixed(2)}%`,
    resultUnit: "%",
    standardCitation: isNec ? "NEMA MG 1 & ANSI C84.1 / IEEE 141 (Recommended < 10%)" : "IEC 61000-2-4 & IEEE 141 (Recommended < 10%)",
    standardBadge: isNec ? "NEMA / IEEE Standards Verified" : "IEC Standards Verified",
    code,
    steps,
    parameters,
    compliance: {
      status: passed ? "PASS" : "WARN",
      rule: `% Unbalance ≤ ${limit.toFixed(1)}%`,
      actual: `${inputs.unbalancePercent.toFixed(2)}%`,
      limit: `${limit.toFixed(1)}%`,
      margin: passed ? `+${(limit - inputs.unbalancePercent).toFixed(2)}% margin` : "Requires Phase Rebalancing",
    },
  };
}

// ---------------------------------------------------------------------------
// Plaintext / LaTeX Copy Formatters
// ---------------------------------------------------------------------------
export function formatTraceAsPlainText(trace: TraceDefinition): string {
  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(`${trace.title.toUpperCase()}`);
  lines.push(`Governing Code: ${trace.standardCitation}${trace.standardBadge ? ` [${trace.standardBadge}]` : ""}`);
  lines.push(`Final Result: ${trace.resultValue}`);
  lines.push(`=======================================================`);
  lines.push(``);
  lines.push(`CALCULATION STEPS:`);
  lines.push(`-------------------------------------------------------`);
  trace.steps.forEach((step, idx) => {
    if (step.label) lines.push(`${idx + 1}. ${step.label}:`);
    lines.push(`   Formula:     ${step.formula.replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")}`);
    lines.push(`   Substituted: ${step.substituted.replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")}`);
    if (step.description) lines.push(`   Note:        ${step.description}`);
    lines.push(``);
  });

  if (trace.parameters.length > 0) {
    lines.push(`INPUT PARAMETERS & PROVENANCE:`);
    lines.push(`-------------------------------------------------------`);
    trace.parameters.forEach((p) => {
      const unit = p.unit ? ` ${p.unit}` : "";
      lines.push(`• ${p.name} (${p.symbol}) = ${p.value}${unit}  [Source: ${p.source}]`);
    });
    lines.push(``);
  }

  if (trace.compliance) {
    lines.push(`COMPLIANCE STATUS: ${trace.compliance.status}`);
    lines.push(`Rule:   ${trace.compliance.rule}`);
    lines.push(`Actual: ${trace.compliance.actual} vs Limit: ${trace.compliance.limit}`);
    if (trace.compliance.margin) lines.push(`Margin: ${trace.compliance.margin}`);
    lines.push(``);
  }

  lines.push(`Generated by ProCal Electrical Engineering Platform`);
  return lines.join("\r\n");
}