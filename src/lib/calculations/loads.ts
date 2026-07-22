/**
 * Sizing calculations for connected loads, max demands, and phase currents.
 */

// IEC 60439 / standard diversity factors for residential apartments
export function getApartmentDiversityFactor(count: number): number {
  if (count <= 1) return 1.0;
  if (count <= 4) return 0.8;
  if (count <= 9) return 0.7;
  if (count <= 14) return 0.6;
  if (count <= 19) return 0.55;
  return 0.5; // 20 or more apartments
}

/**
 * Calculates current (Amperes) for a three-phase system.
 * Power in kVA or kW (if kW, it will divide by powerFactor to get kVA).
 */
export function calculateThreePhaseCurrent(
  powerKva: number,
  voltageLineToLine: number = 400
): number {
  if (powerKva <= 0) return 0;
  // I = S / (sqrt(3) * V_L-L)
  return parseFloat((powerKva / (Math.sqrt(3) * (voltageLineToLine / 1000))).toFixed(2));
}

/**
 * Calculates current (Amperes) for a single-phase system.
 */
export function calculateSinglePhaseCurrent(
  powerKva: number,
  voltageLineToNeutral: number = 230
): number {
  if (powerKva <= 0) return 0;
  // I = S / V_L-N
  return parseFloat((powerKva / (voltageLineToNeutral / 1000)).toFixed(2));
}

// Standard utility transformer ratings (kVA)
export const STANDARD_TRANSFORMERS = [100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150];

/**
 * Sizes the transformer to the next standard rating with an optional safety margin.
 * When perPhaseKva is provided, uses the max-loaded phase (transformer is limited
 * by its most-loaded winding under imbalance). Falls back to the lumped total.
 */
export function sizeTransformer(
  demandKva: number,
  safetyMargin: number = 1.2,
  perPhaseKva?: [number, number, number]
): number {
  const effectiveDemand = perPhaseKva
    ? Math.max(perPhaseKva[0], perPhaseKva[1], perPhaseKva[2])
    : demandKva;
  const targetKva = effectiveDemand * safetyMargin;
  const match = STANDARD_TRANSFORMERS.find((rating) => rating >= targetKva);
  return match || STANDARD_TRANSFORMERS[STANDARD_TRANSFORMERS.length - 1];
}

// Standard generator ratings (kVA)
export const STANDARD_GENERATORS = [50, 80, 100, 125, 150, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1500, 2000];

/**
 * Sizes the backup generator based on essential loads and the starting kVA of the largest motor.
 */
export function sizeGenerator(
  essentialDemandKva: number,
  largestMotorKva: number,
  startingFactor: number = 6.0, // typical starting current ratio
  safetyMargin: number = 1.1
): number {
  // Generator must handle continuous essential loads + starting surge of largest motor
  // S_gen >= (S_essential - S_largest_motor) + (S_largest_motor * startingFactor)
  const motorStartingKva = largestMotorKva * startingFactor;
  const peakKva = (essentialDemandKva - largestMotorKva) + motorStartingKva;
  const targetKva = peakKva * safetyMargin;
  
  const match = STANDARD_GENERATORS.find((rating) => rating >= targetKva);
  return match || STANDARD_GENERATORS[STANDARD_GENERATORS.length - 1];
}
