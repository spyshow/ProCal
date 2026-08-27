import {
  calculateVoltageDrop,
  formatCableSize,
  parseCableSize,
  sizeCableAndBreaker,
} from '@/lib/calculations/cables';
import { nextBreakerRating, type CodeStandard } from '@/lib/calculations/codes';
import { groupingDeratingFactor, temperatureDeratingFactor } from '@/lib/calculations/cablesData';
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
  /** Breaker-rating catalog — defaults to IEC; NEC projects pass "NEC". */
  code?: CodeStandard;
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

function findBreakerSize(current: number, code: CodeStandard = 'IEC'): number {
  return nextBreakerRating(current, code);
}

/**
 * Re-evaluates an installed cable against load + ΔU limits. Compliance
 * decisions all route through the shared calc-engine primitives
 * (getAmpacity / calculateVoltageDrop / sizeCableAndBreaker) — this wrapper
 * only adds the "keep the installed cable if it already complies" fast path.
 */
export function recalculateCable(input: CableEditorInput): CableEditorResult {
  const {
    current,
    isThreePhase,
    lengthMeters,
    existingCableSize,
    powerFactor,
    systemVoltage,
    maxVoltageDropPercent,
    code = 'IEC',
    method = code === 'NEC' ? 'NEC-1' : 'C',
    insulation = 'XLPE',
    material = 'copper',
    ambientTemp = 30,
    groupingCount = 1,
    maxCableSize = 300,
    targetRuns,
  } = input;

  const calcStandard = code === 'NEC' ? 'NEMA' : 'IEC';
  const existingParsed = parseCableSize(existingCableSize) ?? {
    size: typeof existingCableSize === 'number' ? existingCableSize : 16,
    runs: input.existingRuns ?? 1,
    formatted: typeof existingCableSize === 'number' ? `${existingCableSize} mm²` : String(existingCableSize),
  };

  const currentRuns = targetRuns ?? input.existingRuns ?? existingParsed.runs ?? 1;
  const totalDerating =
    temperatureDeratingFactor(insulation, ambientTemp, calcStandard) * groupingDeratingFactor(groupingCount, calcStandard);

  // 1. Fast path: the installed cable (even a non-catalog size) already
  // carries the load within the drop limit — keep it untouched.
  const installedBaseAmpacity = getAmpacity(existingParsed.size, method, insulation, isThreePhase, material, calcStandard);
  const installedSingleAmpacity = installedBaseAmpacity * totalDerating;
  const installedTotalAmpacity = installedSingleAmpacity * currentRuns;
  const installedVD = calculateVoltageDrop(current, lengthMeters, existingParsed.size, powerFactor, isThreePhase, systemVoltage, currentRuns, material);

  if (!targetRuns && installedTotalAmpacity >= current && installedVD.dropPercent <= maxVoltageDropPercent) {
    const rounded = Math.round(installedTotalAmpacity * 10) / 10;
    return {
      cableSize: existingParsed.size,
      parallelRuns: currentRuns,
      formattedCableSize: formatCableSize(existingParsed.size, currentRuns),
      breakerSize: findBreakerSize(current, code),
      voltageDropPercent: installedVD.dropPercent,
      voltageDropVolts: installedVD.dropVolts,
      changed: false,
      ampacity: rounded,
      singleAmpacity: Math.round(installedSingleAmpacity * 10) / 10,
      isOverloaded: rounded < current,
    };
  }

  // 2. Otherwise delegate to the sizing authority: Ib ≤ In ≤ Iz plus the ΔU
  // limit (IEC 60364-5-52 §525), including parallel-run search and fallbacks.
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod: method,
    maxCableSize,
    code,
    ...(targetRuns && targetRuns > 1 ? { targetRuns } : {}),
    voltageDrop: { lengthMeters, powerFactor, systemVoltage, maxPercent: maxVoltageDropPercent },
  });

  const runs = sizing.parallelRuns;
  const perRunAmpacity = runs > 0 ? sizing.deratedAmpacity / runs : sizing.deratedAmpacity;

  return {
    cableSize: sizing.cableSize,
    parallelRuns: runs,
    formattedCableSize: formatCableSize(sizing.cableSize, runs),
    breakerSize: sizing.breakerSize,
    voltageDropPercent: sizing.dropPercent ?? installedVD.dropPercent,
    voltageDropVolts: sizing.dropVolts ?? installedVD.dropVolts,
    changed: sizing.cableSize !== existingParsed.size || runs !== existingParsed.runs,
    ampacity: sizing.deratedAmpacity,
    singleAmpacity: Math.round(perRunAmpacity * 10) / 10,
    isOverloaded: sizing.deratedAmpacity < current,
  };
}
