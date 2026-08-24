/**
 * Golden-value regression suite.
 *
 * Every expectation below is a HAND-COMPUTED closed form from an IEC worked
 * example or a transcribed standard-table cell — not an inequality smoke
 * test. If one of these fails, a constant table was corrupted or a formula
 * changed; fix the constant, never the expectation.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateTransformerImpedance,
  calculateShortCircuitCurrent,
  calculateIscWithCable,
} from './shortCircuit';
import { calculateVoltageDrop } from './cables';
import { calculateCableWithstandTime } from './selectivity';
import { getAmpacity } from './installationMethods';
import {
  CABLE_CATALOG,
  TEMP_DERATING,
  GROUP_DERATING,
} from './cablesData';

describe('Golden: transformer fault level (IEC 60909 worked example)', () => {
  // 1000 kVA, 400 V, uk = 5.5 %, infinite primary bus:
  //   Z_base = V²/S = 400² / 1e6 = 0.16 Ω
  //   Zt     = 0.16 × 0.055 = 0.0088 Ω
  //   Ik"    = c·Un/(√3·Zt) with c_max = 1.05 (LV)
  //          = 420 / (√3 × 0.0088) = 27560.5 A = 27.56 kA
  const trafo = {
    ratedPower: 1000,
    voltagePrimary: 11000,
    voltageSecondary: 400,
    impedancePercent: 5.5,
  };

  it('terminal impedance is exactly 0.0088 Ω', () => {
    expect(calculateTransformerImpedance(1000, 400, 5.5)).toBeCloseTo(0.0088, 6);
  });

  it('Ik" = 27.56 kA at the secondary terminals', () => {
    const r = calculateShortCircuitCurrent(trafo);
    expect(r.threePhaseIsc).toBeCloseTo(27.56, 2);
  });

  it('Ik2" = 0.866 × Ik3" ≈ 23.86 kA', () => {
    const r = calculateShortCircuitCurrent(trafo);
    expect(r.twoPhaseIsc).toBeCloseTo(27.56 * 0.866, 1);
    expect(r.twoPhaseIsc).toBeCloseTo(23.86, 2);
  });

  it('fault level MVA = √3 · Un · Ik" ≈ 19.09 MVA', () => {
    const r = calculateShortCircuitCurrent(trafo);
    expect(r.faultMVA).toBeCloseTo((Math.sqrt(3) * 400 * 27.56) / 1000, 1);
  });

  it('peak current ip = κ√2Ik" with κ( X/R=6 ) = 1.6144 → 62.93 kA', () => {
    // κ = 1.02 + 0.98·e^(−3R/X); R/X = 1/6 → κ = 1.02 + 0.98·e^(−0.5) = 1.61440
    // ip = 1.61440 × √2 × 27.5605 = 62.93 kA
    const kappa = 1.02 + 0.98 * Math.exp(-0.5);
    expect(kappa).toBeCloseTo(1.6144, 4);
    const r = calculateShortCircuitCurrent(trafo);
    expect(r.peakCurrent).toBeCloseTo(kappa * Math.SQRT2 * 27.5605, 1);
  });

  it('TN-S phase-to-neutral equals three-phase: 27.56 kA', () => {
    const r = calculateShortCircuitCurrent({ ...trafo, earthingSystem: 'TN-S' });
    expect(r.phaseToNeutralIsc).toBeCloseTo(27.56, 2);
  });

  it('TT loop (Re = 0.5 Ω): Ik,pn = 1.05·Uo/(Zt+Re) = 242.487/0.5088 = 0.48 kA', () => {
    const r = calculateShortCircuitCurrent({ ...trafo, earthingSystem: 'TT', earthFaultImpedanceOhms: 0.5 });
    expect(r.phaseToNeutralIsc).toBeCloseTo(0.48, 2);
  });

  it('far-end fault through 50 m of 95 mm² Cu XLPE: Z-loop vector sum → 12.94 kA', () => {
    // Zt = 400/(√3×27560.5) = 8.38 mΩ → R 1.376, X 8.267 mΩ (X/R 6)
    // Rc = 0.0172×1.28×50/95 = 11.58 mΩ; Xc = 0.08×50/1000 = 4 mΩ
    // Z  = √((1.376+11.58)² + (8.267+4)²) mΩ ≈ 17.85 mΩ → 12.94 kA
    expect(calculateIscWithCable(27.56, 50, 95, 400, true, false, 'XLPE', 1)).toBeCloseTo(12.94, 1);
  });
});

describe('Golden: adiabatic withstand t = (k·S/I)² (IEC 60364-4-43 Table 43.1)', () => {
  it('Cu/PVC k=115: S=16 mm² at 6 kA → 0.0940 s', () => {
    expect(calculateCableWithstandTime(16, 6000, 'copper', 'PVC')).toBeCloseTo((115 * 16 / 6000) ** 2, 4);
    expect(calculateCableWithstandTime(16, 6000, 'copper', 'PVC')).toBeCloseTo(0.09404, 4);
  });

  it('Cu/XLPE k=143: S=50 mm² at 5 kA → 2.0449 s', () => {
    expect(calculateCableWithstandTime(50, 5000, 'copper', 'XLPE')).toBeCloseTo(2.0449, 4);
  });

  it('Al/XLPE k=94: S=95 mm² at 10 kA → (0.893)² = 0.7974 s', () => {
    expect(calculateCableWithstandTime(95, 10000, 'aluminum', 'XLPE')).toBeCloseTo((94 * 95 / 10000) ** 2, 4);
    expect(calculateCableWithstandTime(95, 10000, 'aluminum', 'XLPE')).toBeCloseTo(0.7974, 3);
  });

  it('Al/PVC k=76: S=25 mm² at 1 kA → 3.61 s', () => {
    expect(calculateCableWithstandTime(25, 1000, 'aluminum', 'PVC')).toBeCloseTo((76 * 25 / 1000) ** 2, 4);
  });
});

describe('Golden: voltage drop ΔV = b·I·L·(Rcosφ + Xsinφ)/1000 (catalog 35 mm² Cu)', () => {
  // Catalog 35 mm²: R = 0.627 Ω/km, X = 0.077 Ω/km.
  // sinφ at cosφ 0.85 = 0.526783
  // Z = 0.627×0.85 + 0.077×0.526783 = 0.57351 Ω/km
  // ΔV(3φ) = √3×100×0.05×0.57351 = 4.97 V → 1.24 % of 400 V
  it('3-phase 100 A, 50 m, 35 mm², 400 V: 4.97 V / 1.24 %', () => {
    const vd = calculateVoltageDrop(100, 50, 35, 0.85, true, 400);
    expect(vd.dropVolts).toBeCloseTo(4.97, 2);
    expect(vd.dropPercent).toBeCloseTo(1.24, 2);
  });

  it('same run in aluminum (×0.0283/0.0172): 7.95 V / 1.99 %', () => {
    const vd = calculateVoltageDrop(100, 50, 35, 0.85, true, 400, 1, 'aluminum');
    expect(vd.dropVolts).toBeCloseTo(7.95, 2);
    expect(vd.dropPercent).toBeCloseTo(1.99, 2);
  });

  it('1-phase doubles the factor: 200 m of 16 mm² Cu at 20 A, 230 V', () => {
    // Catalog 16 mm²: R = 1.38, X = 0.082. sinφ = 0.526783.
    // Z = 1.38×0.85 + 0.082×0.526783 = 1.21620 Ω/km
    // ΔV = 2×20×0.2×1.21620 = 9.73 V → 4.23 % of 230 V
    const vd = calculateVoltageDrop(20, 200, 16, 0.85, false, 230);
    expect(vd.dropVolts).toBeCloseTo(9.73, 2);
    expect(vd.dropPercent).toBeCloseTo(4.23, 2);
  });

  it('parallel runs divide impedance: 2 runs halves the drop exactly', () => {
    const single = calculateVoltageDrop(100, 50, 35, 0.85, true, 400, 1);
    const twin = calculateVoltageDrop(100, 50, 35, 0.85, true, 400, 2);
    expect(twin.dropVolts).toBeCloseTo(single.dropVolts / 2, 2);
  });
});

describe('Golden: transcribed ampacity table cells (IEC 60364-5-52 B.52.x)', () => {
  it('Method C, XLPE, 3-loaded, copper: 16 mm² = 96 A, 240 mm² = 500 A', () => {
    expect(getAmpacity(16, 'C', 'XLPE', true, 'copper')).toBe(96);
    expect(getAmpacity(240, 'C', 'XLPE', true, 'copper')).toBe(500);
  });

  it('Method C, PVC, 1-loaded, copper: 240 mm² = 400 A', () => {
    expect(getAmpacity(240, 'C', 'PVC', false, 'copper')).toBe(400);
  });

  it('Method B1, XLPE, 3-loaded, copper: 70 mm² = 190 A', () => {
    expect(getAmpacity(70, 'B1', 'XLPE', true, 'copper')).toBe(190);
  });

  it('catalog resistance/reactance columns: 35 mm² = 0.627 Ω/km, 0.077 Ω/km', () => {
    const spec = CABLE_CATALOG.find((c) => c.size === 35)!;
    expect(spec.resistance).toBe(0.627);
    expect(spec.reactance).toBe(0.077);
  });

  it('temperature derating cells (Table B.52.14): XLPE@15°C = 1.12, PVC@40°C = 0.87, XLPE@30°C = 1.00', () => {
    expect(TEMP_DERATING.XLPE[15]).toBe(1.12);
    expect(TEMP_DERATING.PVC[40]).toBe(0.87);
    expect(TEMP_DERATING.XLPE[30]).toBe(1.0);
  });

  it('grouping derating cells (Table B.52.17): 2 circuits = 0.80, 6 circuits = 0.57', () => {
    expect(GROUP_DERATING[2]).toBe(0.8);
    expect(GROUP_DERATING[6]).toBe(0.57);
  });
});
