import { describe, it, expect } from 'vitest';
import { calculateThreePhaseCurrent, calculateSinglePhaseCurrent } from './loads';
import { CalculationError } from './validate';

describe('Phase-Aware Current Calculations (Production loads.ts)', () => {
  describe('calculateSinglePhaseCurrent', () => {
    it('calculates single-phase current at 230V per IEC 60038', () => {
      // 5 kVA at 230V = 5000 / 230 = 21.74 A
      expect(calculateSinglePhaseCurrent(5, 230)).toBeCloseTo(21.74, 2);
    });

    it('calculates single-phase current at 120V (North American NEC)', () => {
      // 1.8 kVA at 120V = 1800 / 120 = 15.00 A
      expect(calculateSinglePhaseCurrent(1.8, 120)).toBeCloseTo(15.0, 2);
    });

    it('returns 0 for zero power', () => {
      expect(calculateSinglePhaseCurrent(0, 230)).toBe(0);
    });

    it('throws CalculationError for negative power or invalid voltage', () => {
      expect(() => calculateSinglePhaseCurrent(-5, 230)).toThrow(CalculationError);
      expect(() => calculateSinglePhaseCurrent(5, 0)).toThrow(CalculationError);
      expect(() => calculateSinglePhaseCurrent(5, -230)).toThrow(CalculationError);
    });
  });

  describe('calculateThreePhaseCurrent', () => {
    it('calculates three-phase current at 400V per IEC 60038', () => {
      // 100 kVA at 400V = 100 / (√3 × 0.4) = 144.34 A
      expect(calculateThreePhaseCurrent(100, 400)).toBeCloseTo(144.34, 2);
    });

    it('calculates three-phase current at 480V (North American commercial)', () => {
      // 100 kVA at 480V = 100 / (√3 × 0.48) = 120.28 A
      expect(calculateThreePhaseCurrent(100, 480)).toBeCloseTo(120.28, 2);
    });

    it('three-phase current is lower than single-phase for same kVA', () => {
      const kva = 10;
      const singlePhase = calculateSinglePhaseCurrent(kva, 230);
      const threePhase = calculateThreePhaseCurrent(kva, 400);
      // At standard 400/230V: I_3ph / I_1ph = (S / (√3 * 400)) / (S / 230) = 230 / (√3 * 400) ≈ 0.332
      expect(threePhase).toBeLessThan(singlePhase);
      expect(threePhase / singlePhase).toBeCloseTo(0.332, 2);
    });

    it('returns 0 for zero power', () => {
      expect(calculateThreePhaseCurrent(0, 400)).toBe(0);
    });

    it('scales linearly with demand', () => {
      const current50 = calculateThreePhaseCurrent(50, 400);
      const current100 = calculateThreePhaseCurrent(100, 400);
      expect(current100).toBeCloseTo(current50 * 2, 2);
    });

    it('throws CalculationError for negative power or invalid voltage', () => {
      expect(() => calculateThreePhaseCurrent(-10, 400)).toThrow(CalculationError);
      expect(() => calculateThreePhaseCurrent(10, 0)).toThrow(CalculationError);
      expect(() => calculateThreePhaseCurrent(10, -400)).toThrow(CalculationError);
    });
  });
});
