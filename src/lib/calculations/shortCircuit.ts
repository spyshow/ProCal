/**
 * Short-circuit current (Isc) calculations based on transformer impedance method.
 * 
 * References:
 * - IEC 60909 (Short-circuit currents in three-phase AC systems)
 * - IEC 60076 (Power transformers)
 */

import { assertPositive, assertNonNegative } from "./validate";

export type EarthingSystem = 'TN-S' | 'TN-C' | 'TN-C-S' | 'TT' | 'IT';

export interface TransformerParameters {
  ratedPower: number;     // kVA
  voltagePrimary: number; // V (Line-to-Line)
  voltageSecondary: number; // V (Line-to-Line)
  impedancePercent: number; // % (typical: 4-6% for distribution transformers)
  earthingSystem?: string; // e.g. 'TN-S' | 'TN-C' | 'TN-C-S' | 'TT' | 'IT' (default: 'TN-S')
  earthFaultImpedanceOhms?: number; // Earth-fault loop impedance in Ohms (for TT system, default: 0.5)
}

export interface ShortCircuitResult {
  threePhaseIsc: number;  // kA - Three-phase short circuit current
  twoPhaseIsc: number;    // kA - Phase-to-phase short circuit current
  phaseToNeutralIsc: number; // kA - Phase-to-neutral short circuit current
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

  // Three-phase short-circuit current (kA)
  const threePhaseIsc = totalZ > 0 
    ? (voltageSecondary / (Math.sqrt(3) * totalZ)) / 1000 
    : 0;

  // Phase-to-phase short-circuit current (typically 0.866 * three-phase)
  const twoPhaseIsc = threePhaseIsc * 0.866;

  // Peak short-circuit current (for mechanical stress calculations)
  // Typical factor: 2.5 * RMS for HV, 2.0 * RMS for LV
  const peakFactor = voltageSecondary <= 1000 ? 2.0 : 2.5;
  const peakCurrent = threePhaseIsc * peakFactor;

  // Fault level in MVA
  const faultMVA = (Math.sqrt(3) * voltageSecondary * threePhaseIsc * 1000) / 1e6;

  // Line-to-Neutral voltage (V)
  const voltageLN = voltageSecondary / Math.sqrt(3);

  let phaseToNeutralIsc: number;
  let itFirstFault = false;
  let earthFaultImpedanceOhms: number | undefined;

  if (earthingSystem === 'IT') {
    // For IT: phase-to-neutral fault current is negligible on first fault (isolated/impedance ground)
    phaseToNeutralIsc = 0;
    itFirstFault = true;
  } else if (earthingSystem === 'TT') {
    // For TT: earth-fault loop impedance (default 0.5 Ω) is in series with fault path
    earthFaultImpedanceOhms = transformer.earthFaultImpedanceOhms ?? 0.5;
    const totalFaultZ = transformerZ + earthFaultImpedanceOhms;
    phaseToNeutralIsc = totalFaultZ > 0 ? (voltageLN / totalFaultZ) / 1000 : 0;
    itFirstFault = false;
  } else {
    // TN-S, TN-C, TN-C-S (solidly grounded): phaseToNeutralIsc ≈ threePhaseIsc
    phaseToNeutralIsc = threePhaseIsc * 1.0;
    itFirstFault = false;
  }

  return {
    threePhaseIsc: parseFloat(threePhaseIsc.toFixed(2)),
    twoPhaseIsc: parseFloat(twoPhaseIsc.toFixed(2)),
    phaseToNeutralIsc: parseFloat(phaseToNeutralIsc.toFixed(2)),
    peakCurrent: parseFloat(peakCurrent.toFixed(2)),
    transformerZ: parseFloat(transformerZ.toFixed(4)),
    sourceZ: parseFloat(sourceZ.toFixed(4)),
    faultMVA: parseFloat(faultMVA.toFixed(2)),
    earthingSystem,
    itFirstFault,
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
 * @returns Adjusted short-circuit current including cable impedance
 */
export function calculateIscWithCable(
  transformerIsc: number,
  cableLengthM: number,
  cableSizeMm2: number,
  voltage: number,
  isCopper: boolean = true,
  isSinglePhase: boolean = false,
  insulation: 'PVC' | 'XLPE' = 'XLPE'
): number {
  assertPositive('transformerIsc', transformerIsc);
  assertNonNegative('cableLengthM', cableLengthM);
  assertNonNegative('cableSizeMm2', cableSizeMm2);
  assertPositive('voltage', voltage);

  // At the terminals an L-N fault equals the 3-phase value (Z1 = Z2 = Z0),
  // so both fault types collapse to transformerIsc when there is no cable.
  if (cableLengthM === 0 || cableSizeMm2 === 0) {
    return transformerIsc;
  }

  // Cable resistance at 20°C (Ohms/mm²·m)
  const R20 = isCopper ? 0.0172 : 0.0283;

  // Temperature correction factor: R(T) = R20 × (1 + α·(T − 20)), α ≈ 0.004 /K.
  // XLPE operates at 90 °C → 1.28; PVC at 70 °C → 1.20 (lower resistance,
  // so a PVC fault current is higher than the old fixed 90 °C factor implied).
  const tempFactor = insulation === 'PVC' ? 1.2 : 1.28;

  // Cable resistance
  const Rcable = (R20 * tempFactor * cableLengthM) / cableSizeMm2;

  // Cable reactance (typical value: 0.08 mΩ/m for LV cables)
  const Xcable = 0.00008 * cableLengthM;

  // Total cable impedance (one conductor)
  const Zcable = Math.sqrt(Rcable * Rcable + Xcable * Xcable);

  // Transformer per-phase impedance, derived from the 3-phase terminal Isc
  const Ztransformer = (voltage / (Math.sqrt(3) * transformerIsc * 1000));

  const adjustedIsc = isSinglePhase
    ? // L-N fault: phase voltage over the loop impedance — the fault current
      // flows out through the phase conductor and back through the neutral,
      // so the cable contributes twice (go + return).
      ((voltage / Math.sqrt(3)) / (Ztransformer + 2 * Zcable)) / 1000
    : // 3-phase fault: line-to-line voltage over √3 · (source + one phase conductor)
      ((voltage / (Math.sqrt(3) * (Ztransformer + Zcable)))) / 1000;

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
