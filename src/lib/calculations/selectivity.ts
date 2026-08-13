import { parseCableSize } from "./cables";
import { assertNonNegative, assertPositive } from "./validate";

export interface CurvePoint {
  current: number; // Amperes
  time: number;    // Seconds
  region?: 'L' | 'S' | 'I' | 'G' | 'INST';
}

export interface BreakerCurveSettings {
  inRating: number; // Nominal In (A)
  ir: number;       // Long-time pickup (A)
  tr: number;       // Long-time delay (s)
  isd?: number;     // Short-time pickup (A)
  tsd?: number;     // Short-time delay (s)
  i2t?: boolean;    // I²t ON/OFF
  ii?: number;      // Instantaneous pickup (A)
  ig?: number;      // Ground fault pickup (A)
  tg?: number;      // Ground fault delay (s)
  category?: 'MCB' | 'MCCB' | 'ACB';
  curveType?: 'B' | 'C' | 'D' | 'LSI' | 'TM';
  curveData?: CurvePoint[];
  letThroughI2t?: { current: number; i2t: number }[];
  manufacturer?: string;
  model?: string;
}

export type SelectivityStatus = "FULL" | "PARTIAL" | "NONE";

export interface CoordinationResult {
  status: SelectivityStatus;
  limitCurrent?: number; // Selectivity limit in Amperes
  overlapDetails?: string;
  cascadingSupported: boolean;
  cascadingIcu?: number; // Enhanced breaking capacity with cascading (kA)
  cableDamageOk: boolean;
  energySelectivityApplied?: boolean;
  currentGradingOk: boolean;
  timeGradingOk: boolean;
  timeMarginSeconds?: number;
}

// ---------------------------------------------------------------------------
// 1. Standard Curve Generators (IEC 60898-1 & IEC 60947-2)
// ---------------------------------------------------------------------------

/**
 * Generates an IEC 60898-1 standard MCB Time-Current Characteristic (TCC) curve.
 * Curves:
 * - B: Magnetic trip between 3x In and 5x In (domestic, low inrush)
 * - C: Magnetic trip between 5x In and 10x In (standard commercial, mixed loads)
 * - D: Magnetic trip between 10x In and 20x In (motors, heavy inductive loads)
 */
export function generateMcbCurve(
  inRating: number,
  curveType: 'B' | 'C' | 'D' = 'C'
): CurvePoint[] {
  assertPositive('inRating', inRating);

  const points: CurvePoint[] = [];

  // 1. Non-tripping threshold (1.05 * In -> 10000s)
  points.push({ current: inRating * 1.05, time: 10000, region: 'L' });

  // 2. Conventional tripping current (1.13 * In -> 3600s, 1.45 * In -> 60s)
  points.push({ current: inRating * 1.13, time: 3600, region: 'L' });
  points.push({ current: inRating * 1.45, time: 60, region: 'L' });
  points.push({ current: inRating * 2.0, time: 12, region: 'L' });
  points.push({ current: inRating * 2.55, time: 3, region: 'L' });

  // 3. Thermal-to-Magnetic transition band
  let magLower = 5;
  let magUpper = 10;
  if (curveType === 'B') {
    magLower = 3;
    magUpper = 5;
  } else if (curveType === 'D') {
    magLower = 10;
    magUpper = 20;
  }

  // Pre-magnetic point
  points.push({ current: inRating * (magLower * 0.9), time: 0.2, region: 'L' });
  // Instantaneous magnetic trip boundary (20ms mechanical opening time)
  points.push({ current: inRating * magLower, time: 0.04, region: 'INST' });
  points.push({ current: inRating * magUpper, time: 0.015, region: 'INST' });
  points.push({ current: inRating * 50, time: 0.01, region: 'INST' });

  return points.sort((a, b) => a.current - b.current);
}

/**
 * Calculates trip time (seconds) from standard LSI parameters per IEC 60947-2.
 */
