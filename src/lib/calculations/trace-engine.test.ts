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

  it("builds Phase Balance trace and identifies unbalance percentage", () => {
    const trace = buildPhaseBalanceTrace({
      panelName: "Distribution Board DB-01",
      l1Kw: 24.5,
      l2Kw: 22.0,
      l3Kw: 21.5,
      unbalancePercent: 8.07,
      maxAllowablePercent: 10.0,
    });

    expect(trace.compliance?.status).toBe("PASS");
    expect(trace.steps[0].label).toContain("Average Phase Load");
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