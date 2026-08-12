import { describe, it, expect } from 'vitest';
import {
  sizeCableAndBreaker,
  calculateVoltageDrop,
  STANDARD_BREAKERS,
  evaluateCableProtection,
  parseCableSize,
  formatCableSize,
} from './cables';
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

describe('parseCableSize and formatCableSize', () => {
  it('parses numbers and single string representations', () => {
    expect(parseCableSize(16)).toEqual({ size: 16, runs: 1, formatted: '16 mm²' });
    expect(parseCableSize('240 mm²')).toEqual({ size: 240, runs: 1, formatted: '240 mm²' });
    expect(parseCableSize('300')).toEqual({ size: 300, runs: 1, formatted: '300 mm²' });
    expect(parseCableSize(null)).toBeNull();
  });

  it('parses parallel runs notation (2 × 240 mm², 2x300, etc.)', () => {
    expect(parseCableSize('2 × 240 mm²')).toEqual({ size: 240, runs: 2, formatted: '2 × 240 mm²' });
    expect(parseCableSize('2x300')).toEqual({ size: 300, runs: 2, formatted: '2 × 300 mm²' });
    expect(parseCableSize('3*(4x185)')).toEqual({ size: 185, runs: 3, formatted: '3 × 185 mm²' });
    expect(parseCableSize('4 * 120 mm2')).toEqual({ size: 120, runs: 4, formatted: '4 × 120 mm²' });
  });

  it('formats single and multi-run cables accurately', () => {
    expect(formatCableSize(300, 1)).toBe('300 mm²');
    expect(formatCableSize(240, 2)).toBe('2 × 240 mm²');
    expect(formatCableSize(185, 3)).toBe('3 × 185 mm²');
  });
});

describe('Parallel multi-conductor sizing in sizeCableAndBreaker', () => {
  it('sizes parallel cables for 900A load exceeding maxCableSize 300mm²', () => {
    const result = sizeCableAndBreaker(900, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 300,
    });

    expect(result.parallelRuns).toBeGreaterThanOrEqual(2);
    expect(result.cableSize).toBeLessThanOrEqual(300);
    expect(result.deratedAmpacity).toBeGreaterThanOrEqual(900);
    expect(result.formattedCableSize).toContain('×');
  });

  it('honors maxCableSize threshold (e.g. 185 mm²)', () => {
    const result = sizeCableAndBreaker(500, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 185,
    });

    expect(result.cableSize).toBeLessThanOrEqual(185);
    expect(result.parallelRuns).toBeGreaterThanOrEqual(2);
    expect(result.deratedAmpacity).toBeGreaterThanOrEqual(500);
  });
});

describe('evaluateCableProtection with parallel runs', () => {
  it('recognizes 2 × 240 mm² as safe for 800A load', () => {
    const evalResult = evaluateCableProtection('2 × 240 mm²', 800, true, {
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });

    // 240mm² single has ~464A. 2 runs = ~928A, which safely protects 800A
    expect(evalResult.parallelRuns).toBe(2);
    expect(evalResult.cableMm2).toBe(240);
    expect(evalResult.deratedAmpacity).toBeGreaterThanOrEqual(800);
    expect(evalResult.isUnderProtected).toBe(false);
  });

  it('recommends multi-conductor parallel runs when breaker exceeds 300 mm² single capacity', () => {
    const evalResult = evaluateCableProtection(300, 900, true, {
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 300,
    });

    expect(evalResult.isUnderProtected).toBe(true);
    expect(evalResult.recommendedParallelRuns).toBeGreaterThanOrEqual(2);
    expect(evalResult.recommendedCableSizeFormatted).toContain('×');
  });
});
