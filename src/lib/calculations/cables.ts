import { CABLE_CATALOG, TEMP_DERATING, GROUP_DERATING, CableSpec } from "./cablesData";
import { METHOD_AMPACITY_FACTORS } from "./installationMethods";
import { assertNonNegative, assertPositive, assertInRange, assertOneOf, clampPowerFactor } from "./validate";

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
    neutralCurrent?: number;
    installMethod?: string;
  }
): SizingResult {
  assertNonNegative('designCurrent', ib);
  assertOneOf('material', options.material, ['copper', 'aluminum'] as const);
  assertOneOf('insulation', options.insulation, ['PVC', 'XLPE'] as const);
  assertInRange('ambientTemp', options.ambientTemp, 10, 60);
  assertPositive('groupingCount', options.groupingCount);
  if (options.neutralCurrent != null) {
    assertNonNegative('neutralCurrent', options.neutralCurrent);
  }

  const { material, insulation, ambientTemp, groupingCount, neutralCurrent, installMethod } = options;

  // 1. Select breaker size (In >= Ib)
  const breakerSize = STANDARD_BREAKERS.find((rating) => rating >= ib) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];

  // 2. Calculate derating factors
  const tempFactor = (TEMP_DERATING[insulation] && TEMP_DERATING[insulation][ambientTemp]) ?? 1.0;
  const groupFactor = GROUP_DERATING[groupingCount] ?? 0.5;
  const installFactor = (installMethod ? METHOD_AMPACITY_FACTORS[installMethod] : undefined) ?? 1.0;
  const totalDerating = tempFactor * groupFactor * installFactor;

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

  // Neutral can be reduced to 50% for copper phase cables > 16 mm² if load is balanced.
  // If neutralCurrent is provided and exceeds the reduced neutral's ampacity, upsize to phase size.
  if (phaseSize > 16 && isThreePhase) {
    const reducedNeutral = Math.max(16, Math.round(phaseSize / 2));
    const closestSpec = CABLE_CATALOG.find((c) => c.size >= reducedNeutral);
    const reducedSize = closestSpec ? closestSpec.size : phaseSize;

    if (neutralCurrent != null) {
      // Check if actual neutral current exceeds the reduced neutral's ampacity
      const reducedAmpacity = CABLE_CATALOG.find((c) => c.size === reducedSize);
      const neutralAmpacity = reducedAmpacity
        ? (material === "copper"
            ? (insulation === "PVC" ? reducedAmpacity.copperPvc1Ph : reducedAmpacity.copperXlpe1Ph)
            : reducedAmpacity.alXlpe3Ph) * totalDerating
        : 0;

      if (neutralCurrent > neutralAmpacity) {
        // Neutral current exceeds reduced ampacity — use phase-size neutral
        neutralSize = phaseSize;
      } else {
        neutralSize = reducedSize;
      }
    } else {
      neutralSize = reducedSize;
    }
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
  assertNonNegative('current', current);
  assertPositive('lengthMeters', lengthMeters);
  assertPositive('cableSizeSqMm', cableSizeSqMm);
  assertPositive('systemVoltage', systemVoltage);

  // Find cable spec
  const spec = CABLE_CATALOG.find((c) => c.size === cableSizeSqMm) || CABLE_CATALOG[0];
  const R = spec.resistance;
  const X = spec.reactance;

  // cos(phi) and sin(phi)
  const cosPhi = clampPowerFactor(powerFactor);
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

/**
 * Parse a cable-size string or number ("120 mm²", "16", 16) into a numeric mm².
 * Returns null if unparseable or non-positive.
 */
export function parseMm2(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const m = String(value).match(/(\d+(?:\.\d+)?)/);
  const n = m ? parseFloat(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Single source of truth for an apartment/floor-item cable length in meters.
 * Falls back to 10m + (floorNumber - 1) * 5m when null/undefined.
 */
export function getItemCableLength(
  item: { cableLength?: number | null } | null | undefined,
  floorNumber: number = 1
): number {
  return item?.cableLength ?? (10 + Math.max(0, floorNumber - 1) * 5);
}

/**
 * Single source of truth for a building load cable length in meters.
 * Falls back to 10m when null/undefined.
 */
export function getBuildingLoadCableLength(
  load: { cableLength?: number | null } | null | undefined
): number {
  return load?.cableLength ?? 10;
}

/**
 * Single source of truth for a riser cable length in meters.
 * Falls back to 10m when null/undefined.
 */
export function getRiserCableLength(
  fd: { riserCableLength?: number | null } | null | undefined
): number {
  return fd?.riserCableLength ?? 10;
}

