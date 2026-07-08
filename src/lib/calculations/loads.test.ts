import { describe, it, expect } from 'vitest';
import {
  getApartmentDiversityFactor,
  calculateThreePhaseCurrent,
  calculateSinglePhaseCurrent,
  sizeTransformer,
  sizeGenerator,
} from './loads';

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
});

describe('calculateSinglePhaseCurrent', () => {
  it('calculates correct current for 10kVA at 230V', () => {
    const current = calculateSinglePhaseCurrent(10, 230);
    // I = S / (V/1000) = 10 / 0.23 ≈ 43.48A
    expect(current).toBeCloseTo(43.48, 0);
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
});