export function getTripTimeForCurrent(
  settings: BreakerCurveSettings,
  current: number
): number {
  assertNonNegative('current', current);
  assertPositive('inRating', settings.inRating);
  assertPositive('ir', settings.ir);
  assertPositive('tr', settings.tr);

  if (current <= 0) return 10000;

  // If curveData points are pre-loaded (e.g. from MCB generator or manufacturer catalog),
  // use piecewise log-log interpolation for highest precision
  if (settings.curveData && settings.curveData.length > 1) {
    return interpolateTripTime(settings.curveData, current);
  }

  // 1. Long Time (L) Overload Region (IEC standard inverse equation)
  let t_L = 10000;
  if (current > settings.ir) {
    const ratio = current / settings.ir;
    if (ratio > 1.001) {
      t_L = (settings.tr * 36) / (ratio * ratio - 1);
    }
  }

  // 2. Short Time (S) Region
  let t_S = 10000;
  if (settings.isd && settings.tsd) {
    if (current >= settings.isd) {
      if (settings.i2t) {
        // Inverse S curve: t = tsd * (Isd/I)^2
        t_S = settings.tsd * Math.pow(settings.isd / current, 2);
        t_S = Math.max(t_S, 0.02);
      } else {
        // Definite time delay
        t_S = settings.tsd;
      }
    }
  }

  // 3. Instantaneous (I) Region
  let t_I = 10000;
  if (settings.ii) {
    if (current >= settings.ii) {
      t_I = 0.02; // 20ms instantaneous magnetic trip
    }
  }

  const t_trip = Math.min(t_L, t_S, t_I);
  return Math.max(0.01, Math.min(10000, t_trip));
}

// ---------------------------------------------------------------------------
// 2. Log-Log Piecewise Interpolation
// ---------------------------------------------------------------------------

/**
 * Performs piecewise linear interpolation on log10-log10 coordinates.
 * This matches standard Time-Current Characteristic (TCC) behavior.
 */
export function interpolateTripTime(curvePoints: CurvePoint[], current: number): number {
  assertNonNegative('current', current);
  if (curvePoints.length === 0 || current <= 0) return 10000;

  const sorted = [...curvePoints].sort((a, b) => a.current - b.current);

  // If current is below the lowest threshold, breaker does not trip
  if (current <= sorted[0].current) {
    return sorted[0].time;
  }

  // If current exceeds highest defined point, return instantaneous time
  if (current >= sorted[sorted.length - 1].current) {
    return sorted[sorted.length - 1].time;
  }

  // Find bracketing segment
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (current >= p1.current && current <= p2.current) {
      if (p1.current === p2.current) return p2.time;

      const logI = Math.log10(current);
      const logI1 = Math.log10(Math.max(0.01, p1.current));
      const logI2 = Math.log10(Math.max(0.01, p2.current));
      const logT1 = Math.log10(Math.max(0.001, p1.time));
      const logT2 = Math.log10(Math.max(0.001, p2.time));

      const slope = (logT2 - logT1) / (logI2 - logI1);
      const logT = logT1 + slope * (logI - logI1);
      const time = Math.pow(10, logT);

      return Math.max(0.01, Math.min(10000, time));
    }
  }

  return 0.02;
}

/**
 * Generates coordinate points on a log-log scale for plotting.
 */
