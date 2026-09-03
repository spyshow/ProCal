/**
 * Short-circuit current (Isc) calculations based on transformer impedance method.
 * 
 * References:
 * - IEC 60909 (Short-circuit currents in three-phase AC systems)
 * - IEC 60076 (Power transformers)
 */

import { assertPositive, assertNonNegative } from "./validate";

export type EarthingSystem = 'TN-S' | 'TN-C' | 'TN-C-S' | 'TT' | 'IT';

/**
 * Typical X/R ratio of an LV distribution transformer (~6); HV sources are
 * more reactive (~10). Single source of truth for splitting a source
 * impedance magnitude into its resistive and reactive parts.
 */
export function sourceXrRatio(voltageSecondary: number): number {
  return voltageSecondary <= 1000 ? 6 : 10;
}

/** Split an impedance magnitude Z into R + jX at the given X/R ratio. */
export function splitSourceImpedance(
  zOhms: number,
  xrRatio: number
): { r: number; x: number } {
  const norm = Math.sqrt(1 + xrRatio * xrRatio);
  return { r: zOhms / norm, x: (zOhms * xrRatio) / norm };
}

export type TransformerVectorGroup = 'Dyn11' | 'Dyn5' | 'Yyn0' | 'YNd11';

export interface TransformerParameters {
  ratedPower: number;     // kVA
  voltagePrimary: number; // V (Line-to-Line)
  voltageSecondary: number; // V (Line-to-Line)
  impedancePercent: number; // % (typical: 4-6% for distribution transformers)
  earthingSystem?: string; // e.g. 'TN-S' | 'TN-C' | 'TN-C-S' | 'TT' | 'IT' (default: 'TN-S')
  earthFaultImpedanceOhms?: number; // Earth-fault loop impedance in Ohms (for TT system, default: 0.5)
  vectorGroup?: TransformerVectorGroup; // default 'Dyn11'
  zeroSequenceRatio?: number; // Z(0)/Z(1) ratio, default 1.0 for Dyn, 5.0 for Yyn
}

export interface ShortCircuitResult {
  threePhaseIsc: number;  // kA - Three-phase short circuit current
  twoPhaseIsc: number;    // kA - Phase-to-phase short circuit current
  phaseToNeutralIsc: number; // kA - Phase-to-neutral short circuit current
  phaseToEarthIsc?: number;  // kA - Phase-to-earth fault current (limited by earth loop in TT)
  vectorGroup?: TransformerVectorGroup; // Transformer vector group used
  zeroSequenceRatio?: number; // Z(0)/Z(1) ratio used
  peakCurrent: number;    // kA - Peak short circuit current (for mechanical stress)
  transformerZ: number;   // Ohms - Transformer impedance
  sourceZ: number;        // Ohms - Total source impedance
  faultMVA: number;       // MVA - Fault level at transformer secondary
  earthingSystem: string; // Earthing system used (e.g. 'TN-S', 'TN-C', 'TT', 'IT')
  itFirstFault: boolean;  // true if IT system 1st fault (negligible current)
  earthFaultImpedanceOhms?: number; // Earth-fault loop impedance in Ohms (if applicable)
}

/**
 * Standard transformer impedance percentages by rating.
 * Typical values for distribution transformers (ANSI/IEEE C57.12).
 */
export const TRANSFORMER_IMPEDANCE: Record<number, number> = {
  100: 4.0,
  160: 4.0,
  250: 4.5,
  400: 4.5,
  500: 5.0,
  630: 5.0,
  800: 5.5,
  1000: 5.5,
  1250: 6.0,
  1600: 6.0,
  2000: 6.5,
  2500: 6.5,
  3150: 7.0,
  4000: 7.0,
  5000: 7.5,
};

/**
 * Calculates transformer impedance in ohms.
 */
export function calculateTransformerImpedance(
  ratedPowerKva: number,
  voltageSecondary: number,
  impedancePercent: number
): number {
  assertPositive('ratedPowerKva', ratedPowerKva);
  assertPositive('voltageSecondary', voltageSecondary);
  assertPositive('impedancePercent', impedancePercent);

  const ratedPowerMva = ratedPowerKva / 1000;
  const baseImpedance = (voltageSecondary * voltageSecondary) / (ratedPowerMva * 1e6);
  return baseImpedance * (impedancePercent / 100);
}

