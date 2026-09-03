import { describe, it, expect } from "vitest";
import {
  buildVoltageDropTrace,
  buildCableAmpacityTrace,
  buildDesignCurrentTrace,
  buildShortCircuitTrace,
  buildBreakerSizingTrace,
  buildPhaseBalanceTrace,
  formatTraceAsPlainText,
} from "./trace-engine";
import { currentUnbalancePct } from "./phaseBalance";
import { calculateVoltageDrop } from "./cables";

describe("Trace/engine agreement (no drift)", () => {
  it("voltage-drop trace impedance matches the engine's catalog lookup", () => {
    const engine = calculateVoltageDrop(84.5, 45, 50, 0.85, true, 400, 1, "copper");
    const trace = buildVoltageDropTrace({
      currentA: 84.5,
      lengthM: 45,
      cableSizeMm2: 50,
      parallelRuns: 1,
      conductorMaterial: "copper",
      powerFactor: 0.85,
      systemVoltageV: 400,
      isThreePhase: true,
      dropVolts: engine.dropVolts,
      dropPercent: engine.dropPercent,
    });
    // The substituted ΔV step must reproduce the engine's own number.
    expect(trace.steps[1].substituted).toContain(`= ${engine.dropVolts.toFixed(2)} V`);
    expect(trace.steps[2].substituted).toContain(`= ${engine.dropPercent.toFixed(2)}%`);
  });
});

