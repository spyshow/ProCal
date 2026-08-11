import { describe, it, expect } from 'vitest';
import { sizeCableAndBreaker, calculateVoltageDrop, STANDARD_BREAKERS } from './cables';
import { CalculationError } from './validate';

describe('sizeCableAndBreaker', () => {
  it('sizes cable for 30A single-phase load', () => {
    const result = sizeCableAndBreaker(30, false, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });

    expect(result.breakerSize).toBeGreaterThanOrEqual(30);
    expect(result.cableSize).toBeGreaterThan(0);
    expect(result.deratedAmpacity).toBeGreaterThanOrEqual(result.breakerSize);
  });

  it('sizes cable for 200A three-phase load', () => {
    const result = sizeCableAndBreaker(200, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 2,
    });

    expect(result.breakerSize).toBeGreaterThanOrEqual(200);
    expect(result.cableSize).toBeGreaterThanOrEqual(95);
    expect(result.earthSize).toBeGreaterThan(0);
  });

  it('applies temperature derating', () => {
    const result30 = sizeCableAndBreaker(100, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });

    const result50 = sizeCableAndBreaker(100, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 50,
      groupingCount: 1,
    });

    // Higher ambient temp should require larger cable
    expect(result50.cableSize).toBeGreaterThanOrEqual(result30.cableSize);
  });

  it('applies grouping derating', () => {
    const result1 = sizeCableAndBreaker(100, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });

    const result5 = sizeCableAndBreaker(100, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 5,
    });

    // More cables in group should require larger cable
    expect(result5.cableSize).toBeGreaterThanOrEqual(result1.cableSize);
  });

  it('throws CalculationError for invalid sizing parameters', () => {
    expect(() =>
      sizeCableAndBreaker(-1, false, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 1,
      })
    ).toThrow(CalculationError);

    expect(() =>
      sizeCableAndBreaker(30, false, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 5,
        groupingCount: 1,
      })
    ).toThrow(CalculationError);

    expect(() =>
      sizeCableAndBreaker(30, false, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 65,
        groupingCount: 1,
      })
    ).toThrow(CalculationError);

    expect(() =>
      sizeCableAndBreaker(30, false, {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 0,
      })
    ).toThrow(CalculationError);
  });
});

describe('calculateVoltageDrop', () => {
  it('calculates VD for 100A, 50m, 35mm2 three-phase', () => {
    const result = calculateVoltageDrop(100, 50, 35, 0.85, true, 400);
    expect(result.dropPercent).toBeGreaterThan(0);
    expect(result.dropPercent).toBeLessThan(10);
  });

  it('returns higher VD for longer cables', () => {
    const short = calculateVoltageDrop(100, 20, 16, 0.85, true, 400);
    const long = calculateVoltageDrop(100, 100, 16, 0.85, true, 400);
    expect(long.dropPercent).toBeGreaterThan(short.dropPercent);
  });

  it('returns higher VD for smaller cables', () => {
    const large = calculateVoltageDrop(100, 50, 35, 0.85, true, 400);
    const small = calculateVoltageDrop(100, 50, 10, 0.85, true, 400);
    expect(small.dropPercent).toBeGreaterThan(large.dropPercent);
  });

  it('clamps powerFactor to [0.1, 1.0] without throwing', () => {
    const resultHigh = calculateVoltageDrop(100, 50, 35, 1.5, true, 400);
    const resultOne = calculateVoltageDrop(100, 50, 35, 1.0, true, 400);
    expect(resultHigh.dropPercent).toBe(resultOne.dropPercent);
  });

  it('throws CalculationError for negative current or non-positive length, cableSize, or voltage', () => {
    expect(() => calculateVoltageDrop(-1, 50, 35, 0.85, true, 400)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, 0, 35, 0.85, true, 400)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, -10, 35, 0.85, true, 400)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, 50, 0, 0.85, true, 400)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, 50, -35, 0.85, true, 400)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, 50, 35, 0.85, true, 0)).toThrow(CalculationError);
    expect(() => calculateVoltageDrop(100, 50, 35, 0.85, true, -400)).toThrow(CalculationError);
  });
});

describe('STANDARD_BREAKERS', () => {
  it('contains standard ratings', () => {
    expect(STANDARD_BREAKERS).toContain(16);
    expect(STANDARD_BREAKERS).toContain(32);
    expect(STANDARD_BREAKERS).toContain(63);
    expect(STANDARD_BREAKERS).toContain(100);
    expect(STANDARD_BREAKERS).toContain(200);
    expect(STANDARD_BREAKERS).toContain(400);
    expect(STANDARD_BREAKERS).toContain(800);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < STANDARD_BREAKERS.length; i++) {
      expect(STANDARD_BREAKERS[i]).toBeGreaterThan(STANDARD_BREAKERS[i - 1]);
    }
  });
});