/**
 * Calculates short-circuit currents at transformer secondary terminals.
 * 
 * Assumes:
 * - Infinite bus at primary (utility source impedance = 0)
 * - Transformer is the sole current-limiting impedance
 * - Cable impedance from transformer to fault point is negligible (worst case)
 * - Earth-fault current accounts for earthing system (TN-S/TN-C solid ground, TT loop impedance, IT isolated)
 * 
 * @param transformer - Transformer specifications and earthing configuration
 * @returns Short-circuit current calculations
 */
export function calculateShortCircuitCurrent(
  transformer: TransformerParameters
): ShortCircuitResult {
  assertPositive('ratedPower', transformer.ratedPower);
  assertPositive('voltagePrimary', transformer.voltagePrimary);
  assertPositive('voltageSecondary', transformer.voltageSecondary);
  assertPositive('impedancePercent', transformer.impedancePercent);
  if (transformer.earthFaultImpedanceOhms !== undefined) {
    assertNonNegative('earthFaultImpedanceOhms', transformer.earthFaultImpedanceOhms);
  }

  const {
    ratedPower,
    voltageSecondary,
    impedancePercent,
  } = transformer;

  const earthingSystem = transformer.earthingSystem?.trim().toUpperCase() || 'TN-S';

  // Calculate transformer impedance in ohms
  const transformerZ = calculateTransformerImpedance(
    ratedPower,
    voltageSecondary,
    impedancePercent
  );

  // Source impedance (infinite bus = 0)
  const sourceZ = 0;

  // Total impedance to fault point
  const totalZ = transformerZ + sourceZ;

  // IEC 60909-0 voltage factor c_max: the utility may sit up to +6 % (LV) /
  // +10 % (other levels) above nominal when the fault occurs. Omitting c
  // understates Isc by that margin — the non-conservative direction for
  // breaker Icu verification.
  const voltageFactor = voltageSecondary <= 1000 ? 1.05 : 1.10;

  // Three-phase short-circuit current (kA)
  const threePhaseIsc = totalZ > 0
    ? (voltageFactor * voltageSecondary / (Math.sqrt(3) * totalZ)) / 1000
    : 0;

  // Phase-to-phase short-circuit current (typically 0.866 * three-phase)
  const twoPhaseIsc = threePhaseIsc * 0.866;

  // Peak short-circuit current (mechanical stress), IEC 60909:
  // ip = κ·√2·I″k with κ = 1.02 + 0.98·e^(−3R/X). The R/X split assumes the
  // same typical distribution-transformer X/R used in calculateIscWithCable
  // (≈6 LV, more reactive ≈10 HV). For X/R 6 this gives ip/I″k ≈ 2.28 — the
  // old flat 2.0 understated LV peak make-capacity requirements.
  const peakXRRatio = sourceXrRatio(voltageSecondary);
  const kappa = 1.02 + 0.98 * Math.exp(-3 / peakXRRatio);
  const peakCurrent = threePhaseIsc * kappa * Math.SQRT2;

  // Fault level in MVA
  const faultMVA = (Math.sqrt(3) * voltageSecondary * threePhaseIsc * 1000) / 1e6;

  // Line-to-Neutral voltage (V)
  const voltageLN = voltageSecondary / Math.sqrt(3);

  // Vector group and zero-sequence impedance ratio (IEC 60909-0 Clause 4.5.3 / IEC 60076-1):
  // Line-to-neutral short-circuit current ratio:
  // I_k1 / I_k3 = 3 / (2 + Z(0)/Z(1))
  // For Dyn transformers (delta primary), Z(0) ≈ 0.85..1.0 * Z(1). Default: 1.0 (I_k1 = I_k3).
  // For Yyn transformers (star-star without delta tertiary), Z(0) ≈ 3..10 * Z(1). Default: 5.0 (I_k1 ≈ 0.43 * I_k3).
  const vectorGroup = transformer.vectorGroup ?? 'Dyn11';
  const defaultZ0Ratio = vectorGroup === 'Yyn0' ? 5.0 : 1.0;
  const z0Ratio = transformer.zeroSequenceRatio ?? defaultZ0Ratio;
  const lnSequenceMultiplier = 3 / (2 + z0Ratio);

  let phaseToNeutralIsc: number;
  let phaseToEarthIsc: number | undefined;
  let itFirstFault = false;
  let earthFaultImpedanceOhms: number | undefined;

  if (earthingSystem === 'IT') {
    // For IT: phase-to-neutral and earth fault current is negligible on first fault (isolated/impedance ground)
    phaseToNeutralIsc = 0;
    phaseToEarthIsc = 0;
    itFirstFault = true;
  } else if (earthingSystem === 'TT') {
    // In TT systems (IEC 60364-4-41 Clause 411.5 / IEC 60909-0 Clause 4.5.3):
    // 1. Bolted Phase-to-Neutral (L-N) fault has a metallic neutral return path directly
    // to the transformer star point. The earth mass is NOT in the L-N path.
    // At transformer terminals, Z_LN is governed by the transformer winding sequence impedance.
    phaseToNeutralIsc = threePhaseIsc * lnSequenceMultiplier;
    itFirstFault = false;

    // 2. Phase-to-Earth (L-PE) fault current flows through the consumer's local earth electrode (RA)
    // and transformer station earth (RB): Z_loop = √((Rt + Re)² + Xt²).
    earthFaultImpedanceOhms = transformer.earthFaultImpedanceOhms ?? 0.5;
    const { r: rTrans, x: xTrans } = splitSourceImpedance(transformerZ, sourceXrRatio(voltageSecondary));
    const totalEarthLoopZ = Math.sqrt((rTrans + earthFaultImpedanceOhms) ** 2 + xTrans ** 2);
    phaseToEarthIsc = totalEarthLoopZ > 0 ? (voltageFactor * voltageLN / totalEarthLoopZ) / 1000 : 0;
  } else {
    // TN-S, TN-C, TN-C-S (solidly grounded): metallic return for both L-N and L-PE
    phaseToNeutralIsc = threePhaseIsc * lnSequenceMultiplier;
    phaseToEarthIsc = threePhaseIsc * lnSequenceMultiplier;
    itFirstFault = false;
  }

  return {
    threePhaseIsc: parseFloat(threePhaseIsc.toFixed(2)),
    twoPhaseIsc: parseFloat(twoPhaseIsc.toFixed(2)),
    phaseToNeutralIsc: parseFloat(phaseToNeutralIsc.toFixed(2)),
    ...(phaseToEarthIsc !== undefined ? { phaseToEarthIsc: parseFloat(phaseToEarthIsc.toFixed(2)) } : {}),
    peakCurrent: parseFloat(peakCurrent.toFixed(2)),
    transformerZ: parseFloat(transformerZ.toFixed(4)),
    sourceZ: parseFloat(sourceZ.toFixed(4)),
    faultMVA: parseFloat(faultMVA.toFixed(2)),
    earthingSystem,
    itFirstFault,
    vectorGroup,
    zeroSequenceRatio: z0Ratio,
    ...(earthFaultImpedanceOhms !== undefined ? { earthFaultImpedanceOhms } : {}),
  };
}

