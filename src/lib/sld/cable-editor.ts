import { calculateVoltageDrop, sizeCableAndBreaker } from '@/lib/calculations/cables';
import { CABLE_CATALOG } from '@/lib/calculations/cablesData';

interface CableEditorInput {
  current: number;
  isThreePhase: boolean;
  lengthMeters: number;
  existingCableSize: number;
  powerFactor: number;
  systemVoltage: number;
  maxVoltageDropPercent: number;
}

interface CableEditorResult {
  cableSize: number;
  breakerSize: number;
  voltageDropPercent: number;
  voltageDropVolts: number;
  changed: boolean;
}

export function recalculateCable(input: CableEditorInput): CableEditorResult {
  const { current, isThreePhase, lengthMeters, existingCableSize, powerFactor, systemVoltage, maxVoltageDropPercent } = input;

  const existingVD = calculateVoltageDrop(current, lengthMeters, existingCableSize, powerFactor, isThreePhase, systemVoltage);

  if (existingVD.dropPercent <= maxVoltageDropPercent) {
    const sizing = sizeCableAndBreaker(current, isThreePhase, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });
    return {
      cableSize: existingCableSize,
      breakerSize: sizing.breakerSize,
      voltageDropPercent: existingVD.dropPercent,
      voltageDropVolts: existingVD.dropVolts,
      changed: false,
    };
  }

  for (const cable of CABLE_CATALOG) {
    if (cable.size < existingCableSize) continue;
    const vd = calculateVoltageDrop(current, lengthMeters, cable.size, powerFactor, isThreePhase, systemVoltage);
    if (vd.dropPercent <= maxVoltageDropPercent) {
      const sizing = sizeCableAndBreaker(current, isThreePhase, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 1,
      });
      return {
        cableSize: cable.size,
        breakerSize: sizing.breakerSize,
        voltageDropPercent: vd.dropPercent,
        voltageDropVolts: vd.dropVolts,
        changed: true,
      };
    }
  }

  const largest = CABLE_CATALOG[CABLE_CATALOG.length - 1];
  const vd = calculateVoltageDrop(current, lengthMeters, largest.size, powerFactor, isThreePhase, systemVoltage);
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material: 'copper',
    insulation: 'XLPE',
    ambientTemp: 30,
    groupingCount: 1,
  });
  return {
    cableSize: largest.size,
    breakerSize: sizing.breakerSize,
    voltageDropPercent: vd.dropPercent,
    voltageDropVolts: vd.dropVolts,
    changed: true,
  };
}
