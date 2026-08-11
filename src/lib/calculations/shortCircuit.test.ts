import { describe, it, expect } from 'vitest';
import {
  calculateTransformerImpedance,
  calculateShortCircuitCurrent,
  calculateIscWithCable,
  getTypicalImpedance,
  TRANSFORMER_IMPEDANCE,
} from './shortCircuit';
import { CalculationError } from './validate';

describe('calculateTransformerImpedance', () => {
  it('calculates impedance for 1000kVA transformer at 400V', () => {
    const impedance = calculateTransformerImpedance(1000, 400, 5.5);
    // Z_base = V^2 / S = 400^2 / (1000/1000 * 1e6) = 160000 / 1e6 = 0.16 ohms
    // Z_actual = 0.16 * 0.055 = 0.0088 ohms
    expect(impedance).toBeCloseTo(0.0088, 4);
  });

  it('higher impedance % gives higher impedance', () => {
    const low = calculateTransformerImpedance(1000, 400, 4.0);
    const high = calculateTransformerImpedance(1000, 400, 6.0);
    expect(high).toBeGreaterThan(low);
  });

  it('lower voltage gives lower impedance', () => {
    const highV = calculateTransformerImpedance(1000, 400, 5.5);
    const lowV = calculateTransformerImpedance(1000, 230, 5.5);
    expect(lowV).toBeLessThan(highV);
  });

  it('throws CalculationError for non-positive parameters', () => {
    expect(() => calculateTransformerImpedance(-1, 400, 5.5)).toThrow(CalculationError);
    expect(() => calculateTransformerImpedance(1000, 0, 5.5)).toThrow(CalculationError);
    expect(() => calculateTransformerImpedance(1000, 400, -1)).toThrow(CalculationError);
  });
});

describe('calculateShortCircuitCurrent', () => {
  it('calculates fault current from transformer', () => {
    const result = calculateShortCircuitCurrent({
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
    });

    expect(result.threePhaseIsc).toBeGreaterThan(0);
    expect(result.peakCurrent).toBeGreaterThan(result.threePhaseIsc);
    expect(result.twoPhaseIsc).toBeLessThan(result.threePhaseIsc);
  });

  it('returns reasonable fault current for 1000kVA transformer', () => {
    const result = calculateShortCircuitCurrent({
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
    });

    // Typical fault current for 1000kVA/400V transformer is 20-40kA
    expect(result.threePhaseIsc).toBeGreaterThan(10);
    expect(result.threePhaseIsc).toBeLessThan(50);
  });

  it('higher impedance gives lower fault current', () => {
    const lowZ = calculateShortCircuitCurrent({
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 4.0,
    });

    const highZ = calculateShortCircuitCurrent({
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 6.0,
    });

    expect(lowZ.threePhaseIsc).toBeGreaterThan(highZ.threePhaseIsc);
  });

  it('calculates fault MVA', () => {
    const result = calculateShortCircuitCurrent({
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
    });

    expect(result.faultMVA).toBeGreaterThan(0);
  });

  it('throws CalculationError for non-positive transformer specs', () => {
    expect(() =>
      calculateShortCircuitCurrent({
        ratedPower: -100,
        voltagePrimary: 11000,
        voltageSecondary: 400,
        impedancePercent: 5.5,
      })
    ).toThrow(CalculationError);

    expect(() =>
      calculateShortCircuitCurrent({
        ratedPower: 1000,
        voltagePrimary: 0,
        voltageSecondary: 400,
        impedancePercent: 5.5,
      })
    ).toThrow(CalculationError);
  });
});

describe('calculateIscWithCable', () => {
  it('reduces fault current with cable length', () => {
    const baseIsc = 25; // kA at transformer terminals
    const withoutCable = calculateIscWithCable(baseIsc, 0, 95, 400, true);
    const withCable = calculateIscWithCable(baseIsc, 50, 95, 400, true);

    expect(withoutCable).toBe(baseIsc);
    expect(withCable).toBeLessThan(baseIsc);
  });

  it('longer cable reduces fault current more', () => {
    const baseIsc = 25;
    const short = calculateIscWithCable(baseIsc, 20, 95, 400, true);
    const long = calculateIscWithCable(baseIsc, 100, 95, 400, true);

    expect(long).toBeLessThan(short);
  });

  it('smaller cable reduces fault current more', () => {
    const baseIsc = 25;
    const large = calculateIscWithCable(baseIsc, 50, 150, 400, true);
    const small = calculateIscWithCable(baseIsc, 50, 35, 400, true);

    expect(small).toBeLessThan(large);
  });

  it('returns base Isc when cable length is zero', () => {
    const baseIsc = 25;
    const result = calculateIscWithCable(baseIsc, 0, 95, 400, true);
    expect(result).toBe(baseIsc);
  });

  it('throws CalculationError for invalid parameters', () => {
    expect(() => calculateIscWithCable(0, 50, 95, 400)).toThrow(CalculationError);
    expect(() => calculateIscWithCable(-25, 50, 95, 400)).toThrow(CalculationError);
    expect(() => calculateIscWithCable(25, -10, 95, 400)).toThrow(CalculationError);
    expect(() => calculateIscWithCable(25, 50, -5, 400)).toThrow(CalculationError);
    expect(() => calculateIscWithCable(25, 50, 95, 0)).toThrow(CalculationError);
  });
});

describe('getTypicalImpedance', () => {
  it('returns impedance for standard rating', () => {
    expect(getTypicalImpedance(1000)).toBe(5.5);
  });

  it('returns next higher impedance for non-standard rating', () => {
    // 500kVA is in the table with 5.0%
    expect(getTypicalImpedance(500)).toBe(5.0);
  });

  it('returns default for very large transformers', () => {
    expect(getTypicalImpedance(10000)).toBe(7.5);
  });

  it('throws CalculationError for non-positive power', () => {
    expect(() => getTypicalImpedance(0)).toThrow(CalculationError);
    expect(() => getTypicalImpedance(-500)).toThrow(CalculationError);
  });
});

describe('TRANSFORMER_IMPEDANCE', () => {
  it('contains standard kVA ratings', () => {
    expect(TRANSFORMER_IMPEDANCE[100]).toBe(4.0);
    expect(TRANSFORMER_IMPEDANCE[1000]).toBe(5.5);
    expect(TRANSFORMER_IMPEDANCE[3150]).toBe(7.0);
  });

  it('impedance increases with transformer size', () => {
    expect(TRANSFORMER_IMPEDANCE[1000]).toBeGreaterThan(TRANSFORMER_IMPEDANCE[100]);
    expect(TRANSFORMER_IMPEDANCE[5000]).toBeGreaterThan(TRANSFORMER_IMPEDANCE[1000]);
  });
});
