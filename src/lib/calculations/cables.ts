import { CABLE_CATALOG, TEMP_DERATING, GROUP_DERATING, CableSpec } from "./cablesData";
import { METHOD_AMPACITY_FACTORS } from "./installationMethods";
import { assertNonNegative, assertPositive, assertInRange, assertOneOf, clampPowerFactor } from "./validate";

export interface SizingResult {
  cableSize: number;
  parallelRuns: number;
  formattedCableSize: string;
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
 * Parses a cable-size string or number (e.g. "300 mm²", 16, "2 × 240 mm²", "2x300")
 * into its numeric size in mm² and parallel runs count.
 */
export function parseCableSize(value: string | number | null | undefined): { size: number; runs: number; formatted: string } | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return { size: value, runs: 1, formatted: `${value} mm²` };
  }
  const str = String(value).trim();
  if (!str || str.toLowerCase() === 'n/a') return null;

  // Match parallel notation e.g. "2 × 240 mm²", "2x240", "2 x 300 mm²", "3*(4x185)", "3 × 185"
  const parallelMatch = str.match(/^(\d+)\s*[*xX×]\s*(?:\(\s*\d+\s*[*xX×]\s*|\(\s*)?(\d+(?:\.\d+)?)/i);
  if (parallelMatch) {
    const runs = parseInt(parallelMatch[1], 10);
    const size = parseFloat(parallelMatch[2]);
    if (runs > 0 && size > 0) {
      return {
        size,
        runs,
        formatted: `${runs} × ${size} mm²`,
      };
    }
  }

  // Single cable: match last or only number before mm² or end
  const singleMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:mm[²2])?$/i) || str.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const size = parseFloat(singleMatch[1]);
    if (Number.isFinite(size) && size > 0) {
      return {
        size,
        runs: 1,
        formatted: `${size} mm²`,
      };
    }
  }
  return null;
}

export function formatCableSize(size: number, runs: number = 1): string {
  if (runs > 1) {
    return `${runs} × ${size} mm²`;
  }
  return `${size} mm²`;
}

