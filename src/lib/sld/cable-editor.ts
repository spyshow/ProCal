import { calculateVoltageDrop, parseCableSize, formatCableSize } from '@/lib/calculations/cables';
import { CABLE_CATALOG, temperatureDeratingFactor, groupingDeratingFactor, CableSpec } from '@/lib/calculations/cablesData';
import { getAmpacity } from '@/lib/calculations/installationMethods';

export interface CableEditorInput {
  current: number;
  isThreePhase: boolean;
  lengthMeters: number;
  existingCableSize: number | string;
  existingRuns?: number;
  powerFactor: number;
  systemVoltage: number;
  maxVoltageDropPercent: number;
  method?: string;
  insulation?: 'PVC' | 'XLPE';
  material?: 'copper' | 'aluminum';
  ambientTemp?: number;
  groupingCount?: number;
  maxCableSize?: number;
  targetRuns?: number;
}

export interface CableEditorResult {
  cableSize: number;
  parallelRuns: number;
  formattedCableSize: string;
  breakerSize: number;
  voltageDropPercent: number;
  voltageDropVolts: number;
  changed: boolean;
  ampacity: number;
  singleAmpacity: number;
  isOverloaded: boolean;
}

// Standard breaker ratings (Amperes)
const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];

function findBreakerSize(current: number): number {
  return STANDARD_BREAKERS.find(r => r >= current) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];
}

