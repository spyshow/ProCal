import { assertNonNegative, assertPositive } from "./validate";

export interface BreakerCurveSettings {
  inRating: number; // In (A)
  ir: number; // Long-time pickup (A)
  tr: number; // Long-time delay (s)
  isd?: number; // Short-time pickup (A)
  tsd?: number; // Short-time delay (s)
  i2t?: boolean; // I²t ON/OFF
  ii?: number; // Instantaneous pickup (A)
  ig?: number; // Ground fault pickup (A)
  tg?: number; // Ground fault delay (s)
}

export interface CurvePoint {
  current: number;
  time: number;
}

/**
 * Calculates trip time (seconds) for a specific current (Amperes) based on breaker settings.
 */
export function getTripTimeForCurrent(settings: BreakerCurveSettings, current: number): number {
  assertNonNegative('current', current);
  assertPositive('inRating', settings.inRating);
  assertPositive('ir', settings.ir);
  assertPositive('tr', settings.tr);

  if (current === 0) return 10000;
  
  // 1. Long Time (L) overload region
  let t_L = 10000;
  if (current > settings.ir) {
    // Standard inverse curve: t = tr * 36 / ((I/Ir)^2 - 1)
    const ratio = current / settings.ir;
    if (ratio > 1.001) {
      t_L = (settings.tr * 36) / (ratio * ratio - 1);
    }
  }

  // 2. Short Time (S) region
  let t_S = 10000;
  if (settings.isd && settings.tsd) {
    if (current >= settings.isd) {
      if (settings.i2t) {
        // Inverse S curve: t = tsd * (Isd/I)^2
        t_S = settings.tsd * Math.pow(settings.isd / current, 2);
        // Delay cannot fall below standard minimum mechanical opening time (0.02s) or settings.tsd base
        t_S = Math.max(t_S, 0.02);
      } else {
        // Constant delay
        t_S = settings.tsd;
      }
    }
  }

  // 3. Instantaneous (I) region
  let t_I = 10000;
  if (settings.ii) {
    if (current >= settings.ii) {
      t_I = 0.02; // 20ms instantaneous trip
    }
  }

  // The breaker trips on whichever threshold is exceeded first
  const t_trip = Math.min(t_L, t_S, t_I);
  
  // Cap values for graphing log limits [0.01s, 10000s]
  return Math.max(0.01, Math.min(10000, t_trip));
}

/**
 * Generates coordinate points on a log-log scale for plotting.
 * Currents range from 0.1 * Ir to 100 * In.
 */
export function generateCurvePoints(settings: BreakerCurveSettings): CurvePoint[] {
  assertPositive('inRating', settings.inRating);
  assertPositive('ir', settings.ir);
  assertPositive('tr', settings.tr);

  const points: CurvePoint[] = [];
  const startCurrent = Math.max(1, settings.ir * 0.5);
  const endCurrent = settings.inRating * 30;
  
  // Use exponential spacing for clean logarithmic plotting
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

export type SelectivityStatus = "FULL" | "PARTIAL" | "NONE";

export interface CoordinationResult {
  status: SelectivityStatus;
  limitCurrent?: number; // Selectivity limit in Amperes
  overlapDetails?: string;
  cascadingSupported: boolean;
  cascadingIcu?: number; // Enhanced breaking capacity with cascading (kA)
}

/**
 * Verifies selectivity between upstream and downstream breakers.
 */
export function verifyCoordination(
  upstream: BreakerCurveSettings,
  downstream: BreakerCurveSettings,
  availableFaultCurrentAmps: number,
  manufacturerPair: { upstreamMfg: string; downstreamMfg: string }
): CoordinationResult {
  assertPositive('upstream inRating', upstream.inRating);
  assertPositive('upstream ir', upstream.ir);
  assertPositive('downstream inRating', downstream.inRating);
  assertPositive('downstream ir', downstream.ir);
  assertNonNegative('availableFaultCurrentAmps', availableFaultCurrentAmps);

  // 1. Overload Check: Upstream Ir must be larger than downstream Ir
  if (upstream.ir <= downstream.ir) {
    return {
      status: "NONE",
      overlapDetails: "Upstream overload setting (Ir) is less than or equal to downstream (Ir).",
      cascadingSupported: false,
    };
  }

  // 2. Scan currents to find trip curve overlap
  const minCurrent = downstream.ir;
  const maxCurrent = Math.max(availableFaultCurrentAmps, upstream.inRating * 15);
  const steps = 200;
  const logStart = Math.log(minCurrent);
  const logEnd = Math.log(maxCurrent);
  const step = (logEnd - logStart) / steps;

  let firstOverlapCurrent: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const current = Math.exp(logStart + i * step);
    const t_up = getTripTimeForCurrent(upstream, current);
    const t_down = getTripTimeForCurrent(downstream, current);

    // If upstream trips faster than or equal to downstream at any load, we have selectivity overlap
    if (t_up <= t_down && t_down < 9000) {
      if (firstOverlapCurrent === null) {
        firstOverlapCurrent = current;
      }
    }
  }

  // 3. Determine Selectivity Status based on overlap current relative to fault current
  let status: SelectivityStatus = "FULL";
  let limitCurrent: number | undefined;
  let overlapDetails: string | undefined;

  if (firstOverlapCurrent !== null) {
    if (firstOverlapCurrent <= downstream.ir * 1.5) {
      status = "NONE";
      overlapDetails = `Overlap detected at low current (${Math.round(firstOverlapCurrent)}A). Overload settings are too close.`;
    } else if (firstOverlapCurrent < availableFaultCurrentAmps) {
      status = "PARTIAL";
      limitCurrent = Math.round(firstOverlapCurrent);
      overlapDetails = `Selective up to ${limitCurrent}A. Above this fault current, both breakers may trip.`;
    } else {
      // Overlap occurs above the maximum possible fault current, meaning it is practically fully selective
      status = "FULL";
      limitCurrent = Math.round(firstOverlapCurrent);
    }
  }

  // 4. Cascading (Backup Protection) lookup rule
  // Emax/Masterpact -> MCCB -> MCB support cascading within same manufacturer
  let cascadingSupported = false;
  let cascadingIcu: number | undefined;

  const { upstreamMfg, downstreamMfg } = manufacturerPair;
  if (upstreamMfg.toUpperCase() === downstreamMfg.toUpperCase()) {
    // Enable cascading for matching manufacturers (e.g. ABB -> ABB, Schneider -> Schneider)
    cascadingSupported = true;
    cascadingIcu = 36; // Default standard enhanced breaking capacity (kA)
  }

  return {
    status,
    limitCurrent,
    overlapDetails,
    cascadingSupported,
    cascadingIcu,
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

  // Ir must be >= loadCurrent and <= cableAmpacity
  // We recommend Ir closest to loadCurrent * 1.15, bounded by In and cableAmpacity
  const targetIr = Math.max(loadCurrent, Math.min(loadCurrent * 1.15, cableAmpacity));
  const ir = parseFloat(Math.min(breakerIn, targetIr).toFixed(1));
  const tr = 12; // default overload trip delay in seconds

  // Short-time pickup (Isd): typically 3x to 5x Ir for domestic, 5x to 10x for motor/transformers
  const isd = parseFloat((ir * 5).toFixed(1));
  const tsd = 0.1; // 100ms grading time delay

  // Instantaneous pickup (Ii): typically 10x In
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
