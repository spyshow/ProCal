/**
 * Calculation Trace Engine ("Show Your Work")
 *
 * Provides on-demand, step-by-step mathematical traces, substituted values,
 * parameter provenance, governing standard citations (IEC / BS / IEEE),
 * and compliance checks for all engineering calculations across ProCal schedules.
 */

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
  standardCitation: string; // e.g. "IEC 60364-5-52 §525"
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
  sourceNotes?: {
    lengthSource?: string;
    cableSource?: string;
    tempSource?: string;
  };
}

export function buildVoltageDropTrace(inputs: VoltageDropTraceInputs): TraceDefinition {
  const is3Ph = inputs.isThreePhase;
  const runs = Math.max(1, inputs.parallelRuns || 1);
  const cosPhi = Math.max(0.1, Math.min(1.0, inputs.powerFactor ?? 0.85));
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const b = is3Ph ? 1.732 : 2.0;
  const bSymbol = is3Ph ? "\\sqrt{3}" : "2";
  const limit = inputs.maxDropPercentLimit ?? (is3Ph ? 5.0 : 3.0);

  // Default standard resistance and reactance estimates if not supplied
  const rNominal = inputs.rOhmPerKm ?? (inputs.conductorMaterial === "aluminum" ? (0.0283 / inputs.cableSizeMm2) * 1000 : (0.0175 / inputs.cableSizeMm2) * 1000);
  const xNominal = inputs.xOhmPerKm ?? 0.08;
  const rEff = rNominal / runs;
  const xEff = xNominal / runs;
  const impedance = rEff * cosPhi + xEff * sinPhi;

  const passed = inputs.dropPercent <= limit;
  const margin = (limit - inputs.dropPercent).toFixed(2);

  const steps: TraceStep[] = [
    {
      label: "Phase Impedance Component (Z)",
      formula: "Z = (R \\cdot \\cos\\varphi + X \\cdot \\sin\\varphi) / n_{runs}",
      substituted: `Z = (${rNominal.toFixed(4)} \\times ${cosPhi.toFixed(2)} + ${xNominal.toFixed(4)} \\times ${sinPhi.toFixed(3)}) / ${runs} = ${impedance.toFixed(4)}\\ \\Omega/\\text{km}`,
      description: "Effective cable AC resistance and reactance at operating temperature.",
    },
    {
      label: "Voltage Drop in Volts (ΔV)",
      formula: `\\Delta V = \\frac{${bSymbol} \\cdot I_b \\cdot L \\cdot Z}{1000}`,
      substituted: `\\Delta V = \\frac{${b.toFixed(3)} \\times ${inputs.currentA.toFixed(1)}\\text{ A} \\times ${inputs.lengthM.toFixed(1)}\\text{ m} \\times ${impedance.toFixed(4)}}{1000} = ${inputs.dropVolts.toFixed(2)}\\text{ V}`,
      description: is3Ph ? "Three-phase line-to-line voltage drop" : "Single-phase line-to-neutral loop voltage drop",
    },
    {
      label: "Percentage Voltage Drop (ΔV %)",
      formula: "\\% \\Delta V = \\left( \\frac{\\Delta V}{V_{system}} \\right) \\times 100\\%",
      substituted: `\\% \\Delta V = \\left( \\frac{${inputs.dropVolts.toFixed(2)}\\text{ V}}{${inputs.systemVoltageV}\\text{ V}} \\right) \\times 100\\% = ${inputs.dropPercent.toFixed(2)}\\%`,
    },
  ];

  const parameters: TraceParameter[] = [
    { name: "Design Current", symbol: "Ib", value: inputs.currentA.toFixed(1), unit: "A", source: "Load Calculation" },
    { name: "Circuit Length", symbol: "L", value: inputs.lengthM.toFixed(1), unit: "m", source: inputs.sourceNotes?.lengthSource || "Project Cable Routing" },
    { name: "Cable Section", symbol: "S", value: runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2, unit: "mm²", source: inputs.sourceNotes?.cableSource || "Cable Schedule" },
    { name: "Conductor Material", symbol: "Mat", value: inputs.conductorMaterial === "aluminum" ? "Aluminum (Al)" : "Copper (Cu)", source: "Project Spec" },
    { name: "Power Factor", symbol: "cos φ", value: cosPhi.toFixed(2), source: "Load Profile" },
    { name: "Nominal System Voltage", symbol: "Vn", value: inputs.systemVoltageV, unit: "V", source: is3Ph ? "3-Phase 400V Grid" : "1-Phase 230V Grid" },
  ];

  return {
    title: inputs.circuitName ? `Voltage Drop Trace: ${inputs.circuitName}` : "Voltage Drop Calculation Trace",
    metric: "Voltage Drop (ΔV%)",
    resultValue: `${inputs.dropPercent.toFixed(2)}% (${inputs.dropVolts.toFixed(2)} V)`,
    resultUnit: "%",
    standardCitation: "IEC 60364-5-52 §525 & Table F.52-1 / BS 7671",
    steps,
    parameters,
    compliance: {
      status: passed ? "PASS" : "FAIL",
      rule: `\\% \\Delta V \\le ${limit.toFixed(1)}\\%`,
      actual: `${inputs.dropPercent.toFixed(2)}%`,
      limit: `${limit.toFixed(1)}%`,
      margin: passed ? `+${margin}% (Adequate)` : `${margin}% (Exceeds Allowable Limit)`,
    },
    notes: [
      `Allowable limit per standard: ${limit.toFixed(1)}% for ${is3Ph ? "mains distribution" : "final sub-circuits"}.`,
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
}

export function buildCableAmpacityTrace(inputs: CableAmpacityTraceInputs): TraceDefinition {
  const runs = Math.max(1, inputs.parallelRuns || 1);
  const totalDerating = inputs.tempFactor * inputs.groupFactor * (inputs.soilFactor ?? 1.0);
  const ib = inputs.designCurrentA ?? 0;
  const inBreaker = inputs.breakerSizeA ?? 0;
  const iz = inputs.totalDeratedAmpacity;

  let complianceStatus: "PASS" | "WARN" | "FAIL" = "PASS";
  let complianceRule = "I_z \\ge I_n \\ge I_b";
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
      formula: "C_{tot} = C_a \\times C_g \\times C_s",
      substituted: `C_{tot} = ${inputs.tempFactor.toFixed(2)} (C_a) \\times ${inputs.groupFactor.toFixed(2)} (C_g) = ${totalDerating.toFixed(3)}`,
      description: "Correction factors for ambient temperature, circuit grouping, and installation method.",
    },
    {
      label: "Derated Cable Ampacity (Iz)",
      formula: "I_z = n_{runs} \\times I_{z,tab} \\times C_{tot}",
      substituted: `I_z = ${runs} \\times ${inputs.nominalAmpacityPerRun.toFixed(1)}\\text{ A} \\times ${totalDerating.toFixed(3)} = ${iz.toFixed(1)}\\text{ A}`,
      description: "Maximum continuous current capacity of the installed cable.",
    },
  ];

  if (inBreaker > 0) {
    steps.push({
      label: "Coordination Check (IEC 60364-4-43)",
      formula: "I_b \\le I_n \\le I_z",
      substituted: `${ib.toFixed(1)}\\text{ A} (I_b) \\le ${inBreaker}\\text{ A} (I_n) \\le ${iz.toFixed(1)}\\text{ A} (I_z)`,
      description: "Verifies cable is fully protected against overloads by upstream breaker.",
    });
  }

  const parameters: TraceParameter[] = [
    { name: "Selected Cable Size", symbol: "S", value: runs > 1 ? `${runs} × ${inputs.cableSizeMm2}` : inputs.cableSizeMm2, unit: "mm²", source: "Catalog Sizing" },
    { name: "Base Tabulated Ampacity", symbol: "Iz,tab", value: inputs.nominalAmpacityPerRun.toFixed(1), unit: "A", source: `IEC 60364-5-52 Table (${inputs.installMethod || "Method C"})` },
    { name: "Ambient Temperature Factor", symbol: "Ca", value: inputs.tempFactor.toFixed(2), source: `Temp: ${inputs.ambientTempC ?? 45}°C (Table B.52.14)` },
    { name: "Grouping Factor", symbol: "Cg", value: inputs.groupFactor.toFixed(2), source: `Grouping: ${inputs.groupingCount ?? 1} circuits (Table B.52.17)` },
    { name: "Insulation & Material", symbol: "Type", value: `${inputs.material === "aluminum" ? "Al" : "Cu"} / ${inputs.insulation || "XLPE"}`, source: "Specification" },
  ];

  return {
    title: inputs.circuitName ? `Cable Ampacity Trace: ${inputs.circuitName}` : "Cable Ampacity & Derating Trace",
    metric: "Derated Ampacity (Iz)",
    resultValue: `${iz.toFixed(1)} A`,
    resultUnit: "A",
    standardCitation: "IEC 60364-5-52 §523 & Tables B.52.1–B.52.17",
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
}

export function buildDesignCurrentTrace(inputs: DesignCurrentTraceInputs): TraceDefinition {
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
      formula: "P_{design} = P_{connected} \\times DF",
      substituted: `P_{design} = ${inputs.powerKw.toFixed(2)}\\text{ kW} \\times ${df.toFixed(2)} = ${pDesign.toFixed(2)}\\text{ kW}`,
    });
  }

  if (is3Ph) {
    steps.push({
      label: "Three-Phase Design Current (Ib)",
      formula: "I_b = \\frac{P_{design} \\times 1000}{\\sqrt{3} \\times V_{LL} \\times \\cos\\varphi \\times \\eta}",
      substituted: `I_b = \\frac{${pWatts.toFixed(0)}\\text{ W}}{1.732 \\times ${inputs.voltageV}\\text{ V} \\times ${cosPhi.toFixed(2)}${eta < 1 ? ` \\times ${eta.toFixed(2)}` : ""}} = ${inputs.calculatedCurrentA.toFixed(1)}\\text{ A}`,
    });
  } else {
    steps.push({
      label: "Single-Phase Design Current (Ib)",
      formula: "I_b = \\frac{P_{design} \\times 1000}{V_{LN} \\times \\cos\\varphi \\times \\eta}",
      substituted: `I_b = \\frac{${pWatts.toFixed(0)}\\text{ W}}{${inputs.voltageV}\\text{ V} \\times ${cosPhi.toFixed(2)}${eta < 1 ? ` \\times ${eta.toFixed(2)}` : ""}} = ${inputs.calculatedCurrentA.toFixed(1)}\\text{ A}`,
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
    standardCitation: "IEC 60364-1 & IEC 60038",
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
}

export function buildShortCircuitTrace(inputs: ShortCircuitTraceInputs): TraceDefinition {
  const vSec = inputs.voltageSecondaryV;
  const sKva = inputs.transformerKva;
  const zTrafoPercent = inputs.transformerZPercent;

  // Transformer base impedance
  const zTrafoBase = (vSec * vSec) / (sKva * 1000); // Ohms
  const zTrafo = zTrafoBase * (zTrafoPercent / 100);

  const rCable = inputs.cableROhms ?? 0;
  const xCable = inputs.cableXOhms ?? 0;
  const zTotal = Math.sqrt(Math.pow(zTrafo + rCable, 2) + Math.pow(xCable, 2));

  const cFactor = 1.05; // Voltage factor per IEC 60909 for LV (+5%)

  const steps: TraceStep[] = [
    {
      label: "Transformer Internal Impedance (Zt)",
      formula: "Z_t = \\left( \\frac{U_n^2}{S_r} \\right) \\times \\left( \\frac{u_k\\%}{100} \\right)",
      substituted: `Z_t = \\left( \\frac{(${vSec}\\text{ V})^2}{${sKva * 1000}\\text{ VA}} \\right) \\times \\left( \\frac{${zTrafoPercent}\\%}{100} \\right) = ${zTrafo.toFixed(4)}\\ \\Omega`,
    },
    {
      label: "Symmetrical Initial Short-Circuit Current (Ik\")",
      formula: "I_k'' = \\frac{c \\cdot U_n}{\\sqrt{3} \\cdot Z_{total}}",
      substituted: `I_k'' = \\frac{${cFactor} \\times ${vSec}\\text{ V}}{1.732 \\times ${zTotal.toFixed(4)}\\ \\Omega} = ${(inputs.threePhaseIscKa * 1000).toFixed(0)}\\text{ A} = ${inputs.threePhaseIscKa.toFixed(2)}\\text{ kA}`,
    },
  ];

  if (inputs.peakCurrentKa) {
    const kappa = (inputs.peakCurrentKa / (1.414 * inputs.threePhaseIscKa)).toFixed(2);
    steps.push({
      label: "Peak Short-Circuit Current (Ip)",
      formula: "I_p = \\kappa \\cdot \\sqrt{2} \\cdot I_k''",
      substituted: `I_p = ${kappa} \\times 1.414 \\times ${inputs.threePhaseIscKa.toFixed(2)}\\text{ kA} = ${inputs.peakCurrentKa.toFixed(2)}\\text{ kA}`,
      description: "Maximum instantaneous peak value for electrodynamic stress verification.",
    });
  }

  const parameters: TraceParameter[] = [
    { name: "Transformer Rating", symbol: "Sr", value: sKva, unit: "kVA", source: "Main Substation" },
    { name: "Transformer Impedance", symbol: "uk%", value: `${zTrafoPercent}%`, source: "IEC 60076 Standard Table" },
    { name: "Nominal Secondary Voltage", symbol: "Un", value: vSec, unit: "V", source: "Distribution Grid" },
    { name: "Earthing System", symbol: "System", value: inputs.earthingSystem || "TN-S", source: "Project Earthing Spec" },
  ];

  return {
    title: inputs.locationName ? `Short Circuit Trace: ${inputs.locationName}` : "Short Circuit (IEC 60909) Trace",
    metric: "3-Phase Fault Level (Ik\")",
    resultValue: `${inputs.threePhaseIscKa.toFixed(2)} kA`,
    resultUnit: "kA",
    standardCitation: "IEC 60909-0 & IEC 60076 (Power Transformers)",
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
}

export function buildBreakerSizingTrace(inputs: BreakerSizingTraceInputs): TraceDefinition {
  const ib = inputs.designCurrentA;
  const inRating = inputs.selectedTripA;
  const iz = inputs.cableAmpacityA;
  const icu = inputs.breakingCapacityKa;
  const isc = inputs.prospectiveFaultKa ?? 0;

  const steps: TraceStep[] = [
    {
      label: "Nominal Trip Rating Selection (In)",
      formula: "I_b \\le I_n",
      substituted: `${ib.toFixed(1)}\\text{ A} (I_b) \\le ${inRating}\\text{ A} (I_n)`,
      description: "Trip rating chosen from standard IEC ratings to carry continuous design current without nuisance tripping.",
    },
  ];

  if (iz != null && iz > 0) {
    steps.push({
      label: "Cable Protection Overload Condition",
      formula: "I_n \\le I_z",
      substituted: `${inRating}\\text{ A} (I_n) \\le ${iz.toFixed(1)}\\text{ A} (I_z)`,
      description: "Guarantees the cable conductor is shielded from thermal overload damage.",
    });
  }

  if (isc > 0) {
    steps.push({
      label: "Ultimate Breaking Capacity (Icu) Verification",
      formula: "I_{cu} \\ge I_{sc,fault}",
      substituted: `${icu}\\text{ kA} (I_{cu}) \\ge ${isc.toFixed(1)}\\text{ kA} (I_{sc})`,
      description: "Ensures breaker safely clears prospective short-circuit energy without destruction.",
    });
  }

  const isPass = inRating >= ib && (iz == null || iz >= inRating) && (isc === 0 || icu >= isc);

  const parameters: TraceParameter[] = [
    { name: "Continuous Load Current", symbol: "Ib", value: ib.toFixed(1), unit: "A", source: "Load Sizing" },
    { name: "Selected Breaker Rating", symbol: "In", value: inRating, unit: "A", source: "Catalog Standard" },
    { name: "Breaker Frame Size", symbol: "Frame", value: inputs.frameSizeA, unit: "AF", source: "Manufacturer Series" },
    { name: "Breaking Capacity", symbol: "Icu", value: icu, unit: "kA", source: "IEC 60947-2 Test Duty" },
  ];

  return {
    title: inputs.circuitName ? `Breaker Sizing Trace: ${inputs.circuitName}` : "Breaker Selection & Protection Trace",
    metric: "Breaker Rating (In)",
    resultValue: `${inRating} A (${inputs.frameSizeA}AF / ${icu}kA)`,
    resultUnit: "A",
    standardCitation: "IEC 60947-2 / IEC 60898-1 & IEC 60364-4-43",
    steps,
    parameters,
    compliance: {
      status: isPass ? "PASS" : "FAIL",
      rule: "I_b \\le I_n \\le I_z \\land I_{cu} \\ge I_{sc}",
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
  l1Kw: number;
  l2Kw: number;
  l3Kw: number;
  unbalancePercent: number;
  maxAllowablePercent?: number; // default 10%
}

export function buildPhaseBalanceTrace(inputs: PhaseBalanceTraceInputs): TraceDefinition {
  const l1 = inputs.l1Kw;
  const l2 = inputs.l2Kw;
  const l3 = inputs.l3Kw;
  const avg = (l1 + l2 + l3) / 3;
  const maxDev = Math.max(Math.abs(l1 - avg), Math.abs(l2 - avg), Math.abs(l3 - avg));
  const calcUnbalance = avg > 0 ? (maxDev / avg) * 100 : 0;
  const limit = inputs.maxAllowablePercent ?? 10.0;
  const passed = inputs.unbalancePercent <= limit;

  const steps: TraceStep[] = [
    {
      label: "Average Phase Load (Pavg)",
      formula: "P_{avg} = \\frac{L_1 + L_2 + L_3}{3}",
      substituted: `P_{avg} = \\frac{${l1.toFixed(2)} + ${l2.toFixed(2)} + ${l3.toFixed(2)}}{3} = ${avg.toFixed(2)}\\text{ kW}`,
    },
    {
      label: "Maximum Phase Deviation (ΔPmax)",
      formula: "\\Delta P_{max} = \\max(|L_1 - P_{avg}|, |L_2 - P_{avg}|, |L_3 - P_{avg}|)",
      substituted: `\\Delta P_{max} = ${maxDev.toFixed(2)}\\text{ kW}`,
    },
    {
      label: "Phase Unbalance Percentage",
      formula: "\\% \\text{Unbalance} = \\left( \\frac{\\Delta P_{max}}{P_{avg}} \\right) \\times 100\\%",
      substituted: `\\% \\text{Unbalance} = \\left( \\frac{${maxDev.toFixed(2)}}{${avg.toFixed(2)}} \\right) \\times 100\\% = ${calcUnbalance.toFixed(2)}\\%`,
    },
  ];

  const parameters: TraceParameter[] = [
    { name: "Phase L1 Load", symbol: "L1", value: l1.toFixed(2), unit: "kW", source: "Sub-circuit aggregation" },
    { name: "Phase L2 Load", symbol: "L2", value: l2.toFixed(2), unit: "kW", source: "Sub-circuit aggregation" },
    { name: "Phase L3 Load", symbol: "L3", value: l3.toFixed(2), unit: "kW", source: "Sub-circuit aggregation" },
  ];

  return {
    title: inputs.panelName ? `Phase Balance Trace: ${inputs.panelName}` : "Phase Balancing Trace",
    metric: "Phase Unbalance (%)",
    resultValue: `${inputs.unbalancePercent.toFixed(2)}%`,
    resultUnit: "%",
    standardCitation: "IEC 61000-2-4 & IEEE 141 (Recommended < 10%)",
    steps,
    parameters,
    compliance: {
      status: passed ? "PASS" : "WARN",
      rule: `\\% \\text{Unbalance} \\le ${limit.toFixed(1)}\\%`,
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
  lines.push(`Governing Code: ${trace.standardCitation}`);
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