describe("Calculation Trace Engine", () => {
  it("builds a 3-phase Voltage Drop trace correctly", () => {
    const trace = buildVoltageDropTrace({
      circuitName: "Main Feeder - MDB",
      currentA: 84.5,
      lengthM: 45,
      cableSizeMm2: 50,
      parallelRuns: 1,
      conductorMaterial: "copper",
      powerFactor: 0.85,
      systemVoltageV: 400,
      isThreePhase: true,
      dropVolts: 1.62,
      dropPercent: 2.03,
      maxDropPercentLimit: 3.0,
    });

    expect(trace.title).toContain("Main Feeder - MDB");
    expect(trace.metric).toBe("Voltage Drop (ΔV%)");
    expect(trace.standardCitation).toContain("IEC 60364-5-52");
    expect(trace.steps.length).toBe(3);
    expect(trace.compliance?.status).toBe("PASS");
    expect(trace.compliance?.margin).toContain("+0.97%");
  });

  it("builds a single-phase Voltage Drop trace with failure status when exceeding limit", () => {
    const trace = buildVoltageDropTrace({
      circuitName: "Apartment Sub-circuit",
      currentA: 32,
      lengthM: 60,
      cableSizeMm2: 6,
      conductorMaterial: "copper",
      powerFactor: 0.9,
      systemVoltageV: 230,
      isThreePhase: false,
      dropVolts: 9.8,
      dropPercent: 4.26,
      maxDropPercentLimit: 3.0,
    });

    expect(trace.compliance?.status).toBe("FAIL");
    expect(trace.steps[1].formula).toContain("2 · Ib");
  });

  it("builds Cable Ampacity and Derating trace", () => {
    const trace = buildCableAmpacityTrace({
      circuitName: "Elevator Feeder",
      cableSizeMm2: 35,
      parallelRuns: 1,
      material: "copper",
      insulation: "XLPE",
      installMethod: "Method C",
      ambientTempC: 45,
      groupingCount: 4,
      tempFactor: 0.87,
      groupFactor: 0.65,
      nominalAmpacityPerRun: 159,
      deratedAmpacityPerRun: 89.9,
      totalDeratedAmpacity: 89.9,
      breakerSizeA: 80,
      designCurrentA: 72,
    });

    expect(trace.metric).toBe("Derated Ampacity (Iz)");
    expect(trace.steps[0].substituted).toContain("0.87");
    expect(trace.compliance?.status).toBe("PASS");
    expect(trace.compliance?.margin).toContain("+9.9 A");
  });

  it("builds Design Current trace for 3-phase and 1-phase loads", () => {
    const trace3Ph = buildDesignCurrentTrace({
      loadName: "Chiller 01",
      powerKw: 45,
      powerFactor: 0.85,
      voltageV: 400,
      isThreePhase: true,
      efficiency: 0.92,
      calculatedCurrentA: 76.4,
    });

    expect(trace3Ph.steps[0].formula).toContain("√3");
    expect(trace3Ph.resultValue).toBe("76.4 A");

    const trace1Ph = buildDesignCurrentTrace({
      loadName: "Socket Ring",
      powerKw: 3.68,
      powerFactor: 1.0,
      voltageV: 230,
      isThreePhase: false,
      calculatedCurrentA: 16.0,
    });

    expect(trace1Ph.steps[0].formula).toContain("V_LN");
    expect(trace1Ph.resultValue).toBe("16.0 A");
  });

  it("builds Short Circuit trace adhering to IEC 60909", () => {
    const trace = buildShortCircuitTrace({
      locationName: "Main LV Switchboard",
      transformerKva: 1000,
      transformerZPercent: 5.5,
      voltageSecondaryV: 400,
      threePhaseIscKa: 27.56,
      peakCurrentKa: 58.42,
    });

    expect(trace.standardCitation).toContain("IEC 60909");
    expect(trace.resultValue).toBe("27.56 kA");
    expect(trace.steps.length).toBe(3);
  });

  it("builds Breaker Sizing trace and verifies breaking capacity margin", () => {
    const trace = buildBreakerSizingTrace({
      circuitName: "HVAC Feeder",
      designCurrentA: 142.5,
      selectedTripA: 160,
      frameSizeA: 250,
      breakingCapacityKa: 36,
      prospectiveFaultKa: 22.4,
      cableAmpacityA: 185,
    });

    expect(trace.compliance?.status).toBe("PASS");
    expect(trace.compliance?.actual).toBe("160 A / 36 kA");
  });

  it("builds Phase Balance trace on the engine's current-unbalance metric", () => {
    // NEMA CUR = ΔI_max / I_avg × 100% = 2.833 / 24.333 × 100 ≈ 11.64%
    const unbalance = currentUnbalancePct([26.0, 25.5, 21.5]);
    const trace = buildPhaseBalanceTrace({
      panelName: "Distribution Board DB-01",
      l1A: 26.0,
      l2A: 25.5,
      l3A: 21.5,
      unbalancePercent: unbalance,
      maxAllowablePercent: 10.0,
    });

    expect(trace.compliance?.status).toBe("WARN"); // unbalance flags as WARN, per engine convention
    expect(trace.steps[0].label).toContain("Average Phase Current");
    expect(trace.steps[2].formula).toContain("ΔI_max / I_avg");

    const balanced = buildPhaseBalanceTrace({
      l1A: 100,
      l2A: 95,
      l3A: 98,
      unbalancePercent: currentUnbalancePct([100, 95, 98]),
    });
    expect(balanced.resultValue).toBe(`${currentUnbalancePct([100, 95, 98]).toFixed(2)}%`);
    expect(balanced.compliance?.status).toBe("PASS");
  });

  it("formats trace as clean, readable plain text for clipboard copying", () => {
    const trace = buildVoltageDropTrace({
      circuitName: "Feeder A",
      currentA: 50,
      lengthM: 30,
      cableSizeMm2: 25,
      conductorMaterial: "copper",
      powerFactor: 0.9,
      systemVoltageV: 400,
      isThreePhase: true,
      dropVolts: 1.1,
      dropPercent: 0.28,
    });

    const text = formatTraceAsPlainText(trace);
    expect(text).toContain("VOLTAGE DROP TRACE: FEEDER A");
    expect(text).toContain("Governing Code: IEC 60364-5-52");
    expect(text).toContain("CALCULATION STEPS:");
    expect(text).toContain("INPUT PARAMETERS & PROVENANCE:");
    expect(text).toContain("COMPLIANCE STATUS: PASS");
  });
});

