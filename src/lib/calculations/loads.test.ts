import { describe, it, expect } from 'vitest';
import {
  getApartmentDiversityFactor,
  calculateThreePhaseCurrent,
  calculateSinglePhaseCurrent,
  sizeTransformer,
  sizeGenerator,
} from './loads';
import { CalculationError } from './validate';

describe('getApartmentDiversityFactor', () => {
  it('returns 1.0 for 1 apartment', () => {
    expect(getApartmentDiversityFactor(1)).toBe(1.0);
  });

  it('returns 0.8 for 2-4 apartments', () => {
    expect(getApartmentDiversityFactor(2)).toBe(0.8);
    expect(getApartmentDiversityFactor(4)).toBe(0.8);
  });

  it('returns 0.7 for 5-9 apartments', () => {
    expect(getApartmentDiversityFactor(5)).toBe(0.7);
    expect(getApartmentDiversityFactor(9)).toBe(0.7);
  });

  it('returns 0.6 for 10-14 apartments', () => {
    expect(getApartmentDiversityFactor(10)).toBe(0.6);
    expect(getApartmentDiversityFactor(14)).toBe(0.6);
  });

  it('returns 0.55 for 15-19 apartments', () => {
    expect(getApartmentDiversityFactor(15)).toBe(0.55);
    expect(getApartmentDiversityFactor(19)).toBe(0.55);
  });

  it('returns 0.5 for 20+ apartments', () => {
    expect(getApartmentDiversityFactor(20)).toBe(0.5);
    expect(getApartmentDiversityFactor(100)).toBe(0.5);
  });

  it('throws CalculationError for negative count', () => {
    expect(() => getApartmentDiversityFactor(-1)).toThrow(CalculationError);
  });
});

describe('calculateThreePhaseCurrent', () => {
  it('calculates correct current for 100kVA at 400V', () => {
    const current = calculateThreePhaseCurrent(100, 400);
    // I = S / (sqrt(3) * V/1000) = 100 / (1.732 * 0.4) ≈ 144.34A
    expect(current).toBeCloseTo(144.34, 0);
  });

  it('calculates correct current for 250kVA at 400V', () => {
    const current = calculateThreePhaseCurrent(250, 400);
    expect(current).toBeCloseTo(360.84, 0);
  });

  it('throws CalculationError for negative power or non-positive voltage', () => {
    expect(() => calculateThreePhaseCurrent(-1, 400)).toThrow(CalculationError);
    expect(() => calculateThreePhaseCurrent(100, 0)).toThrow(CalculationError);
    expect(() => calculateThreePhaseCurrent(100, -400)).toThrow(CalculationError);
  });
});

describe('calculateSinglePhaseCurrent', () => {
  it('calculates correct current for 10kVA at 230V', () => {
    const current = calculateSinglePhaseCurrent(10, 230);
    // I = S / (V/1000) = 10 / 0.23 ≈ 43.48A
    expect(current).toBeCloseTo(43.48, 0);
  });

  it('throws CalculationError for negative power or non-positive voltage', () => {
    expect(() => calculateSinglePhaseCurrent(-1, 230)).toThrow(CalculationError);
    expect(() => calculateSinglePhaseCurrent(10, 0)).toThrow(CalculationError);
    expect(() => calculateSinglePhaseCurrent(10, -230)).toThrow(CalculationError);
  });
});

describe('sizeTransformer', () => {
  it('sizes correctly for 100kVA demand', () => {
    const size = sizeTransformer(100);
    expect(size).toBeGreaterThanOrEqual(100);
  });

  it('sizes correctly for 500kVA demand', () => {
    const size = sizeTransformer(500);
    expect(size).toBeGreaterThanOrEqual(500);
  });

  it('applies safety margin', () => {
    const size = sizeTransformer(100, 1.5);
    expect(size).toBeGreaterThanOrEqual(150);
  });

  it('throws CalculationError for negative demand or invalid safety margin', () => {
    expect(() => sizeTransformer(-1)).toThrow(CalculationError);
    expect(() => sizeTransformer(100, 0.5)).toThrow(CalculationError);
    expect(() => sizeTransformer(100, 1.2, [-10, 20, 20])).toThrow(CalculationError);
  });

  it('matches lumped sizing when phases are balanced', () => {
    // 70 kW total at PF 0.85 → 82.35 kVA; ×1.2 = 98.8 → 100 kVA either way.
    const lumped = sizeTransformer(82.35, 1.2);
    const perPhase = sizeTransformer(82.35, 1.2, [27.45, 27.45, 27.45]);
    expect(lumped).toBe(100);
    expect(perPhase).toBe(100);
  });

  it('sizes on the worst-loaded winding when unbalanced (max phase × 3)', () => {
    // One heavy phase: 50/10/10 kW at PF 0.85 → max winding 58.8 kVA.
    // Lumped total is only 82.4 kVA → 100 kVA transformer would be chosen and
    // overload the heavy winding (needs ≥ 58.8×3×1.2 ≈ 212 → 250 kVA).
    const lumped = sizeTransformer(82.35, 1.2);
    const perPhase = sizeTransformer(82.35, 1.2, [50 / 0.85, 10 / 0.85, 10 / 0.85]);
    expect(lumped).toBe(100);
    expect(perPhase).toBe(250);
  });

  it('correctly handles severe phase imbalance (60/10/10 kW) requiring 400 kVA transformer', () => {
    // Phase 1 = 60 kW / 0.85 = 70.588 kVA
    // Phase 2 = 10 kW / 0.85 = 11.765 kVA
    // Phase 3 = 10 kW / 0.85 = 11.765 kVA
    // Total lumped = 80 kW / 0.85 = 94.118 kVA -> lumped × 1.2 = 112.94 kVA (would pick 160 kVA, causing overload on Phase 1)
    // 3 × max(70.588) × 1.2 = 254.1 kVA -> picks 400 kVA standard transformer
    const lumped = sizeTransformer(80 / 0.85, 1.2);
    const perPhase = sizeTransformer(80 / 0.85, 1.2, [60 / 0.85, 10 / 0.85, 10 / 0.85]);
    expect(lumped).toBe(160);
    expect(perPhase).toBe(400);
  });

  it('correctly sizes balanced 270 kW load (90/90/90 kW) to 400 kVA transformer', () => {
    // 90 kW / 0.9 per phase = 100 kVA -> 3 × 100 = 300 kVA -> × 1.2 = 360 kVA -> 400 kVA transformer
    const perPhase = sizeTransformer(270 / 0.9, 1.2, [90 / 0.9, 90 / 0.9, 90 / 0.9]);
    expect(perPhase).toBe(400);
  });
});

describe('sizeGenerator', () => {
  it('sizes correctly for essential load', () => {
    const size = sizeGenerator(200, 50);
    expect(size).toBeGreaterThanOrEqual(200);
  });

  it('accounts for motor starting surge', () => {
    const size = sizeGenerator(100, 100);
    expect(size).toBeGreaterThanOrEqual(100);
  });

  it('throws CalculationError for invalid parameters', () => {
    expect(() => sizeGenerator(-1, 50)).toThrow(CalculationError);
    expect(() => sizeGenerator(200, -10)).toThrow(CalculationError);
    expect(() => sizeGenerator(200, 50, 0)).toThrow(CalculationError);
    expect(() => sizeGenerator(200, 50, 6, 0.8)).toThrow(CalculationError);
  });
});
