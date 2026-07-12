import { CABLE_CATALOG, TEMP_DERATING, GROUP_DERATING, CableSpec } from "./cablesData";

export interface SizingResult {
  cableSize: number;
  breakerSize: number;
  nominalAmpacity: number;
  deratedAmpacity: number;
  tempFactor: number;
  groupFactor: number;
  neutralSize: number;
  earthSize: number;
}

// Standard breaker ratings (Amperes)
export const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];

/**
 * Sizes the breaker rating (In) and cable cross-section (S) based on design current (Ib).
 */
export function sizeCableAndBreaker(
  ib: number,
  isThreePhase: boolean,
  options: {
    material: "copper" | "aluminum";
    insulation: "PVC" | "XLPE";
    ambientTemp: number;
    groupingCount: number;
  }
): SizingResult {
  const { material, insulation, ambientTemp, groupingCount } = options;

  // 1. Select breaker size (In >= Ib)
  const breakerSize = STANDARD_BREAKERS.find((rating) => rating >= ib) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];

  // 2. Calculate derating factors
  const tempFactor = (TEMP_DERATING[insulation] && TEMP_DERATING[insulation][ambientTemp]) ?? 1.0;
  const groupFactor = GROUP_DERATING[groupingCount] ?? 0.5;
  const totalDerating = tempFactor * groupFactor;

  // 3. Find smallest cable size that complies with Iz >= In (where Iz = TableAmpacity * totalDerating)
  let selectedCable: CableSpec = CABLE_CATALOG[CABLE_CATALOG.length - 1];
  let nominalAmpacity = 0;
  let deratedAmpacity = 0;

  for (const cable of CABLE_CATALOG) {
    let ampacity = 0;
    if (material === "copper") {
      if (isThreePhase) {
        ampacity = insulation === "PVC" ? cable.copperPvc3Ph : cable.copperXlpe3Ph;
      } else {
        ampacity = insulation === "PVC" ? cable.copperPvc1Ph : cable.copperXlpe1Ph;
      }
    } else {
      // Aluminum (mostly XLPE 3-Phase in library)
      ampacity = cable.alXlpe3Ph;
    }

    const testIz = ampacity * totalDerating;
    if (testIz >= breakerSize) {
      selectedCable = cable;
      nominalAmpacity = ampacity;
      deratedAmpacity = testIz;
      break;
    }
  }

  // If even the largest cable is too small, default to largest
  if (deratedAmpacity === 0) {
    selectedCable = CABLE_CATALOG[CABLE_CATALOG.length - 1];
    nominalAmpacity = material === "copper" 
      ? (isThreePhase 
          ? (insulation === "PVC" ? selectedCable.copperPvc3Ph : selectedCable.copperXlpe3Ph) 
          : (insulation === "PVC" ? selectedCable.copperPvc1Ph : selectedCable.copperXlpe1Ph))
      : selectedCable.alXlpe3Ph;
    deratedAmpacity = nominalAmpacity * totalDerating;
  }

  // 4. Conductor sizing for Neutral and Earth (PE) according to IEC 60364-5-54
  const phaseSize = selectedCable.size;
  let neutralSize = phaseSize;
  
  // Neutral can be reduced to 50% for copper phase cables > 16 mm² if load is balanced
  if (phaseSize > 16 && isThreePhase) {
    neutralSize = Math.max(16, Math.round(phaseSize / 2));
    // Find closest standard size in catalog
    const closestSpec = CABLE_CATALOG.find((c) => c.size >= neutralSize);
    neutralSize = closestSpec ? closestSpec.size : phaseSize;
  }

  let earthSize = phaseSize;
  if (phaseSize <= 16) {
    earthSize = phaseSize;
  } else if (phaseSize <= 35) {
    earthSize = 16;
  } else {
    earthSize = Math.round(phaseSize / 2);
    const closestSpec = CABLE_CATALOG.find((c) => c.size >= earthSize);
    earthSize = closestSpec ? closestSpec.size : 16;
  }

  return {
    cableSize: phaseSize,
    breakerSize,
    nominalAmpacity,
    deratedAmpacity,
    tempFactor,
    groupFactor,
    neutralSize,
    earthSize,
  };
}

/**
 * Calculates voltage drop (V) and percentage drop (%) over a cable run.
 */
export function calculateVoltageDrop(
  current: number,
  lengthMeters: number,
  cableSizeSqMm: number,
  powerFactor: number,
  isThreePhase: boolean,
  systemVoltage: number // e.g. 400 for 3-phase, 230 for 1-phase
): { dropVolts: number; dropPercent: number } {
  // Find cable spec
  const spec = CABLE_CATALOG.find((c) => c.size === cableSizeSqMm) || CABLE_CATALOG[0];
  const R = spec.resistance;
  const X = spec.reactance;

  // cos(phi) and sin(phi)
  const cosPhi = Math.max(0, Math.min(1, powerFactor));
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);

  // Impedance component
  const impedance = R * cosPhi + X * sinPhi; // ohms/km

  let dropVolts = 0;
  if (isThreePhase) {
    // Vd = sqrt(3) * I * L * (R cos(phi) + X sin(phi))
    dropVolts = Math.sqrt(3) * current * (lengthMeters / 1000) * impedance;
  } else {
    // Vd = 2 * I * L * (R cos(phi) + X sin(phi))
    dropVolts = 2 * current * (lengthMeters / 1000) * impedance;
  }

  const dropPercent = (dropVolts / systemVoltage) * 100;

  return {
    dropVolts: parseFloat(dropVolts.toFixed(2)),
    dropPercent: parseFloat(dropPercent.toFixed(2)),
  };
}