describe("Calculation Trace Engine - NEMA / NEC Standard Support", () => {
  it("builds a NEMA Voltage Drop trace with AWG/kcmil formatting and NEC citations", () => {
    const trace = buildVoltageDropTrace({
      circuitName: "Pump Feeder 01",
      currentA: 180,
      lengthM: 60,
      cableSizeMm2: 185,
      parallelRuns: 3,
      conductorMaterial: "copper",
      powerFactor: 0.85,
      systemVoltageV: 480,
      isThreePhase: true,
      dropVolts: 4.8,
      dropPercent: 1.0,
      maxDropPercentLimit: 3.0,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("NEC 210.19(A) & NEC Ch. 9 Table 8 / IEEE 141");
    expect(trace.standardBadge).toBe("NEC / NEMA Standards Verified");
    // Verify the cable parameter is formatted in kcmil / AWG, not raw mm²
    const cableParam = trace.parameters.find(p => p.name.includes("Cable Size") || p.name.includes("Cable Section"));
    expect(cableParam).toBeDefined();
    expect(cableParam?.value).toBe("3 × 350 kcmil");
    expect(cableParam?.source).toContain("Cable Schedule (NEC)");
    expect(trace.compliance?.status).toBe("PASS");
  });

  it("builds a NEMA Cable Ampacity trace with NEC citations and AWG trade size", () => {
    const trace = buildCableAmpacityTrace({
      circuitName: "Lighting Panel Feeder",
      cableSizeMm2: 16,
      parallelRuns: 1,
      material: "copper",
      insulation: "XLPE",
      installMethod: "Conduit in air",
      ambientTempC: 40,
      groupingCount: 3,
      tempFactor: 0.91,
      groupFactor: 0.80,
      nominalAmpacityPerRun: 75,
      deratedAmpacityPerRun: 54.6,
      totalDeratedAmpacity: 54.6,
      breakerSizeA: 50,
      designCurrentA: 42,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("NEC (NEMA) / IEC 60364-5-52 §523 & Tables B.52.1–B.52.17");
    expect(trace.standardBadge).toBe("NEC / NEMA Standards Verified");
    const cableParam = trace.parameters.find(p => p.name.includes("Cable Size"));
    expect(cableParam).toBeDefined();
    expect(cableParam?.value).toBe("6 AWG");
    expect(trace.compliance?.status).toBe("PASS");
  });

  it("builds a NEMA Breaker Sizing trace with NEC 240.6(A) standard breaker citation", () => {
    const trace = buildBreakerSizingTrace({
      circuitName: "Air Handler Unit",
      designCurrentA: 32,
      selectedTripA: 40,
      frameSizeA: 100,
      breakingCapacityKa: 22,
      prospectiveFaultKa: 14.5,
      cableAmpacityA: 55,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("NEC 240.6(A) / NEMA AB-1 & UL 489 / IEC 60947-2");
    expect(trace.standardBadge).toBe("NEC / NEMA Standards Verified");
    expect(trace.compliance?.status).toBe("PASS");
  });

  it("builds a NEMA Short Circuit trace with IEEE 141/242 and NEMA citations", () => {
    const trace = buildShortCircuitTrace({
      locationName: "Main Switchboard MSB-1",
      transformerKva: 1500,
      transformerZPercent: 5.75,
      voltageSecondaryV: 480,
      threePhaseIscKa: 31.4,
      peakCurrentKa: 69.1,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("IEEE 141 / IEEE 242 & IEC 60909-0");
    expect(trace.standardBadge).toBe("IEEE / NEMA Standards Verified");
    expect(trace.resultValue).toBe("31.40 kA");
  });

  it("builds a NEMA Phase Balance trace with NEMA MG 1 citation", () => {
    const trace = buildPhaseBalanceTrace({
      panelName: "Distribution Panel DP-1",
      l1A: 85,
      l2A: 82,
      l3A: 84,
      unbalancePercent: 2.4,
      maxAllowablePercent: 10,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("NEMA MG 1 & ANSI C84.1 / IEEE 141 (Recommended < 10%)");
    expect(trace.standardBadge).toBe("NEMA / IEEE Standards Verified");
    expect(trace.compliance?.status).toBe("PASS");
  });

  it("builds a NEMA Design Current trace with NEC Article 220 citation", () => {
    const trace = buildDesignCurrentTrace({
      loadName: "Motor Load",
      powerKw: 30,
      powerFactor: 0.88,
      voltageV: 480,
      isThreePhase: true,
      calculatedCurrentA: 41.0,
      calculationStandard: "NEMA",
    });

    expect(trace.standardCitation).toBe("NEC Article 220 & IEEE Standard");
    expect(trace.standardBadge).toBe("NEC / NEMA Standards Verified");
    expect(trace.resultValue).toBe("41.0 A");
  });
});