/**
 * Calculates short-circuit current with cable impedance considered.
 *
 * @param transformerIsc - Three-phase Isc at transformer terminals (kA)
 * @param cableLengthM - Cable length in meters
 * @param cableSizeMm2 - Cable cross-section in mm²
 * @param voltage - System voltage (Line-to-Line) in V
 * @param isCopper - true for copper, false for aluminum
 * @param isSinglePhase - true for a line-to-neutral fault: uses Uo = V/√3 and
 *   the loop impedance (source + go + return conductor, 2× cable impedance)
 * @param insulation - Cable insulation, selects the operating-temperature
 *   resistance factor: XLPE 90 °C → ×1.28, PVC 70 °C → ×1.20
 * @param parallelRuns - Number of parallel cable runs (default 1). Parallel
 *   conductors halve the loop impedance, so the fault current at the far end
 *   is HIGHER than a single run of the same cross-section would suggest.
 * @returns Adjusted short-circuit current including cable impedance
 */
export function calculateIscWithCable(
  transformerIsc: number,
  cableLengthM: number,
  cableSizeMm2: number,
  voltage: number,
  isCopper: boolean = true,
  isSinglePhase: boolean = false,
  insulation: 'PVC' | 'XLPE' = 'XLPE',
  parallelRuns: number = 1,
  neutralSizeMm2?: number
): number {
  assertPositive('transformerIsc', transformerIsc);
  assertNonNegative('cableLengthM', cableLengthM);
  assertNonNegative('cableSizeMm2', cableSizeMm2);
  assertPositive('voltage', voltage);
  assertPositive('parallelRuns', parallelRuns);

  const runs = Math.max(1, parallelRuns);

  // At the terminals an L-N fault equals the 3-phase value (Z1 = Z2 = Z0),
  // so both fault types collapse to transformerIsc when there is no cable.
  if (cableLengthM === 0 || cableSizeMm2 === 0) {
    return transformerIsc;
  }

  // Voltage factor c_max (IEC 60909-0 Clause 4.3 Table 1: c_max = 1.05 for LV <= 1000V)
  const voltageFactor = voltage <= 1000 ? 1.05 : 1.10;

  // Cable resistance at 20°C (Ohms/mm²·m) per IEC 60909-0 Clause 5.3.3.2:
  // For maximum short-circuit current (Ik"max) used for equipment breaking capacity (Icu),
  // conductor resistances must be calculated at 20 °C (tempFactor = 1.00).
  const R20 = isCopper ? 0.0172 : 0.0283;

  // Cable resistance (per run at 20°C)
  const Rcable = (R20 * cableLengthM) / cableSizeMm2;

  // Cable reactance (typical value: 0.08 mΩ/m for LV cables)
  const Xcable = 0.00008 * cableLengthM;

  // Parallel runs divide both components (impedances in parallel combine as
  // Z / n — for a 2 × 240 mm² riser the loop impedance is half of a single
  // 240 mm² run).
  // For single-phase (L-N) loops, conductor impedance includes the phase conductor plus the neutral return.
  // When a reduced neutral conductor is used (e.g. S_N = S_ph / 2 per IEC 60364-5-52 §524),
  // R_neutral = R_ph * (S_ph / S_N), giving loop resistance R_loop = R_ph * (1 + S_ph / S_N).
  // For equal cross-sections (S_N = S_ph), the loop factor is 1 + 1 = 2.
  const neutralSize = neutralSizeMm2 && neutralSizeMm2 > 0 ? neutralSizeMm2 : cableSizeMm2;
  const loopFactorR = isSinglePhase ? 1 + (cableSizeMm2 / neutralSize) : 1;
  const loopFactorX = isSinglePhase ? 2 : 1;
  const RcTotal = ((Rcable / runs) * loopFactorR);
  const XcTotal = ((Xcable / runs) * loopFactorX);

  // Transformer per-phase impedance magnitude, derived consistently from terminal Isc using c_max:
  // Since transformerIsc was calculated as (c * voltage) / (√3 * Zt * 1000),
  // Ztransformer = (c * voltage) / (√3 * transformerIsc * 1000).
  const Ztransformer = (voltageFactor * voltage) / (Math.sqrt(3) * transformerIsc * 1000);

  // IEC 60909 adds impedances COMPONENT-WISE: Z_total = √((Rt+Rc)² + (Xt+Xc)²).
  const { r: Rtransformer, x: Xtransformer } = splitSourceImpedance(
    Ztransformer,
    sourceXrRatio(voltage)
  );

  const Rtotal = Rtransformer + RcTotal;
  const Xtotal = Xtransformer + XcTotal;
  const Ztotal = Math.sqrt(Rtotal * Rtotal + Xtotal * Xtotal);

  const adjustedIsc = isSinglePhase
    ? // L-N fault: c_max * phase voltage over loop impedance
      ((voltageFactor * (voltage / Math.sqrt(3))) / Ztotal) / 1000
    : // 3-phase fault: c_max * line-to-line voltage over √3 · Ztotal
      ((voltageFactor * (voltage / (Math.sqrt(3) * Ztotal)))) / 1000;

  return parseFloat(adjustedIsc.toFixed(2));
}

/**
 * Gets typical impedance percentage for a given transformer rating.
 * 
 * @param ratedPowerKva - Transformer rated power in kVA
 * @returns Impedance percentage (default 5% if rating not found)
 */
export function getTypicalImpedance(ratedPowerKva: number): number {
  assertPositive('ratedPowerKva', ratedPowerKva);

  // Nearest standard rating; ties resolve to the lower rating. Between-rating
  // values round DOWN on purpose: the old round-up picked the next-higher
  // rating's %Z, which for the actual (smaller) transformer understated the
  // fault current — the non-conservative direction for Icu/breaker checks.
  const ratings = Object.keys(TRANSFORMER_IMPEDANCE).map(Number).sort((a, b) => a - b);

  let best = ratings[0];
  let bestDiff = Math.abs(best - ratedPowerKva);
  for (const rating of ratings) {
    const diff = Math.abs(rating - ratedPowerKva);
    if (diff < bestDiff || (diff === bestDiff && rating < best)) {
      best = rating;
      bestDiff = diff;
    }
  }
  return TRANSFORMER_IMPEDANCE[best];
}
