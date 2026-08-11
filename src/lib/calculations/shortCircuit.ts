/**
 * Short-circuit current (Isc) calculations based on transformer impedance method.
 * 
 * References:
 * - IEC 60909 (Short-circuit currents in three-phase AC systems)
 * - IEC 60076 (Power transformers)
 */

import { assertPositive, assertNonNegative } from "./validate";

export interface TransformerParameters {
  ratedPower: number;     // kVA
  voltagePrimary: number; // V (Line-to-Line)
  voltageSecondary: number; // V (Line-to-Line)
  impedancePercent: number; // % (typical: 4-6% for distribution transformers)
}

export interface ShortCircuitResult {
  threePhaseIsc: number;  // kA - Three-phase short circuit current
  twoPhaseIsc: number;    // kA - Phase-to-phase short circuit current
  phaseToNeutralIsc: number; // kA - Phase-to-neutral short circuit current
  peakCurrent: number;    // kA - Peak short circuit current (for mechanical stress)
  transformerZ: number;   // Ohms - Transformer impedance
  sourceZ: number;        // Ohms - Total source impedance
  faultMVA: number;       // MVA - Fault level at transformer secondary
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
 * 
 * @param transformer - Transformer specifications
 * @returns Short-circuit current calculations
 */
export function calculateShortCircuitCurrent(
  transformer: TransformerParameters
): ShortCircuitResult {
  assertPositive('ratedPower', transformer.ratedPower);
  assertPositive('voltagePrimary', transformer.voltagePrimary);
  assertPositive('voltageSecondary', transformer.voltageSecondary);
  assertPositive('impedancePercent', transformer.impedancePercent);

  const {
    ratedPower,
    voltageSecondary,
    impedancePercent,
  } = transformer;

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

  // Phase-to-neutral short-circuit current (for grounded systems)
  const phaseToNeutralIsc = threePhaseIsc * 1.0; // Equal to three-phase for solidly grounded

  // Peak short-circuit current (for mechanical stress calculations)
  // Typical factor: 2.5 * RMS for HV, 2.0 * RMS for LV
  const peakFactor = voltageSecondary <= 1000 ? 2.0 : 2.5;
  const peakCurrent = threePhaseIsc * peakFactor;

  // Fault level in MVA
  const faultMVA = (Math.sqrt(3) * voltageSecondary * threePhaseIsc * 1000) / 1e6;

  return {
    threePhaseIsc: parseFloat(threePhaseIsc.toFixed(2)),
    twoPhaseIsc: parseFloat(twoPhaseIsc.toFixed(2)),
    phaseToNeutralIsc: parseFloat(phaseToNeutralIsc.toFixed(2)),
    peakCurrent: parseFloat(peakCurrent.toFixed(2)),
    transformerZ: parseFloat(transformerZ.toFixed(4)),
    sourceZ: parseFloat(sourceZ.toFixed(4)),
    faultMVA: parseFloat(faultMVA.toFixed(2)),
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
 * @returns Adjusted short-circuit current including cable impedance
 */
export function calculateIscWithCable(
  transformerIsc: number,
  cableLengthM: number,
  cableSizeMm2: number,
  voltage: number,
  isCopper: boolean = true
): number {
  assertPositive('transformerIsc', transformerIsc);
  assertNonNegative('cableLengthM', cableLengthM);
  assertNonNegative('cableSizeMm2', cableSizeMm2);
  assertPositive('voltage', voltage);

  if (cableLengthM === 0 || cableSizeMm2 === 0) {
    return transformerIsc;
  }

  // Cable resistance at 20°C (Ohms/mm²·m)
  const R20 = isCopper ? 0.0172 : 0.0283;

  // Temperature correction factor (assuming 90°C operating temperature)
  const tempFactor = isCopper ? 1.28 : 1.28;

  // Cable resistance
  const Rcable = (R20 * tempFactor * cableLengthM) / cableSizeMm2;

  // Cable reactance (typical value: 0.08 mΩ/m for LV cables)
  const Xcable = 0.00008 * cableLengthM;

  // Total cable impedance
  const Zcable = Math.sqrt(Rcable * Rcable + Xcable * Xcable);

  // Transformer impedance
  const Ztransformer = (voltage / (Math.sqrt(3) * transformerIsc * 1000));

  // Total impedance
  const Ztotal = Ztransformer + Zcable;

  // Adjusted short-circuit current
  const adjustedIsc = Ztotal > 0
    ? (voltage / (Math.sqrt(3) * Ztotal)) / 1000
    : 0;

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

  // Find closest rating
  const ratings = Object.keys(TRANSFORMER_IMPEDANCE).map(Number).sort((a, b) => a - b);
  
  for (const rating of ratings) {
    if (rating >= ratedPowerKva) {
      return TRANSFORMER_IMPEDANCE[rating];
    }
  }
  
  // Default for larger transformers
  return 7.5;
}
