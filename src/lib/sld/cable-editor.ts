import { calculateVoltageDrop } from '@/lib/calculations/cables';
import { CABLE_CATALOG } from '@/lib/calculations/cablesData';
import { getAmpacity } from '@/lib/calculations/installationMethods';

interface CableEditorInput {
  current: number;
  isThreePhase: boolean;
  lengthMeters: number;
  existingCableSize: number;
  powerFactor: number;
  systemVoltage: number;
  maxVoltageDropPercent: number;
  method?: string;
  insulation?: 'PVC' | 'XLPE';
}

interface CableEditorResult {
  cableSize: number;
  breakerSize: number;
  voltageDropPercent: number;
  voltageDropVolts: number;
  changed: boolean;
  ampacity: number;
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
  } = input;

  const breakerSize = findBreakerSize(current);

  const existingVD = calculateVoltageDrop(current, lengthMeters, existingCableSize, powerFactor, isThreePhase, systemVoltage);
  const existingAmpacity = getAmpacity(existingCableSize, method, insulation, isThreePhase);

  if (existingVD.dropPercent <= maxVoltageDropPercent && existingAmpacity >= breakerSize) {
    return {
      cableSize: existingCableSize,
      breakerSize,
      voltageDropPercent: existingVD.dropPercent,
      voltageDropVolts: existingVD.dropVolts,
      changed: false,
      ampacity: existingAmpacity,
    };
  }

  for (const cable of CABLE_CATALOG) {
    if (cable.size < existingCableSize) continue;
    const vd = calculateVoltageDrop(current, lengthMeters, cable.size, powerFactor, isThreePhase, systemVoltage);
    const ampacity = getAmpacity(cable.size, method, insulation, isThreePhase);
    if (vd.dropPercent <= maxVoltageDropPercent && ampacity >= breakerSize) {
      return {
        cableSize: cable.size,
        breakerSize,
        voltageDropPercent: vd.dropPercent,
        voltageDropVolts: vd.dropVolts,
        changed: true,
        ampacity,
      };
    }
  }

  const largest = CABLE_CATALOG[CABLE_CATALOG.length - 1];
  const vd = calculateVoltageDrop(current, lengthMeters, largest.size, powerFactor, isThreePhase, systemVoltage);
  const ampacity = getAmpacity(largest.size, method, insulation, isThreePhase);
  return {
    cableSize: largest.size,
    breakerSize,
    voltageDropPercent: vd.dropPercent,
    voltageDropVolts: vd.dropVolts,
    changed: true,
    ampacity,
  };
}