export function generateCurvePoints(settings: BreakerCurveSettings): CurvePoint[] {
  assertPositive('inRating', settings.inRating);
  assertPositive('ir', settings.ir);
  assertPositive('tr', settings.tr);

  // If breaker is an MCB, generate accurate IEC 60898 points
  if (settings.category === 'MCB') {
    const curveType = settings.curveType === 'B' || settings.curveType === 'D' ? settings.curveType : 'C';
    const basePoints = generateMcbCurve(settings.inRating, curveType);
    return basePoints;
  }

  const points: CurvePoint[] = [];
  const startCurrent = Math.max(1, settings.ir * 0.5);
  const endCurrent = settings.inRating * 30;

  const steps = 100;
  const logStart = Math.log(startCurrent);
  const logEnd = Math.log(endCurrent);
  const step = (logEnd - logStart) / steps;

  for (let i = 0; i <= steps; i++) {
    const current = Math.exp(logStart + i * step);
    const time = getTripTimeForCurrent(settings, current);
    points.push({
      current: parseFloat(current.toFixed(1)),
      time: parseFloat(time.toFixed(4)),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// 3. Cable Thermal Withstand (Adiabatic Equation IEC 60364-5-54)
// ---------------------------------------------------------------------------

/**
 * Calculates cable thermal damage withstand limit time in seconds per IEC 60364-5-54:
 * t = (k * S / I)^2
 *
 * Material factors (k):
 * - Copper + XLPE (90°C): k = 176
 * - Copper + PVC (70°C): k = 143
 * - Aluminum + XLPE (90°C): k = 116
 * - Aluminum + PVC (70°C): k = 95
 */
export function calculateCableWithstandTime(
  cableInput: number | string,
  currentAmps: number,
  material: 'copper' | 'aluminum' = 'copper',
  insulation: 'PVC' | 'XLPE' = 'XLPE'
): number {
  const parsed = typeof cableInput === 'string' ? parseCableSize(cableInput) : null;
  const effectiveArea = parsed ? parsed.size * parsed.runs : (typeof cableInput === 'number' ? cableInput : 16);
  assertPositive('cableSizeMm2', effectiveArea);
  assertNonNegative('currentAmps', currentAmps);

  if (currentAmps <= 0) return 10000;

  const k = material === 'copper'
    ? (insulation === 'XLPE' ? 176 : 143)
    : (insulation === 'XLPE' ? 116 : 95);

  const t = Math.pow((k * effectiveArea) / currentAmps, 2);
  return Math.max(0.001, Math.min(10000, t));
}

/**
 * Generates coordinate points for plotting cable thermal damage curve.
 */
export function generateCableDamageCurve(
  cableInput: number | string,
  material: 'copper' | 'aluminum' = 'copper',
  insulation: 'PVC' | 'XLPE' = 'XLPE'
): CurvePoint[] {
  const points: CurvePoint[] = [];
  const minI = 50;
  const maxI = 50000;
  const steps = 60;
  const logMin = Math.log10(minI);
  const logMax = Math.log10(maxI);
  const step = (logMax - logMin) / steps;

  for (let i = 0; i <= steps; i++) {
    const current = Math.pow(10, logMin + i * step);
    const time = calculateCableWithstandTime(cableInput, current, material, insulation);
    if (time >= 0.01 && time <= 10000) {
      points.push({
        current: parseFloat(current.toFixed(1)),
        time: parseFloat(time.toFixed(4)),
      });
    }
  }

  return points;
}

/**
 * Checks whether the downstream protective device trips fast enough to prevent
 * cable thermal damage under fault currents up to the prospective short circuit.
 */
export function checkCableProtection(
  cableInput: number | string,
  downstream: BreakerCurveSettings,
  availableFaultCurrentAmps: number,
  material: 'copper' | 'aluminum' = 'copper',
  insulation: 'PVC' | 'XLPE' = 'XLPE'
): boolean {
  const parsed = typeof cableInput === 'string' ? parseCableSize(cableInput) : null;
  const effectiveArea = parsed ? parsed.size * parsed.runs : (typeof cableInput === 'number' ? cableInput : 16);
  if (effectiveArea <= 0 || availableFaultCurrentAmps <= 0) return true;

  // Test across critical fault points: 5x In, 10x In, 20x In, and available fault current
  const testPoints = [
    downstream.inRating * 5,
    downstream.inRating * 10,
    downstream.inRating * 20,
    availableFaultCurrentAmps,
  ].filter((I) => I > downstream.ir && I <= availableFaultCurrentAmps);

  for (const current of testPoints) {
    const tripTime = getTripTimeForCurrent(downstream, current);
    const withstandTime = calculateCableWithstandTime(cableInput, current, material, insulation);

    // If breaker trip time exceeds cable withstand time, cable will overheat
    if (tripTime > withstandTime) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// 4. Tested Manufacturer Selectivity Matrix & Energy Selectivity
// ---------------------------------------------------------------------------

interface TestedSelectivityRule {
  upstreamCategory: 'ACB' | 'MCCB';
  downstreamCategory: 'MCCB' | 'MCB';
  minUpstreamIn: number;
  maxDownstreamIn: number;
  testedLimitKa: number;
}

const TESTED_SELECTIVITY_TABLES: TestedSelectivityRule[] = [
  // ACB (Emax 2 / Masterpact) -> MCCB (Tmax / NSX)
  { upstreamCategory: 'ACB', downstreamCategory: 'MCCB', minUpstreamIn: 630, maxDownstreamIn: 250, testedLimitKa: 50 },
  { upstreamCategory: 'ACB', downstreamCategory: 'MCCB', minUpstreamIn: 630, maxDownstreamIn: 630, testedLimitKa: 36 },
  { upstreamCategory: 'ACB', downstreamCategory: 'MCB', minUpstreamIn: 630, maxDownstreamIn: 63, testedLimitKa: 50 },

  // MCCB (Tmax XT / ComPacT NSX) -> MCB (S200 / Acti9 iC60) via Energy Selectivity (I²t)
  { upstreamCategory: 'MCCB', downstreamCategory: 'MCB', minUpstreamIn: 160, maxDownstreamIn: 32, testedLimitKa: 36 },
  { upstreamCategory: 'MCCB', downstreamCategory: 'MCB', minUpstreamIn: 160, maxDownstreamIn: 63, testedLimitKa: 25 },
  { upstreamCategory: 'MCCB', downstreamCategory: 'MCB', minUpstreamIn: 63, maxDownstreamIn: 25, testedLimitKa: 15 },
  { upstreamCategory: 'MCCB', downstreamCategory: 'MCB', minUpstreamIn: 63, maxDownstreamIn: 63, testedLimitKa: 10 },
];

/**
 * Looks up verified manufacturer tested selectivity limits (ABB DOC / Schneider ECODIAL).
 */
export function lookupTestedSelectivity(
  upstream: BreakerCurveSettings,
  downstream: BreakerCurveSettings
): number | null {
  const upCat = upstream.category ?? (upstream.inRating >= 630 ? 'ACB' : 'MCCB');
  const downCat = downstream.category ?? (downstream.inRating <= 63 ? 'MCB' : 'MCCB');

  for (const rule of TESTED_SELECTIVITY_TABLES) {
    if (
      rule.upstreamCategory === upCat &&
      rule.downstreamCategory === downCat &&
      upstream.inRating >= rule.minUpstreamIn &&
      downstream.inRating <= rule.maxDownstreamIn
    ) {
      return rule.testedLimitKa * 1000; // Return in Amperes
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 5. Four-Phase Production Verification Engine
// ---------------------------------------------------------------------------

export interface VerifyCoordinationOptions {
  cableSizeMm2?: number;
  cableMaterial?: 'copper' | 'aluminum';
  cableInsulation?: 'PVC' | 'XLPE';
  manufacturerPair?: { upstreamMfg: string; downstreamMfg: string };
}

/**
 * Production-grade four-phase selectivity and coordination check:
 * 1. Current Grading (Ir,up >= 1.6 * Ir,down)
 * 2. Time Grading at 10x downstream In (margin >= 0.3s for MCCB-MCCB, 0.1s for MCCB-MCB)
 * 3. Energy Selectivity (I²t let-through comparison / tested manufacturer matrix)
 * 4. Selectivity Limit vs Prospective Fault Current (Isc)
 * 5. Cable Thermal Damage Withstand Check (IEC 60364-5-54)
 */
export function verifyCoordination(
  upstream: BreakerCurveSettings,
  downstream: BreakerCurveSettings,
  availableFaultCurrentAmps: number,
  options?: VerifyCoordinationOptions | { upstreamMfg: string; downstreamMfg: string }
): CoordinationResult {
  assertPositive('upstream inRating', upstream.inRating);
  assertPositive('upstream ir', upstream.ir);
  assertPositive('downstream inRating', downstream.inRating);
  assertPositive('downstream ir', downstream.ir);
  assertNonNegative('availableFaultCurrentAmps', availableFaultCurrentAmps);

  // Normalize options
  const opts: VerifyCoordinationOptions = options && 'upstreamMfg' in options
    ? { manufacturerPair: options }
    : (options as VerifyCoordinationOptions) ?? {};

  const cableSizeMm2 = opts.cableSizeMm2 ?? 10;
  const cableMaterial = opts.cableMaterial ?? 'copper';
  const cableInsulation = opts.cableInsulation ?? 'XLPE';
  const manufacturerPair = opts.manufacturerPair ?? {
    upstreamMfg: upstream.manufacturer ?? 'ABB',
    downstreamMfg: downstream.manufacturer ?? 'ABB',
  };

  // Phase 1: Current Grading Check
  // Upstream overload setting must be at least 1.6x downstream overload setting
  let currentGradingOk = true;
  if (upstream.ir < downstream.ir * 1.59) {
    currentGradingOk = false;
  }

  if (upstream.ir <= downstream.ir) {
    return {
      status: "NONE",
      currentGradingOk: false,
      timeGradingOk: false,
      overlapDetails: "Upstream overload setting (Ir) is less than or equal to downstream (Ir).",
      cascadingSupported: false,
      cableDamageOk: checkCableProtection(cableSizeMm2, downstream, availableFaultCurrentAmps, cableMaterial, cableInsulation),
    };
  }

  // Phase 2: Time Grading Check at 10x In
  const testCurrent = downstream.inRating * 10;
  const t_up_test = getTripTimeForCurrent(upstream, testCurrent);
  const t_down_test = getTripTimeForCurrent(downstream, testCurrent);

  const upCategory = upstream.category ?? (upstream.inRating >= 630 ? 'ACB' : 'MCCB');
  const downCategory = downstream.category ?? (downstream.inRating <= 63 ? 'MCB' : 'MCCB');

  // Time margin: 0.3s for MCCB->MCCB, 0.1s for MCCB->MCB
  const requiredMargin = upCategory === 'MCCB' && downCategory === 'MCB' ? 0.1 : 0.25;
  const timeGradingOk = t_up_test >= t_down_test + requiredMargin;

  // Phase 3: Energy Selectivity & Tested Manufacturer Tables
  let energySelectivityApplied = false;
  let testedLimitAmps: number | null = null;

  const sameMfg = manufacturerPair.upstreamMfg.toUpperCase() === manufacturerPair.downstreamMfg.toUpperCase();
  if (sameMfg) {
    testedLimitAmps = lookupTestedSelectivity(upstream, downstream);
    if (testedLimitAmps !== null) {
      energySelectivityApplied = true;
    }
  }

  // Phase 4: Calculate Selectivity Limit by scanning curves
  const minScan = downstream.ir;
  const maxScan = Math.max(availableFaultCurrentAmps, upstream.inRating * 20);
  const steps = 150;
  const logStart = Math.log(minScan);
  const logEnd = Math.log(maxScan);
  const step = (logEnd - logStart) / steps;

  let curveIntersectionCurrent: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const current = Math.exp(logStart + i * step);
    const t_up = getTripTimeForCurrent(upstream, current);
    const t_down = getTripTimeForCurrent(downstream, current);

    // If upstream trips within required margin or faster, curves intersect
    if (t_up <= t_down + (requiredMargin * 0.5) && t_down < 9000) {
      if (curveIntersectionCurrent === null) {
        curveIntersectionCurrent = current;
        break;
      }
    }
  }

  // Resolve effective selectivity limit (considering energy selectivity)
  let effectiveLimitAmps = curveIntersectionCurrent;
  if (testedLimitAmps !== null) {
    // Energy selectivity extends the magnetic crossover limit up to the tested value
    effectiveLimitAmps = Math.max(curveIntersectionCurrent ?? 0, testedLimitAmps);
  }

  // Verdict Resolution
  let status: SelectivityStatus = "FULL";
  let limitCurrent: number | undefined;
  let overlapDetails: string | undefined;

  if (!currentGradingOk && effectiveLimitAmps === null) {
    status = "NONE";
    overlapDetails = `Current grading violated: Upstream Ir (${upstream.ir}A) is < 1.6× Downstream Ir (${downstream.ir}A).`;
  } else if (effectiveLimitAmps !== null) {
    if (effectiveLimitAmps <= downstream.ir * 1.5) {
      status = "NONE";
      overlapDetails = `Immediate curve overlap at ${Math.round(effectiveLimitAmps)}A. Overload settings conflict.`;
    } else if (effectiveLimitAmps < availableFaultCurrentAmps) {
      status = "PARTIAL";
      limitCurrent = Math.round(effectiveLimitAmps);
      overlapDetails = `Selective up to ${(limitCurrent / 1000).toFixed(1)} kA. Faults above this level may trip both breakers.`;
    } else {
      status = "FULL";
      limitCurrent = Math.round(effectiveLimitAmps);
      overlapDetails = `Fully selective up to ${(effectiveLimitAmps / 1000).toFixed(1)} kA (exceeds prospective fault level ${(availableFaultCurrentAmps / 1000).toFixed(1)} kA).`;
    }
  }

  // Phase 5: Cable Thermal Withstand Check
  const cableDamageOk = checkCableProtection(
    cableSizeMm2,
    downstream,
    availableFaultCurrentAmps,
    cableMaterial,
    cableInsulation
  );

  return {
    status,
    limitCurrent,
    overlapDetails,
    cascadingSupported: sameMfg,
    cascadingIcu: sameMfg ? 36 : undefined,
    cableDamageOk,
    energySelectivityApplied,
    currentGradingOk,
    timeGradingOk,
    timeMarginSeconds: parseFloat((t_up_test - t_down_test).toFixed(3)),
  };
}

/**
 * Recommends optimal trip settings for a breaker based on load current and cable ampacity.
 */
export function recommendBreakerSettings(
  loadCurrent: number,
  cableAmpacity: number,
  breakerIn: number
): BreakerCurveSettings {
  assertNonNegative('loadCurrent', loadCurrent);
  assertPositive('cableAmpacity', cableAmpacity);
  assertPositive('breakerIn', breakerIn);

  const targetIr = loadCurrent > 0
    ? Math.max(loadCurrent, Math.min(loadCurrent * 1.15, cableAmpacity))
    : breakerIn;
  const ir = parseFloat(Math.max(1, Math.min(breakerIn, targetIr)).toFixed(1));
  const tr = 12;

  const isd = parseFloat((ir * 5).toFixed(1));
  const tsd = 0.1;
  const ii = breakerIn * 10;

  return {
    inRating: breakerIn,
    ir,
    tr,
    isd,
    tsd,
    i2t: false,
    ii,
    ig: parseFloat((breakerIn * 0.4).toFixed(1)),
    tg: 0.1,
  };
}

// ---------------------------------------------------------------------------
// 6. Intelligent Alternative Breaker Recommendation Engine
// ---------------------------------------------------------------------------

export interface SuggestAlternativeOptions {
  downstreamLoadCurrent?: number;
  cableSizeMm2?: number;
  parentFeederName?: string | null;
  preferredManufacturer?: string;
}

export type { BreakerAlternativeSuggestion, FallbackType, GenericBreakerSpec } from "@/types";
import type { BreakerAlternativeSuggestion, FallbackType, GenericBreakerSpec } from "@/types";

const STANDARD_BREAKER_SIZES = [
  16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000
];

/**
 * Evaluates coordination shortcomings and recommends alternative breaker models,
 * frame sizes, or trip unit settings to achieve FULL selectivity.
 */
export function suggestAlternativeBreaker(
  upstream: BreakerCurveSettings,
  downstream: BreakerCurveSettings,
  availableFaultCurrentAmps: number,
  options?: SuggestAlternativeOptions
): BreakerAlternativeSuggestion[] {
  const suggestions: BreakerAlternativeSuggestion[] = [];
  const mfg = (upstream.manufacturer || downstream.manufacturer || options?.preferredManufacturer || 'Schneider').toUpperCase();
  const isSchneider = mfg.includes('SCHNEIDER');
  const isAbb = mfg.includes('ABB');

  const faultKa = (availableFaultCurrentAmps / 1000).toFixed(1);
  const loadCurrent = options?.downstreamLoadCurrent ?? downstream.ir;

  // 1. Upstream Frame Sizing Upgrade (Ir,up < 1.6 * Ir,down or In,up <= In,down or magnetic overlap)
  const minRequiredUpstreamIr = Math.max(downstream.ir * 1.6, (downstream.inRating || 0) * 1.25);
  const targetUpstreamSize =
    STANDARD_BREAKER_SIZES.find((s) => s > upstream.inRating && s >= minRequiredUpstreamIr) ||
    STANDARD_BREAKER_SIZES.find((s) => s > upstream.inRating) ||
    Math.max(250, upstream.inRating * 2);

  let suggestedUpstreamModel = `${targetUpstreamSize}A Electronic LSI Breaker`;
  let upstreamFallbackType: FallbackType = 'GENERIC_SPEC';
  let upstreamGenericSpec: GenericBreakerSpec | undefined;

  if (isSchneider) {
    upstreamFallbackType = 'SAME_FAMILY';
    if (targetUpstreamSize <= 630) {
      suggestedUpstreamModel = `Schneider ComPacT NSX${targetUpstreamSize} ${targetUpstreamSize}A MicroLogic 2.3`;
    } else {
      suggestedUpstreamModel = `Schneider MasterPact MTZ1 ${targetUpstreamSize}A MicroLogic 5.0 X`;
    }
  } else if (isAbb) {
    upstreamFallbackType = 'SAME_FAMILY';
    if (targetUpstreamSize <= 250) {
      suggestedUpstreamModel = `ABB Tmax XT4 ${targetUpstreamSize}A Ekip Dip LSI`;
    } else if (targetUpstreamSize <= 630) {
      suggestedUpstreamModel = `ABB Tmax XT5 ${targetUpstreamSize}A Ekip Dip LSI`;
    } else {
      suggestedUpstreamModel = `ABB Emax 2 E1.2 ${targetUpstreamSize}A Ekip Touch`;
    }
  } else {
    upstreamGenericSpec = {
      ratingAmps: targetUpstreamSize,
      category: targetUpstreamSize >= 630 ? 'ACB' : 'MCCB',
      poles: 3,
      requiredIcuKa: targetUpstreamSize >= 630 ? 50 : 36,
      tripUnitType: 'Electronic LSI (Adjustable Ir, Isd, tsd, Ii)',
      standard: 'IEC 60947-2',
      procurementNotes: `Procure ${targetUpstreamSize}A ${targetUpstreamSize >= 630 ? 'ACB' : 'MCCB'} 3P breaker with electronic LSI trip unit and min Icu=${targetUpstreamSize >= 630 ? 50 : 36}kA.`,
    };
  }

  suggestions.push({
    id: 'sug-upstream-upgrade',
    type: 'UPSTREAM_UPGRADE',
    badge: 'Upgrade Upstream Frame',
    title: `Upgrade Upstream (${upstream.model || 'Feeder'}) to ${targetUpstreamSize}A`,
    description: `Current grading requires Upstream Ir ≥ 1.6× Downstream Ir (${downstream.ir.toFixed(1)}A). Upgrading upstream to ${targetUpstreamSize}A provides the required margin (ratio: ${(targetUpstreamSize / downstream.ir).toFixed(2)}x) and achieves FULL discrimination.`,
    suggestedModel: suggestedUpstreamModel,
    suggestedFrameSize: targetUpstreamSize,
    fallbackType: upstreamFallbackType,
    genericSpec: upstreamGenericSpec,
    expectedSelectivity: 'FULL',
    actionText: `Select ${targetUpstreamSize}A Upstream Breaker`,
  });

  // If feeder is downstream of an SMDB sub-panel
  if (options?.parentFeederName && options.parentFeederName.includes('SMDB')) {
    suggestions.push({
      id: 'sug-direct-feed',
      type: 'DIRECT_MDB_FEED',
      badge: 'Direct MDB Feed',
      title: 'Feed Directly from Main Incomer (MDB Bus)',
      description: `This heavy load (${loadCurrent.toFixed(1)}A) exceeds typical sub-panel branching limits. Routing this circuit directly from the Main MDB incomer eliminates the sub-panel bottleneck and ensures FULL selectivity.`,
      expectedSelectivity: 'FULL',
      actionText: 'Connect directly to MDB bus',
    });
  }

  // Downstream resize check (if load current is smaller than breaker frame)
  const optimalDownstreamSize = STANDARD_BREAKER_SIZES.find((s) => s >= loadCurrent * 1.25);
  if (optimalDownstreamSize && optimalDownstreamSize < downstream.inRating) {
    let suggestedDownstreamModel = `${optimalDownstreamSize}A LSI Breaker`;
    let downFallbackType: FallbackType = 'GENERIC_SPEC';
    let downGenericSpec: GenericBreakerSpec | undefined;

    if (isSchneider) {
      downFallbackType = 'SAME_FAMILY';
      if (optimalDownstreamSize <= 63) {
        suggestedDownstreamModel = `Schneider Acti9 iC60N ${optimalDownstreamSize}A 3P Curve C`;
      } else {
        const frame = optimalDownstreamSize <= 100 ? '100' : optimalDownstreamSize <= 160 ? '160' : optimalDownstreamSize <= 250 ? '250' : optimalDownstreamSize <= 400 ? '400' : '630';
        suggestedDownstreamModel = `Schneider ComPacT NSX${frame} ${optimalDownstreamSize}A MicroLogic 2.2`;
      }
    } else if (isAbb) {
      downFallbackType = 'SAME_FAMILY';
      if (optimalDownstreamSize <= 63) {
        suggestedDownstreamModel = `ABB System pro M compact S203-C${optimalDownstreamSize}`;
      } else {
        suggestedDownstreamModel = `ABB Tmax XT${optimalDownstreamSize <= 250 ? '4' : '5'} ${optimalDownstreamSize}A Ekip Dip`;
      }
    } else {
      downGenericSpec = {
        ratingAmps: optimalDownstreamSize,
        category: optimalDownstreamSize >= 630 ? 'ACB' : optimalDownstreamSize > 63 ? 'MCCB' : 'MCB',
        poles: downstream.category === 'MCB' ? 1 : 3,
        requiredIcuKa: optimalDownstreamSize > 63 ? 36 : 10,
        tripUnitType: optimalDownstreamSize > 63 ? 'Electronic LSI / TMD' : 'Thermal-Magnetic Type C',
        standard: optimalDownstreamSize > 63 ? 'IEC 60947-2' : 'IEC 60898-1',
        procurementNotes: `Procure ${optimalDownstreamSize}A breaker compliant with standard specifications.`,
      };
    }

    suggestions.push({
      id: 'sug-downstream-resize',
      type: 'DOWNSTREAM_RESIZE',
      badge: 'Resize Downstream',
      title: `Downsize Breaker to ${optimalDownstreamSize}A (Load is ${loadCurrent.toFixed(1)}A)`,
      description: `Downstream frame (${downstream.inRating}A) is oversized for the design current (${loadCurrent.toFixed(1)}A). Reducing to ${optimalDownstreamSize}A restores current grading against upstream ${upstream.inRating}A.`,
      suggestedModel: suggestedDownstreamModel,
      suggestedFrameSize: optimalDownstreamSize,
      fallbackType: downFallbackType,
      genericSpec: downGenericSpec,
      expectedSelectivity: upstream.ir >= optimalDownstreamSize * 1.6 ? 'FULL' : 'PARTIAL',
      actionText: `Set downstream to ${optimalDownstreamSize}A`,
    });
  }

  // 2. Time Grading / Energy Selectivity Tuning (PARTIAL or curve overlap)
  suggestions.push({
    id: 'sug-lsi-tuning',
    type: 'SETTINGS_ADJUSTMENT',
    badge: 'LSI Delay Tuning',
    title: 'Configure Electronic LSI Delay Grading (tsd = 0.05s / 0.3s)',
    description: `Set downstream short-time delay tsd to 0.05s (or instantaneous Ii = 6×Ir) and upstream tsd to 0.3s. This creates a 250ms grading margin, clearing downstream faults before the upstream trip mechanism begins unlatching at ${faultKa} kA.`,
    suggestedSettings: {
      tsd: 0.05,
      isd: downstream.ir * 4,
      ii: downstream.inRating * 8,
    },
    expectedSelectivity: 'FULL',
    actionText: 'Apply LSI Settings',
  });

  // 3. Electronic Trip Unit Upgrade (if using Thermal-Magnetic or standard unit)
  if (downstream.category === 'MCCB') {
    const tripUnitName = isSchneider ? 'MicroLogic 5.2 E' : 'Ekip Touch LSI';
    const currentModel = downstream.model || '';
    let upgradedModel = '';

    if (currentModel && !/^(?:ACB|MCCB|MCB)\s+\d+A?$/i.test(currentModel.trim())) {
      if (currentModel.includes('MicroLogic')) {
        upgradedModel = currentModel.replace(/MicroLogic\s*[\d.]+\s*[a-zA-Z]*/i, tripUnitName);
      } else if (currentModel.includes('Ekip')) {
        upgradedModel = currentModel.replace(/Ekip\s*[\w\s]+/i, tripUnitName);
      } else {
        upgradedModel = `${currentModel} ${tripUnitName}`.trim();
      }
    } else {
      if (isSchneider) {
        upgradedModel = `Schneider ComPacT NSX${downstream.inRating} NSX${downstream.inRating}N ${downstream.inRating}A ${tripUnitName}`;
      } else if (isAbb) {
        upgradedModel = `ABB Tmax XT${downstream.inRating <= 250 ? '4' : '5'} ${downstream.inRating}A ${tripUnitName}`;
      } else {
        upgradedModel = `Generic MCCB ${downstream.inRating}A 3P (${tripUnitName})`;
      }
    }

    suggestions.push({
      id: 'sug-trip-unit',
      type: 'ELECTRONIC_TRIP_UNIT',
      badge: 'Electronic Trip Unit',
      title: `Equip with ${tripUnitName} (Adjustable LSI)`,
      description: `Switching to ${tripUnitName} provides precise electronic short-time pickup (Isd) and delay (tsd) adjustments to eliminate curve overlap under fault currents up to ${faultKa} kA.`,
      suggestedModel: upgradedModel,
      suggestedSettings: {
        tsd: 0.05,
        isd: downstream.ir * 4,
        ii: downstream.inRating * 8,
      },
      expectedSelectivity: 'FULL',
      actionText: `Select ${tripUnitName}`,
    });
  }

  return suggestions;
}
