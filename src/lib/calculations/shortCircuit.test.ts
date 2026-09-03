import { describe, it, expect } from 'vitest';
import {
  calculateTransformerImpedance,
  calculateShortCircuitCurrent,
  calculateIscWithCable,
  getTypicalImpedance,
  TRANSFORMER_IMPEDANCE,
  sourceXrRatio,
  splitSourceImpedance,
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

    it('TT system: bolted L-N fault is metallic return, earth-fault loop reduces phase-to-earth current', () => {
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

      // 3-phase and bolted L-N short circuits are metallic at transformer terminals
      expect(tt.threePhaseIsc).toBe(tn.threePhaseIsc);
      expect(tt.twoPhaseIsc).toBe(tn.twoPhaseIsc);
      expect(tt.phaseToNeutralIsc).toBe(tn.phaseToNeutralIsc);

      // Phase-to-earth (L-PE) fault current is dramatically reduced by Z_earth:
      expect(tt.phaseToEarthIsc).toBeDefined();
      expect(tt.phaseToEarthIsc!).toBeLessThan(tn.threePhaseIsc);
      expect(tt.phaseToEarthIsc!).toBeCloseTo(0.48, 1);
      expect(tt.phaseToEarthIsc!).toBeLessThan(1.0); // < 1 kA
    });

    it('TT system: custom earthFaultImpedanceOhms affects earth-fault current inversely', () => {
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

      expect(ttLowZ.phaseToEarthIsc!).toBeGreaterThan(ttHighZ.phaseToEarthIsc!);
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

    it('proves fault current hierarchy: TT earth fault < TN earth fault, IT earth fault ≈ 0', () => {
      const tn = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'TN-S' });
      const tt = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'TT' });
      const itSystem = calculateShortCircuitCurrent({ ...baseTransformer, earthingSystem: 'IT' });

      expect(itSystem.phaseToEarthIsc).toBe(0);
      expect(tt.phaseToEarthIsc!).toBeGreaterThan(itSystem.phaseToEarthIsc!);
      expect(tt.phaseToEarthIsc!).toBeLessThan(tn.phaseToEarthIsc!);
      // Bolted phase-to-neutral fault is metallic in both TN and TT
      expect(tt.phaseToNeutralIsc).toBe(tn.phaseToNeutralIsc);
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

  it('raises fault current for parallel runs (2×240 halves the cable loop impedance)', () => {
    const baseIsc = 10; // kA at transformer terminals
    const single = calculateIscWithCable(baseIsc, 30, 240, 400, true, false, 'XLPE', 1);
    const parallel = calculateIscWithCable(baseIsc, 30, 240, 400, true, false, 'XLPE', 2);

    expect(parallel).toBeGreaterThan(single);
    expect(single).toBeCloseTo(8.97, 1);
    expect(parallel).toBeCloseTo(9.46, 1);
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

    expect(single).toBeCloseTo(14.06, 1);
    expect(parallel).toBeCloseTo(18.53, 1);
    expect(parallel).toBeGreaterThan(single);
  });

  it('parallel runs also raise the single-phase (L-N loop) fault current', () => {
    const baseIsc = 25;
    const single = calculateIscWithCable(baseIsc, 50, 95, 400, true, true, 'XLPE', 1);
    const parallel = calculateIscWithCable(baseIsc, 50, 95, 400, true, true, 'XLPE', 2);

    expect(parallel).toBeCloseTo(14.06, 1);
    expect(single).toBeCloseTo(9.19, 1);
    expect(parallel).toBeGreaterThan(single);
  });

  it('verifies 3-phase and 1-phase Isc scaling with parallel runs (runs=1, 2, 3, 4) against hand calculations', () => {
    const baseIsc = 20;
    const len = 100;
    const size = 240;
    const V = 400;

    const isc1 = calculateIscWithCable(baseIsc, len, size, V, true, false, 'XLPE', 1);
    const isc2 = calculateIscWithCable(baseIsc, len, size, V, true, false, 'XLPE', 2);
    const isc3 = calculateIscWithCable(baseIsc, len, size, V, true, false, 'XLPE', 3);
    const isc4 = calculateIscWithCable(baseIsc, len, size, V, true, false, 'XLPE', 4);

    expect(isc1).toBeCloseTo(11.04, 1);
    expect(isc2).toBeCloseTo(14.34, 1);
    expect(isc3).toBeCloseTo(15.88, 1);
    expect(isc4).toBeCloseTo(16.77, 1);

    // Strictly monotonically increasing with parallel runs
    expect(isc4).toBeGreaterThan(isc3);
    expect(isc3).toBeGreaterThan(isc2);
    expect(isc2).toBeGreaterThan(isc1);
  });

  it('single-phase fault uses the L-N loop model (Uo over source + go + return)', () => {
    const baseIsc = 25;
    const threePhase = calculateIscWithCable(baseIsc, 50, 95, 400, true, false);
    const onePhase = calculateIscWithCable(baseIsc, 50, 95, 400, true, true);

    expect(threePhase).toBeCloseTo(14.06, 1);
    expect(onePhase).toBeCloseTo(9.19, 1);
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

describe('CALC-CRIT-03: Transformer Zero-Sequence & Reduced Neutral (IEC 60909-0 §4.5.3)', () => {
  it('calculates line-to-neutral fault current according to transformer vector group (Dyn vs Yyn)', () => {
    const dynTrans = {
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
      earthingSystem: 'TN-S',
      vectorGroup: 'Dyn11' as const, // Z0/Z1 = 1.0 -> ratio 3/(2+1) = 1.0
    };

    const yynTrans = {
      ...dynTrans,
      vectorGroup: 'Yyn0' as const, // Z0/Z1 = 5.0 -> ratio 3/(2+5) = 3/7 ≈ 0.4286
    };

    const resDyn = calculateShortCircuitCurrent(dynTrans);
    const resYyn = calculateShortCircuitCurrent(yynTrans);

    // Three-phase fault is identical for both
    expect(resDyn.threePhaseIsc).toBe(resYyn.threePhaseIsc);

    // For Dyn11: L-N fault equals 3-phase fault at terminals (27.56 kA)
    expect(resDyn.phaseToNeutralIsc).toBe(resDyn.threePhaseIsc);

    // For Yyn0: L-N fault is limited to 3/7 (~43%) of three-phase fault due to zero-sequence impedance
    expect(resYyn.phaseToNeutralIsc).toBeCloseTo(resYyn.threePhaseIsc * (3 / 7), 1);
    expect(resYyn.phaseToNeutralIsc).toBeLessThan(resDyn.phaseToNeutralIsc * 0.5);
  });

  it('accounts for reduced neutral conductor cross-section (SN = Sph / 2) in single-phase fault loop', () => {
    // 50m of 240 mm² copper cable at 400V
    const fullNeutralIsc = calculateIscWithCable(25, 50, 240, 400, true, true, 'XLPE', 1, 240);
    const halfNeutralIsc = calculateIscWithCable(25, 50, 240, 400, true, true, 'XLPE', 1, 120);

    // Reduced neutral increases loop resistance (1 + 240/120 = 3x instead of 2x)
    // Thus fault current at far end must be lower with reduced neutral
    expect(halfNeutralIsc).toBeLessThan(fullNeutralIsc);
  });
});

describe('TEST-GAP-01: Transformer X/R ratio and peak make factor (IEC 60909-0 §4.3.2)', () => {
  it('assigns appropriate X/R ratio based on system voltage level', () => {
    // LV distribution transformers (<= 1000V) typically exhibit X/R ≈ 6
    expect(sourceXrRatio(400)).toBe(6);
    expect(sourceXrRatio(230)).toBe(6);
    // MV/HV systems (> 1000V) exhibit higher inductive reactance X/R ≈ 10
    expect(sourceXrRatio(11000)).toBe(10);
    expect(sourceXrRatio(33000)).toBe(10);
  });

  it('splits source impedance into orthogonal R and X components with Pythagorean consistency', () => {
    const z = 0.0088; // ohms
    const xr = 6;
    const { r, x } = splitSourceImpedance(z, xr);

    // X/R ratio must be preserved
    expect(x / r).toBeCloseTo(xr, 4);
    // Vector magnitude must equal original z: sqrt(r^2 + x^2) == z
    expect(Math.sqrt(r * r + x * x)).toBeCloseTo(z, 6);
  });

  it('calculates peak short-circuit current using IEC 60909-0 factor kappa', () => {
    const trafo = {
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
    };
    const res = calculateShortCircuitCurrent(trafo);
    // For LV with X/R = 6:
    // kappa = 1.02 + 0.98 * exp(-3 / 6) = 1.02 + 0.98 * 0.60653 = 1.6144
    // Peak multiplier = kappa * sqrt(2) ≈ 2.283
    const expectedPeakMultiplier = (1.02 + 0.98 * Math.exp(-3 / 6)) * Math.SQRT2;
    expect(res.peakCurrent).toBeCloseTo(res.threePhaseIsc * expectedPeakMultiplier, 1);
  });
});

describe('TEST-GAP-03: Earth Fault Loop Impedance and Touch Voltage Safety (IEC 60364-4-41 §411.3.2)', () => {
  it('evaluates phase-to-earth fault in TT system limited strictly by earth electrode', () => {
    const ttTrafo = {
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
      earthingSystem: 'TT',
      earthFaultImpedanceOhms: 0.5, // RA + RB = 0.5 ohm
    };
    const res = calculateShortCircuitCurrent(ttTrafo);

    // Bolted L-N fault is a metallic loop (does not traverse earth electrode)
    expect(res.phaseToNeutralIsc).toBeCloseTo(27.56, 1);

    // Phase-to-earth fault (Id) traverses consumer earth electrode + substation earth rod:
    // U0 = 230.94V, Z_loop ≈ sqrt((R_trafo + 0.5)^2 + X_trafo^2) ≈ 0.500 ohms -> Id ≈ 0.48 kA (485 A)
    expect(res.phaseToEarthIsc).toBeDefined();
    expect(res.phaseToEarthIsc!).toBeCloseTo(0.48, 1);
    // The limited 485 A earth fault current confirms why RCD protection is mandatory in TT
    // (a 1000A or 630A circuit breaker cannot detect or clear 485A earth fault).
    expect(res.phaseToEarthIsc!).toBeLessThan(res.phaseToNeutralIsc * 0.05);
  });

  it('evaluates phase-to-earth fault in TN-S system through low-impedance metallic PE conductor', () => {
    const tnsTrafo = {
      ratedPower: 1000,
      voltagePrimary: 11000,
      voltageSecondary: 400,
      impedancePercent: 5.5,
      earthingSystem: 'TN-S',
    };
    const res = calculateShortCircuitCurrent(tnsTrafo);

    // In TN-S, metallic PE return enables fault current equal to bolted L-N fault
    expect(res.phaseToNeutralIsc).toBeCloseTo(27.56, 1);
    expect(res.phaseToEarthIsc).toBeCloseTo(27.56, 1); // TN-S earth fault loop is metallic phaseToNeutral
  });
});