export function recalculateCable(input: CableEditorInput): CableEditorResult {
  const {
    current,
    isThreePhase,
    lengthMeters,
    existingCableSize,
    powerFactor,
    systemVoltage,
    maxVoltageDropPercent,
    method = 'C',
    insulation = 'XLPE',
    material = 'copper',
    ambientTemp = 30,
    groupingCount = 1,
    maxCableSize = 300,
    targetRuns,
  } = input;

  const existingParsed = parseCableSize(existingCableSize) ?? {
    size: typeof existingCableSize === 'number' ? existingCableSize : 16,
    runs: input.existingRuns ?? 1,
    formatted: typeof existingCableSize === 'number' ? `${existingCableSize} mm²` : String(existingCableSize),
  };

  const currentRuns = targetRuns ?? input.existingRuns ?? existingParsed.runs ?? 1;
  const breakerSize = findBreakerSize(current);
  const tempFactor = temperatureDeratingFactor(insulation, ambientTemp);
  const groupFactor = groupingDeratingFactor(groupingCount);
  const totalDerating = tempFactor * groupFactor;

  // 1. Calculate continuous carrying capacity & VD of the current installed cable
  const installedBaseAmpacity = getAmpacity(existingParsed.size, method, insulation, isThreePhase, material);
  const installedSingleAmpacity = installedBaseAmpacity * totalDerating;
  const installedTotalAmpacity = installedSingleAmpacity * currentRuns;
  const installedVD = calculateVoltageDrop(current, lengthMeters, existingParsed.size, powerFactor, isThreePhase, systemVoltage, currentRuns, material);

  const availableCatalog = CABLE_CATALOG.filter((c) => c.size <= maxCableSize);
  const catalogToUse = availableCatalog.length > 0 ? availableCatalog : CABLE_CATALOG;

  // Check if current installed cable is already compliant (Iz >= current and VD <= limit)
  const isInstalledCompliant =
    installedTotalAmpacity >= current &&
    installedVD.dropPercent <= maxVoltageDropPercent;

  let optimalCable: CableSpec = CABLE_CATALOG.find((c) => c.size === existingParsed.size) ?? catalogToUse[catalogToUse.length - 1];
  let optimalRuns = currentRuns;
  let optimalVD = installedVD;
  let optimalSingleAmpacity = installedSingleAmpacity;
  let optimalTotalAmpacity = installedTotalAmpacity;
  let needsChange = false;

  if (targetRuns && targetRuns !== existingParsed.runs) {
    // User explicitly requested a specific run count
    optimalRuns = targetRuns;
    let foundTarget = false;
    for (const cable of catalogToUse) {
      const vd = calculateVoltageDrop(current, lengthMeters, cable.size, powerFactor, isThreePhase, systemVoltage, optimalRuns, material);
      const baseAmpacity = getAmpacity(cable.size, method, insulation, isThreePhase, material);
      const singleDerated = baseAmpacity * totalDerating;
      const totalDerated = singleDerated * optimalRuns;

      if (vd.dropPercent <= maxVoltageDropPercent && totalDerated >= current) {
        optimalCable = cable;
        optimalVD = vd;
        optimalSingleAmpacity = singleDerated;
        optimalTotalAmpacity = totalDerated;
        foundTarget = true;
        break;
      }
    }
    if (!foundTarget) {
      // Pick largest in catalog with targetRuns
      const largest = catalogToUse[catalogToUse.length - 1];
      const baseAmpacity = getAmpacity(largest.size, method, insulation, isThreePhase, material);
      const singleDerated = baseAmpacity * totalDerating;
      optimalCable = largest;
      optimalVD = calculateVoltageDrop(current, lengthMeters, largest.size, powerFactor, isThreePhase, systemVoltage, optimalRuns, material);
      optimalSingleAmpacity = singleDerated;
      optimalTotalAmpacity = singleDerated * optimalRuns;
    }
    needsChange = optimalCable.size !== existingParsed.size || optimalRuns !== existingParsed.runs;
  } else if (!isInstalledCompliant) {
    // Current cable is under-sized or exceeds VD limit: find minimum upsize
    needsChange = true;
    let found = false;

    // Pass 1: Try single conductor (runs = 1) up to maxCableSize
    for (const cable of catalogToUse) {
      const vd = calculateVoltageDrop(current, lengthMeters, cable.size, powerFactor, isThreePhase, systemVoltage, 1, material);
      const baseAmpacity = getAmpacity(cable.size, method, insulation, isThreePhase, material);
      const singleDerated = baseAmpacity * totalDerating;

      if (vd.dropPercent <= maxVoltageDropPercent && singleDerated >= current) {
        optimalCable = cable;
        optimalRuns = 1;
        optimalVD = vd;
        optimalSingleAmpacity = singleDerated;
        optimalTotalAmpacity = singleDerated;
        found = true;
        break;
      }
    }

    // Pass 2: If single conductor cannot carry current, test parallel runs (N = 2, 3, 4, 5, 6)
    // Minimum runs prioritized first (e.g. prefer 2 runs over 3 runs)
    if (!found) {
      for (let runs = 2; runs <= 6; runs++) {
        for (const cable of catalogToUse) {
          const vd = calculateVoltageDrop(current, lengthMeters, cable.size, powerFactor, isThreePhase, systemVoltage, runs, material);
          const baseAmpacity = getAmpacity(cable.size, method, insulation, isThreePhase, material);
          const singleDerated = baseAmpacity * totalDerating;
          const totalDerated = singleDerated * runs;

          if (vd.dropPercent <= maxVoltageDropPercent && totalDerated >= current) {
            optimalCable = cable;
            optimalRuns = runs;
            optimalVD = vd;
            optimalSingleAmpacity = singleDerated;
            optimalTotalAmpacity = totalDerated;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    // Fallback: If no candidate satisfies both VD & ampacity, pick largest available
    if (!found) {
      const largest = catalogToUse[catalogToUse.length - 1];
      const baseAmpacity = getAmpacity(largest.size, method, insulation, isThreePhase, material);
      const singleDerated = baseAmpacity * totalDerating;
      const requiredRuns = Math.max(1, Math.ceil(current / (singleDerated > 0 ? singleDerated : 1)));
      optimalRuns = requiredRuns;
      optimalCable = largest;
      optimalVD = calculateVoltageDrop(current, lengthMeters, largest.size, powerFactor, isThreePhase, systemVoltage, optimalRuns, material);
      optimalSingleAmpacity = singleDerated;
      optimalTotalAmpacity = singleDerated * optimalRuns;
    }
  }

  const roundedAmpacity = Math.round(optimalTotalAmpacity * 10) / 10;
  const isOverloaded = roundedAmpacity < current;

  return {
    cableSize: optimalCable.size,
    parallelRuns: optimalRuns,
    formattedCableSize: formatCableSize(optimalCable.size, optimalRuns),
    breakerSize,
    voltageDropPercent: optimalVD.dropPercent,
    voltageDropVolts: optimalVD.dropVolts,
    changed: needsChange,
    ampacity: roundedAmpacity,
    singleAmpacity: Math.round(optimalSingleAmpacity * 10) / 10,
    isOverloaded,
  };
}