/**
 * Sizes the breaker rating (In) and cable cross-section (S) based on design current (Ib).
 * Automatically calculates parallel runs when load exceeds single cable capacity or maxCableSize.
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
    maxCableSize?: number;
    targetRuns?: number;
    manualBreakerRating?: number;
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
  const maxCableSize = options.maxCableSize ?? 300;

  // 1. Select breaker size (In >= Ib)
  const breakerSize = options.manualBreakerRating ?? (STANDARD_BREAKERS.find((rating) => rating >= ib) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1]);

  // 2. Calculate derating factors
  const tempFactor = (TEMP_DERATING[insulation] && TEMP_DERATING[insulation][ambientTemp]) ?? 1.0;
  const groupFactor = GROUP_DERATING[groupingCount] ?? 0.5;
  const installFactor = (installMethod ? METHOD_AMPACITY_FACTORS[installMethod] : undefined) ?? 1.0;
  const totalDerating = tempFactor * groupFactor * installFactor;

  // Available catalog subset up to maxCableSize
  const availableCatalog = CABLE_CATALOG.filter((c) => c.size <= maxCableSize);
  const catalogToUse = availableCatalog.length > 0 ? availableCatalog : CABLE_CATALOG;

  const getCableNominalAmpacity = (cable: CableSpec): number => {
    if (material === "copper") {
      if (isThreePhase) {
        return insulation === "PVC" ? cable.copperPvc3Ph : cable.copperXlpe3Ph;
      } else {
        return insulation === "PVC" ? cable.copperPvc1Ph : cable.copperXlpe1Ph;
      }
    } else {
      return cable.alXlpe3Ph;
    }
  };

  let selectedCable: CableSpec = catalogToUse[catalogToUse.length - 1];
  let selectedRuns = 1;
  let nominalAmpacity = 0;
  let deratedAmpacity = 0;

  if (options.targetRuns && options.targetRuns > 1) {
    // User specified exact run count
    selectedRuns = options.targetRuns;
    for (const cable of catalogToUse) {
      const singleNominal = getCableNominalAmpacity(cable);
      const singleIz = singleNominal * totalDerating;
      const totalIz = selectedRuns * singleIz;
      if (totalIz >= breakerSize) {
        selectedCable = cable;
        nominalAmpacity = selectedRuns * singleNominal;
        deratedAmpacity = totalIz;
        break;
      }
    }
    if (deratedAmpacity === 0) {
      selectedCable = catalogToUse[catalogToUse.length - 1];
      const singleNominal = getCableNominalAmpacity(selectedCable);
      nominalAmpacity = selectedRuns * singleNominal;
      deratedAmpacity = selectedRuns * singleNominal * totalDerating;
    }
  } else {
    // Pass 1: Try single conductor (runs = 1) up to maxCableSize
    let foundSingle = false;
    for (const cable of catalogToUse) {
      const singleNominal = getCableNominalAmpacity(cable);
      const testIz = singleNominal * totalDerating;
      if (testIz >= breakerSize) {
        selectedCable = cable;
        selectedRuns = 1;
        nominalAmpacity = singleNominal;
        deratedAmpacity = testIz;
        foundSingle = true;
        break;
      }
    }

    // Pass 2: If single conductor is insufficient, find optimal parallel runs (N = 2, 3, 4, 5, 6)
    // Prioritizing minimum parallel runs first, then smallest cable size within that run count.
    if (!foundSingle) {
      let foundParallel = false;
      for (let runs = 2; runs <= 6; runs++) {
        for (const cable of catalogToUse) {
          const singleNominal = getCableNominalAmpacity(cable);
          const singleIz = singleNominal * totalDerating;
          const totalIz = runs * singleIz;
          if (totalIz >= breakerSize) {
            selectedCable = cable;
            selectedRuns = runs;
            nominalAmpacity = runs * singleNominal;
            deratedAmpacity = totalIz;
            foundParallel = true;
            break;
          }
        }
        if (foundParallel) break;
      }

      // Fallback: If even 6 runs is insufficient, use largest available with calculated runs
      if (!foundParallel) {
        const largest = catalogToUse[catalogToUse.length - 1];
        const largestNominal = getCableNominalAmpacity(largest);
        const largestIz = largestNominal * totalDerating;
        selectedRuns = Math.max(2, Math.ceil(breakerSize / (largestIz > 0 ? largestIz : 1)));
        selectedCable = largest;
        nominalAmpacity = selectedRuns * largestNominal;
        deratedAmpacity = selectedRuns * largestIz;
      }
    }
  }

  // 4. Conductor sizing for Neutral and Earth (PE) according to IEC 60364-5-54
  const phaseSize = selectedCable.size;
  let neutralSize = phaseSize;

  if (phaseSize > 16 && isThreePhase) {
    const reducedNeutral = Math.max(16, Math.round(phaseSize / 2));
    const closestSpec = CABLE_CATALOG.find((c) => c.size >= reducedNeutral);
    const reducedSize = closestSpec ? closestSpec.size : phaseSize;

    if (neutralCurrent != null) {
      const reducedAmpacity = CABLE_CATALOG.find((c) => c.size === reducedSize);
      const neutralAmpacity = (reducedAmpacity
        ? (material === "copper"
            ? (insulation === "PVC" ? reducedAmpacity.copperPvc1Ph : reducedAmpacity.copperXlpe1Ph)
            : reducedAmpacity.alXlpe3Ph) * totalDerating
        : 0) * selectedRuns;

      if (neutralCurrent > neutralAmpacity) {
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
    parallelRuns: selectedRuns,
    formattedCableSize: formatCableSize(phaseSize, selectedRuns),
    breakerSize,
    nominalAmpacity: Math.round(nominalAmpacity * 10) / 10,
    deratedAmpacity: Math.round(deratedAmpacity * 10) / 10,
    tempFactor,
    groupFactor,
    neutralSize,
    earthSize,
  };
}

/**
 * Calculates voltage drop (V) and percentage drop (%) over a cable run.
 * For parallel runs, effective impedance is Z / parallelRuns.
 */
