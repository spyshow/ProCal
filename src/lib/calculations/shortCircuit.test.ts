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

  describe('Earthing System short circuit behavior', () => {
    const baseTransformer = {
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
    };

    it('TN-S and TN-C systems: solid grounding with phaseToNeutralIsc equal to threePhaseIsc', () => {
      const tnS = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TN-S',
      });
      const tnC = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TN-C',
      });

      expect(tnS.earthingSystem).toBe('TN-S');
      expect(tnS.itFirstFault).toBe(false);
      expect(tnS.phaseToNeutralIsc).toBeCloseTo(tnS.threePhaseIsc, 2);

      expect(tnC.earthingSystem).toBe('TN-C');
      expect(tnC.itFirstFault).toBe(false);
      expect(tnC.phaseToNeutralIsc).toBeCloseTo(tnC.threePhaseIsc, 2);
    });

    it('TT system: loop impedance reduces phase-to-neutral fault current significantly', () => {
      const tn = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TN-S',
      });
      const tt = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TT',
        earthFaultImpedanceOhms: 0.5,
      });

      expect(tt.earthingSystem).toBe('TT');
      expect(tt.itFirstFault).toBe(false);
      expect(tt.earthFaultImpedanceOhms).toBe(0.5);

      // 3-phase short circuit is unchanged at transformer terminals
      expect(tt.threePhaseIsc).toBe(tn.threePhaseIsc);
      expect(tt.twoPhaseIsc).toBe(tn.twoPhaseIsc);

      // Phase-to-neutral fault current is dramatically reduced by Z_earth:
      // V_LN = 400 / sqrt(3) = 230.94 V
      // Z_trans = 0.0088 ohm, Z_earth = 0.5 ohm -> Z_total = 0.5088 ohm
      // I_sc,pn = 230.94 / 0.5088 = 453.89 A = 0.45 kA
      expect(tt.phaseToNeutralIsc).toBeLessThan(tn.phaseToNeutralIsc);
      expect(tt.phaseToNeutralIsc).toBeCloseTo(0.45, 1);
      expect(tt.phaseToNeutralIsc).toBeLessThan(1.0); // < 1 kA
    });

    it('TT system: custom earthFaultImpedanceOhms affects fault current inversely', () => {
      const ttLowZ = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TT',
        earthFaultImpedanceOhms: 0.2,
      });
      const ttHighZ = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'TT',
        earthFaultImpedanceOhms: 1.0,
      });

      expect(ttLowZ.phaseToNeutralIsc).toBeGreaterThan(ttHighZ.phaseToNeutralIsc);
    });

    it('IT system: phase-to-neutral fault current is negligible on first fault (0 kA)', () => {
      const itResult = calculateShortCircuitCurrent({
        ...baseTransformer,
        earthingSystem: 'IT',
      });

      expect(itResult.earthingSystem).toBe('IT');
      expect(itResult.itFirstFault).toBe(true);
      expect(itResult.phaseToNeutralIsc).toBe(0);

      // 3-phase and 2-phase fault ratings remain intact for double fault / phase faults
      expect(itResult.threePhaseIsc).toBeGreaterThan(10);
      expect(itResult.twoPhaseIsc).toBeCloseTo(itResult.threePhaseIsc * 0.866, 1);
    });

    it('proves fault current hierarchy: TT phase-to-neutral < TN phase-to-neutral, IT phase-to-neutral ≈ 0', () => {
      const tn = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'TN-S' });
      const tt = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'TT' });
      const itSystem = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'IT' });

      expect(itSystem.phaseToNeutralIsc).toBe(0);
      expect(tt.phaseToNeutralIsc).toBeGreaterThan(itSystem.phaseToNeutralIsc);
      expect(tt.phaseToNeutralIsc).toBeLessThan(tn.phaseToNeutralIsc);
    });

    it('throws CalculationError for negative earthFaultImpedanceOhms', () => {
      expect(() =>
        calculateShortCircuitCurrent({
          ...baseTransformer,
          earthingSystem: 'TT',
          earthFaultImpedanceOhms: -0.5,
        })
      ).toThrow(CalculationError);
    });
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
    expect(() => calculateIscWithCable(25, 50, 95, 400, true, true, 'XLPE', 0)).toThrow(CalculationError);
  });

  it('parallel runs halve the cable impedance and raise the fault current', () => {
    const baseIsc = 25;
    const single = calculateIscWithCable(baseIsc, 50, 95, 400, true, false, 'XLPE', 1);
    const parallel = calculateIscWithCable(baseIsc, 50, 95, 400, true, false, 'XLPE', 2);

    // Single run: Zt = 0.00924 Ω, Zcable = 0.01226 Ω → 10.74 kA (see above).
    // Two runs: Zcable/2 = 0.00613 Ω → 230.94 / (0.00924 + 0.00613) / 1000 ≈ 15.03 kA.
    expect(single).toBeCloseTo(10.74, 1);
    expect(parallel).toBeCloseTo(15.03, 1);
    // Fault current at the far end is HIGHER with parallel runs — ignoring them
    // understates the fault, which is the non-conservative direction for Icu.
    expect(parallel).toBeGreaterThan(single);
  });

  it('parallel runs also raise the single-phase (L-N loop) fault current', () => {
    const baseIsc = 25;
    const single = calculateIscWithCable(baseIsc, 50, 95, 400, true, true, 'XLPE', 1);
    const parallel = calculateIscWithCable(baseIsc, 50, 95, 400, true, true, 'XLPE', 2);

    // Loop impedance with 2 runs: Zt + 2·(Zcable/2) = Zt + Zcable → 10.74 kA
    expect(parallel).toBeCloseTo(10.74, 1);
    expect(parallel).toBeGreaterThan(single);
  });

  it('single-phase fault uses the L-N loop model (Uo over source + go + return)', () => {
    const baseIsc = 25;
    const threePhase = calculateIscWithCable(baseIsc, 50, 95, 400, true, false);
    const onePhase = calculateIscWithCable(baseIsc, 50, 95, 400, true, true);

    // Closed-form: Uo = 230.94 V, Zt = 0.00924 Ω, Zcable = 0.01226 Ω/conductor
    expect(threePhase).toBeCloseTo(10.74, 1);
    expect(onePhase).toBeCloseTo(6.84, 1);
    // The loop includes both conductors, so 1φ decays faster along the cable
    expect(onePhase).toBeLessThan(threePhase);
  });

  it('single-phase fault equals the terminal Isc at zero cable length', () => {
    expect(calculateIscWithCable(25, 0, 95, 400, true, true)).toBe(25);
  });

  it('single-phase fault decreases with cable length', () => {
    const short = calculateIscWithCable(25, 20, 95, 400, true, true);
    const long = calculateIscWithCable(25, 100, 95, 400, true, true);
    expect(long).toBeLessThan(short);
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
