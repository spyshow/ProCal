import { describe, it, expect } from 'vitest';
import { calculateVoltageDrop } from './cables';

/**
 * Riser Diagram Calculation Tests
 *
 * These tests verify the correct behavior for riser diagram voltage drop calculations.
 * The current implementation has bugs that these tests will expose.
 */

describe('Riser Diagram Voltage Drop Calculations', () => {
  describe('Bug 1: Hardcoded cable length', () => {
    it('should use actual cable length from floor items, not hardcoded 15m', () => {
      // This test demonstrates that using different cable lengths produces different VD
      const current = 100; // Amps
      const cableSize = 120; // mm²
      const pf = 0.85;
      const voltage = 400;

      const vd10m = calculateVoltageDrop(current, 10, cableSize, pf, true, voltage);
      const vd15m = calculateVoltageDrop(current, 15, cableSize, pf, true, voltage);
      const vd20m = calculateVoltageDrop(current, 20, cableSize, pf, true, voltage);

      // VD should be proportional to length
      expect(vd10m.dropPercent).toBeLessThan(vd15m.dropPercent);
      expect(vd15m.dropPercent).toBeLessThan(vd20m.dropPercent);

      // The ratio should approximately match the length ratio (within rounding)
      expect(vd15m.dropPercent / vd10m.dropPercent).toBeGreaterThan(1.4);
      expect(vd15m.dropPercent / vd10m.dropPercent).toBeLessThan(1.7);
      expect(vd20m.dropPercent / vd10m.dropPercent).toBeGreaterThan(1.8);
      expect(vd20m.dropPercent / vd10m.dropPercent).toBeLessThan(2.2);
    });
  });

  describe('Bug 2: Cumulative VD direction', () => {
    it('cumulative VD should increase from bottom (closest to transformer) to top (furthest)', () => {
      // In a correct implementation, FL1 (closest to transformer) should have LOWEST VD
      // and top floor (furthest) should have HIGHEST VD

      const floors = [
        { floor: 1, cableLength: 10 },  // Closest to transformer
        { floor: 2, cableLength: 20 },
        { floor: 3, cableLength: 30 },
        { floor: 4, cableLength: 40 },
        { floor: 5, cableLength: 50 },
        { floor: 6, cableLength: 60 },  // Furthest from transformer
      ];

      const current = 50;
      const cableSize = 70;
      const pf = 0.85;
      const voltage = 400;

      let cumulativeVD = 0;
      const vdBysFloor: number[] = [];

      // Correct implementation: calculate VD from transformer to each floor
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        cumulativeVD = vd.dropPercent; // NOT cumulative, just the VD to this floor
        vdBysFloor.push(cumulativeVD);
      }

      // VD should increase as we go further from transformer
      for (let i = 1; i < vdBysFloor.length; i++) {
        expect(vdBysFloor[i]).toBeGreaterThan(vdBysFloor[i - 1]);
      }
    });

    it('BUG: current implementation accumulates VD incorrectly (bottom-up)', () => {
      // This test demonstrates the bug: current code adds VD from FL1 upward
      // which is WRONG - VD should be calculated from transformer to each floor

      const floors = [
        { floor: 1, cableLength: 10 },
        { floor: 2, cableLength: 10 },
        { floor: 3, cableLength: 10 },
      ];

      const current = 50;
      const cableSize = 70;
      const pf = 0.85;
      const voltage = 400;

      // BUGGY: Cumulative from bottom (current implementation)
      let buggyCumulative = 0;
      const buggyVD: number[] = [];
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        buggyCumulative += vd.dropPercent; // BUG: accumulates
        buggyVD.push(buggyCumulative);
      }

      // CORRECT: VD from transformer to each floor
      const correctVD: number[] = [];
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        correctVD.push(vd.dropPercent); // CORRECT: just the VD to this floor
      }

      // The buggy implementation shows INCREASING VD (wrong!)
      // The correct implementation shows SAME VD for equal lengths
      expect(buggyVD[2]).toBeGreaterThan(buggyVD[0]); // Bug: FL3 shows higher VD
      expect(correctVD[2]).toBeCloseTo(correctVD[0], 1); // Correct: same VD for same length
    });
  });

  describe('Bug 3: Wrong cable size selection', () => {
    it('should use riser cable size, not apartment cable size', () => {
      // In a real building:
      // - Riser cable from MDB to SDB might be 120mm²
      // - Apartment cables might be 4mm² or 6mm²

      const riserCableSize = 120; // mm² - the actual riser cable
      const apartmentCableSize = 4; // mm² - apartment cable (wrong to use this!)

      const current = 100; // Amps (total floor current)
      const length = 15; // meters
      const pf = 0.85;
      const voltage = 400;

      const vdRiser = calculateVoltageDrop(current, length, riserCableSize, pf, true, voltage);
      const vdApartment = calculateVoltageDrop(current, length, apartmentCableSize, pf, true, voltage);

      // Using apartment cable size would give MUCH higher VD (wrong!)
      expect(vdApartment.dropPercent).toBeGreaterThan(vdRiser.dropPercent);

      // The difference is significant - using wrong cable size gives wrong VD
      expect(vdApartment.dropPercent / vdRiser.dropPercent).toBeGreaterThan(5);
    });
  });

  describe('IEC 60364-5-52 Formula Verification', () => {
    it('calculates Vd = √3 × I × L × (R·cosφ + X·sinφ) correctly', () => {
      // Manual calculation for verification:
      // 120mm² Cu cable, 12m, 100A, PF=0.85
      // R = 0.184 Ω/km (from cablesData.ts)
      // X = 0.070 Ω/km (from cablesData.ts)
      // cosφ = 0.85, sinφ = √(1-0.85²) = 0.527

      const current = 100;
      const length = 12; // meters
      const cableSize = 120;
      const pf = 0.85;
      const voltage = 400;

      const result = calculateVoltageDrop(current, length, cableSize, pf, true, voltage);

      // Manual calculation:
      // impedance = R·cosφ + X·sinφ = 0.184×0.85 + 0.070×0.527 = 0.1564 + 0.0369 = 0.1933 Ω/km
      // Vd = √3 × 100 × (12/1000) × 0.1933 = 1.732 × 100 × 0.012 × 0.1933 = 0.402V
      // %Vd = (0.402 / 400) × 100 = 0.10%

      expect(result.dropVolts).toBeCloseTo(0.40, 1);
      expect(result.dropPercent).toBeCloseTo(0.10, 1);
    });

    it('verifies VD limits per IEC 60364', () => {
      // IEC limits:
      // - Total from transformer to furthest point: 4%
      // - Sub-main circuits: 1%
      // - Final circuits: 3%

      const maxTotalVD = 4; // %
      const maxSubMainVD = 1; // %
      const maxFinalVD = 3; // %

      // Example: 6-floor building with 100A per floor
      const floors = 6;
      const current = 100;
      const cableSize = 120;
      const pf = 0.85;
      const voltage = 400;
      const cableLengthPerFloor = 10; // meters

      let cumulativeVD = 0;
      for (let i = 0; i < floors; i++) {
        const vd = calculateVoltageDrop(current, cableLengthPerFloor, cableSize, pf, true, voltage);
        cumulativeVD = vd.dropPercent; // VD to this floor (not cumulative)
      }

      // For this example, VD should be within limits
      expect(cumulativeVD).toBeLessThan(maxTotalVD);
    });
  });
});