export function calculateVoltageDrop(
  current: number,
  lengthMeters: number,
  cableSizeSqMm: number,
  powerFactor: number,
  isThreePhase: boolean,
  systemVoltage: number, // e.g. 400 for 3-phase, 230 for 1-phase
  parallelRuns: number = 1
): { dropVolts: number; dropPercent: number } {
  assertNonNegative('current', current);
  assertPositive('lengthMeters', lengthMeters);
  assertPositive('cableSizeSqMm', cableSizeSqMm);
  assertPositive('systemVoltage', systemVoltage);

  const runs = Math.max(1, parallelRuns);

  // Find cable spec
  const spec = CABLE_CATALOG.find((c) => c.size === cableSizeSqMm) || CABLE_CATALOG[0];
  const R = spec.resistance / runs;
  const X = spec.reactance / runs;

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
 * Parse a cable-size string or number ("120 mm²", "16", 16, "2 × 240 mm²") into a numeric mm².
 * Returns null if unparseable or non-positive.
 */
export function parseMm2(value: string | number | null | undefined): number | null {
  const parsed = parseCableSize(value);
  return parsed ? parsed.size : null;
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

export interface CableProtectionEvaluation {
  cableMm2: number;
  parallelRuns: number;
  formattedCableSize: string;
  breakerAmps: number;
  nominalAmpacity: number;
  deratedAmpacity: number;
  singleNominalAmpacity: number;
  singleDeratedAmpacity: number;
  isUnderProtected: boolean;
  recommendedCableSizeMm2: number;
  recommendedParallelRuns: number;
  recommendedCableSizeFormatted: string;
  reason?: string;
}

/**
 * Calculates continuous nominal and derated ampacity (Iz) for a given cable size or parallel cable string.
 */
export function calculateCableAmpacity(
  cableInput: number | string,
  isThreePhase: boolean,
  options: {
    material?: "copper" | "aluminum";
    insulation?: "PVC" | "XLPE";
    ambientTemp?: number;
    groupingCount?: number;
    installMethod?: string;
    parallelRuns?: number;
  } = {}
): {
  nominalAmpacity: number;
  deratedAmpacity: number;
  singleNominalAmpacity: number;
  singleDeratedAmpacity: number;
  parallelRuns: number;
  cableSize: number;
  formattedCableSize: string;
} {
  const material = options.material ?? "copper";
  const insulation = options.insulation ?? "XLPE";
  const ambientTemp = options.ambientTemp ?? 30;
  const groupingCount = options.groupingCount ?? 1;
  const installMethod = options.installMethod ?? "C";

  let cableSize = typeof cableInput === 'number' ? cableInput : 16;
  let runs = options.parallelRuns ?? 1;

  if (typeof cableInput === 'string') {
    const parsed = parseCableSize(cableInput);
    if (parsed) {
      cableSize = parsed.size;
      if (!options.parallelRuns) runs = parsed.runs;
    }
  }

  const spec = CABLE_CATALOG.find((c) => c.size >= cableSize) ?? CABLE_CATALOG[CABLE_CATALOG.length - 1];
  let singleNominal = 0;
  if (material === "copper") {
    if (isThreePhase) {
      singleNominal = insulation === "PVC" ? spec.copperPvc3Ph : spec.copperXlpe3Ph;
    } else {
      singleNominal = insulation === "PVC" ? spec.copperPvc1Ph : spec.copperXlpe1Ph;
    }
  } else {
    singleNominal = spec.alXlpe3Ph;
  }

  const tempFactor = (TEMP_DERATING[insulation] && TEMP_DERATING[insulation][ambientTemp]) ?? 1.0;
  const groupFactor = GROUP_DERATING[groupingCount] ?? 0.5;
  const installFactor = (installMethod ? METHOD_AMPACITY_FACTORS[installMethod] : undefined) ?? 1.0;
  const totalDerating = tempFactor * groupFactor * installFactor;

  const singleDerated = Math.round(singleNominal * totalDerating * 10) / 10;
  const nominalAmpacity = Math.round(singleNominal * runs * 10) / 10;
  const deratedAmpacity = Math.round(singleDerated * runs * 10) / 10;

  return {
    nominalAmpacity,
    deratedAmpacity,
    singleNominalAmpacity: singleNominal,
    singleDeratedAmpacity: singleDerated,
    parallelRuns: runs,
    cableSize,
    formattedCableSize: formatCableSize(cableSize, runs),
  };
}

/**
 * Evaluates whether a cable is safely protected by its upstream breaker (Iz >= In).
 */
export function evaluateCableProtection(
  cableInput: number | string,
  breakerAmps: number,
  isThreePhase: boolean,
  options: {
    material?: "copper" | "aluminum";
    insulation?: "PVC" | "XLPE";
    ambientTemp?: number;
    groupingCount?: number;
    installMethod?: string;
    parallelRuns?: number;
    maxCableSize?: number;
  } = {}
): CableProtectionEvaluation {
  const amp = calculateCableAmpacity(cableInput, isThreePhase, options);
  const isUnderProtected = amp.deratedAmpacity < breakerAmps;

  const requiredSizing = sizeCableAndBreaker(breakerAmps, isThreePhase, {
    material: options.material ?? "copper",
    insulation: options.insulation ?? "XLPE",
    ambientTemp: options.ambientTemp ?? 30,
    groupingCount: options.groupingCount ?? 1,
    installMethod: options.installMethod ?? "C",
    maxCableSize: options.maxCableSize ?? 300,
    manualBreakerRating: breakerAmps,
  });

  return {
    cableMm2: amp.cableSize,
    parallelRuns: amp.parallelRuns,
    formattedCableSize: amp.formattedCableSize,
    breakerAmps,
    nominalAmpacity: amp.nominalAmpacity,
    deratedAmpacity: amp.deratedAmpacity,
    singleNominalAmpacity: amp.singleNominalAmpacity,
    singleDeratedAmpacity: amp.singleDeratedAmpacity,
    isUnderProtected,
    recommendedCableSizeMm2: requiredSizing.cableSize,
    recommendedParallelRuns: requiredSizing.parallelRuns,
    recommendedCableSizeFormatted: requiredSizing.formattedCableSize,
    reason: isUnderProtected
      ? `Cable ampacity Iz (${amp.deratedAmpacity}A) is less than breaker rating In (${breakerAmps}A). Risk of cable thermal overload.`
      : undefined,
  };
}

