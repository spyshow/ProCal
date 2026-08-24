import { describe, it, expect } from 'vitest';
import {
  sizeCableAndBreaker,
  calculateVoltageDrop,
  STANDARD_BREAKERS,
  evaluateCableProtection,
  calculateCableAmpacity,
  parseCableSize,
  formatCableSize,
  getCableAmpacityColumn,
} from './cables';
import { temperatureDeratingFactor, groupingDeratingFactor, CABLE_CATALOG } from './cablesData';
import { getAmpacity } from './installationMethods';
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

  it('treats core-count notation (4x35+16) as ONE cable: phase core governs, runs = 1', () => {
    // "4x35+16" is a single 4-core cable (35 mm² phases + 16 mm² earth), not
    // four parallel runs — the old parser credited its ampacity ×4.
    expect(parseCableSize('4x35+16')).toEqual({ size: 35, runs: 1, formatted: '35 mm²' });
    expect(parseCableSize('3x95+50')).toEqual({ size: 95, runs: 1, formatted: '95 mm²' });
    expect(parseCableSize('4 X 25 + 16 mm2')).toEqual({ size: 25, runs: 1, formatted: '25 mm²' });
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

  it('counts touching parallel runs in the grouping factor (IEC B.52.17)', () => {
    // 2 runs of the same cable with grouping=1 must derate as a group of 2
    // (×0.80), not ×1.0 — 2 × 96 A = 192 A nominal is only 153.6 A derated.
    const one = sizeCableAndBreaker(100, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, manualBreakerRating: 125,
    });
    expect(one.parallelRuns).toBe(1);
    expect(one.warnings).toEqual([]);

    // Force a 2-run arrangement via targetRuns and check the penalty applies.
    const two = sizeCableAndBreaker(150, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, targetRuns: 2, manualBreakerRating: 160,
    });
    expect(two.parallelRuns).toBe(2);
    expect(two.groupFactor).toBeCloseTo(0.80);
    // 16 mm² XLPE 3PH C = 96 A/run → 2×96×0.80 = 153.6 A < 160 → steps to 25 mm².
    expect(two.cableSize).toBe(25);
  });

  it('uses the published per-method table AND the soil-temperature table for ground methods', () => {
    // D2 direct-buried XLPE 3PH @ 70 mm² = 203 A (table value); the deleted
    // flat-factor path credited 229×1.00 = 229 A (+13 % overrated).
    expect(getAmpacity(70, '72', 'XLPE', true)).toBe(203);
    // Sizing through D2 applies BOTH the real D2 column and the 20 °C-soil
    // correction (30 °C soil → ×0.93): 70 mm² derates to 203×0.93 ≈ 189 A
    // < In 200 A, so the engine correctly steps up to 95 mm²
    // (239×0.93 ≈ 222 A >= 200 A). The old path sized 70 mm² here.
    const result = sizeCableAndBreaker(200, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, installMethod: '72',
    });
    expect(result.breakerSize).toBe(200);
    expect(result.cableSize).toBe(95);
    expect(result.deratedAmpacity).toBeGreaterThanOrEqual(200);
    expect(result.warnings).toEqual([]);
  });

  it('emits warnings for clamped breakers and catalog-exhausted fallbacks', () => {
    // Beyond-range design current: breaker clamps to the largest frame.
    const clamped = sizeCableAndBreaker(2600, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
    });
    expect(clamped.breakerSize).toBe(2500);
    expect(clamped.warnings.some((w) => w.includes('largest standard breaker'))).toBe(true);

    // Catalog exhausted: even 6 runs cannot reach an unsatisfiable target.
    const exhausted = sizeCableAndBreaker(2500, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 6,
    });
    expect(exhausted.warnings.some((w) => w.includes('Catalog exhausted'))).toBe(true);
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

  it('flags an undersized cable when a main or feeder breaker is upsized (e.g. 400A cable on 630A breaker)', () => {
    // 240 mm² Cu XLPE 3-ph has Iz ≈ 464 A.
    // Paired with an upsized 630 A breaker, Iz (464 A) < In (630 A), which is unsafe.
    const evalResult = evaluateCableProtection(240, 630, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });

    expect(evalResult.isUnderProtected).toBe(true);
    expect(evalResult.deratedAmpacity).toBeLessThan(630);
    // Sizing recommendation should provide sufficient ampacity (e.g. 2 x 185 mm² or larger single)
    expect(evalResult.recommendedCableSizeFormatted).toBeDefined();
  });
});

describe('calculateCableAmpacity never rounds a size UP', () => {
  it('evaluates a non-standard size at the largest standard size below it', () => {
    const at16 = calculateCableAmpacity(16, true);
    const at18 = calculateCableAmpacity(18, true);
    const at25 = calculateCableAmpacity(25, true);

    // 18 mm² is not a standard size: it must be judged as 16 mm², never 25 mm²
    expect(at18.singleNominalAmpacity).toBe(at16.singleNominalAmpacity);
    expect(at18.singleNominalAmpacity).toBeLessThan(at25.singleNominalAmpacity);
  });

  it('flags a non-standard 18 mm² cable as under-protected against a 100A breaker', () => {
    // The old round-up evaluated 18 mm² as 25 mm² (~119 A) and reported safe.
    const evalResult = evaluateCableProtection(18, 100, true, {
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });
    expect(evalResult.isUnderProtected).toBe(true);
    expect(evalResult.recommendedCableSizeMm2).toBeGreaterThanOrEqual(25);
  });

  it('below-catalog sizes are judged at the smallest catalog entry', () => {
    const at1 = calculateCableAmpacity(1, true);
    const at15 = calculateCableAmpacity(1.5, true);
    expect(at1.singleNominalAmpacity).toBe(at15.singleNominalAmpacity);
  });
});

describe('derating factors interpolate between table entries', () => {
  it('temperature factor interpolates for non-tabulated ambients (XLPE)', () => {
    expect(temperatureDeratingFactor('XLPE', 30)).toBe(1.0);
    expect(temperatureDeratingFactor('XLPE', 35)).toBe(0.96);
    // 32 °C sits 2/5 of the way from 30 (1.00) to 35 (0.96)
    expect(temperatureDeratingFactor('XLPE', 32)).toBeCloseTo(0.984, 5);
    // Never silently 1.0 above the 30 °C reference
    expect(temperatureDeratingFactor('XLPE', 31)).toBeLessThan(1.0);
    expect(temperatureDeratingFactor('XLPE', 34)).toBeLessThan(1.0);
  });

  it('temperature factor interpolates for PVC and clamps outside the table', () => {
    // 42 °C: between 40 (0.87) and 45 (0.79) → 0.87 - 0.08×(2/5)
    expect(temperatureDeratingFactor('PVC', 42)).toBeCloseTo(0.838, 5);
    expect(temperatureDeratingFactor('PVC', 5)).toBe(1.22);
    expect(temperatureDeratingFactor('PVC', 70)).toBe(0.5);
  });

  it('sizing responds to a non-tabulated ambient (32 °C)', () => {
    const opts = {
      material: 'copper' as const, insulation: 'XLPE' as const, groupingCount: 1,
      manualBreakerRating: 96,
    };
    const at30 = sizeCableAndBreaker(96, true, { ...opts, ambientTemp: 30 });
    const at32 = sizeCableAndBreaker(96, true, { ...opts, ambientTemp: 32 });
    // 16 mm² XLPE (96 A) just covers In=96 A at 30 °C but not at 32 °C (×0.984)
    expect(at30.cableSize).toBe(16);
    expect(at32.tempFactor).toBeCloseTo(0.984, 5);
    expect(at32.cableSize).toBe(25);
  });

  it('grouping factor is monotonic for non-tabulated circuit counts', () => {
    expect(groupingDeratingFactor(9)).toBe(0.5);
    expect(groupingDeratingFactor(12)).toBe(0.45);
    expect(groupingDeratingFactor(16)).toBe(0.41);
    expect(groupingDeratingFactor(20)).toBe(0.38);
    // 10 circuits: 1/3 between 9 (0.5) and 12 (0.45)
    expect(groupingDeratingFactor(10)).toBeCloseTo(0.483333, 5);
    // Monotonic: old `?? 0.5` gave 13–15 and 17–19 MORE headroom than 12/16
    let prev = groupingDeratingFactor(1);
    for (let n = 2; n <= 25; n++) {
      const f = groupingDeratingFactor(n);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
    expect(groupingDeratingFactor(25)).toBe(0.38);
    expect(groupingDeratingFactor(0.5)).toBe(1.0);
  });
});

describe('aluminum cables (PVC + XLPE, 1-phase + 3-phase)', () => {
  const opts = (material: 'copper' | 'aluminum', insulation: 'PVC' | 'XLPE') => ({
    material,
    insulation,
    ambientTemp: 30,
    groupingCount: 1,
  });

  it('aluminum 3-phase XLPE uses the alXlpe3Ph column', () => {
    // 120 mm² Al XLPE 3-ph = 276 A nominal (CABLE_CATALOG).
    const amp = calculateCableAmpacity('120 mm²', true, opts('aluminum', 'XLPE'));
    expect(amp.singleNominalAmpacity).toBe(276);
    expect(amp.deratedAmpacity).toBeCloseTo(276, 5);
  });

  it('aluminum PVC 1-phase uses the alPvc1Ph column (not alXlpe3Ph)', () => {
    const amp = calculateCableAmpacity('120 mm²', false, opts('aluminum', 'PVC'));
    expect(amp.singleNominalAmpacity).toBe(231); // alPvc1Ph for 120 mm²
    // The old bug returned alXlpe3Ph (276) for every non-copper combo — 20% optimistic.
    expect(amp.singleNominalAmpacity).toBeLessThan(276);
  });

  it('aluminum 3-phase PVC uses the alPvc3Ph column', () => {
    const amp = calculateCableAmpacity('95 mm²', true, opts('aluminum', 'PVC'));
    expect(amp.singleNominalAmpacity).toBe(177); // alPvc3Ph for 95 mm²
  });

  it('aluminum 1-phase XLPE uses the alXlpe1Ph column', () => {
    const amp = calculateCableAmpacity('95 mm²', false, opts('aluminum', 'XLPE'));
    expect(amp.singleNominalAmpacity).toBe(281); // alXlpe1Ph for 95 mm²
  });

  it('aluminum needs a larger cable than copper for the same breaker', () => {
    const copper = sizeCableAndBreaker(150, true, { ...opts('copper', 'XLPE'), manualBreakerRating: 160 });
    const aluminum = sizeCableAndBreaker(150, true, { ...opts('aluminum', 'XLPE'), manualBreakerRating: 160 });
    expect(copper.cableSize).toBe(50); // copper 50 mm² Iz 179 >= 160
    expect(aluminum.cableSize).toBe(70); // al 50 mm² = 153 < 160 -> 70 mm² (196)
    expect(aluminum.deratedAmpacity).toBeGreaterThanOrEqual(160);
  });

  it('aluminum voltage drop is higher than copper for the same run', () => {
    const copper = calculateVoltageDrop(150, 50, 120, 0.85, true, 400, 1, 'copper');
    const aluminum = calculateVoltageDrop(150, 50, 120, 0.85, true, 400, 1, 'aluminum');
    expect(aluminum.dropPercent).toBeGreaterThan(copper.dropPercent);
    // Ratio ~= 0.0283 / 0.0172 (resistance scaling; reactance is identical)
    expect(aluminum.dropPercent / copper.dropPercent).toBeGreaterThan(1.5);
    expect(aluminum.dropPercent / copper.dropPercent).toBeLessThan(1.7);
  });

  it('aluminum sizing respects PVC 1-phase column (bigger cable than XLPE 3-phase)', () => {
    const al = sizeCableAndBreaker(200, false, { ...opts('aluminum', 'PVC'), manualBreakerRating: 250 });
    expect(al.deratedAmpacity).toBeGreaterThanOrEqual(250);
    // Same load as copper XLPE 3-ph would need less; the conservative combo
    // (PVC + 1-phase + aluminum) must not come out smaller than copper XLPE.
    const cu = sizeCableAndBreaker(200, false, { ...opts('copper', 'XLPE'), manualBreakerRating: 250 });
    expect(al.cableSize).toBeGreaterThanOrEqual(cu.cableSize);
  });

  it('getCableAmpacityColumn correctly returns all 8 material × insulation × phase combinations (Issue 8)', () => {
    const spec = CABLE_CATALOG.find((c) => c.size === 70)!;
    expect(spec).toBeDefined();

    // Copper
    expect(getCableAmpacityColumn(spec, 'copper', 'PVC', true)).toBe(spec.copperPvc3Ph);
    expect(getCableAmpacityColumn(spec, 'copper', 'XLPE', true)).toBe(spec.copperXlpe3Ph);
    expect(getCableAmpacityColumn(spec, 'copper', 'PVC', false)).toBe(spec.copperPvc1Ph);
    expect(getCableAmpacityColumn(spec, 'copper', 'XLPE', false)).toBe(spec.copperXlpe1Ph);

    // Aluminum
    expect(getCableAmpacityColumn(spec, 'aluminum', 'PVC', true)).toBe(spec.alPvc3Ph);
    expect(getCableAmpacityColumn(spec, 'aluminum', 'XLPE', true)).toBe(spec.alXlpe3Ph);
    expect(getCableAmpacityColumn(spec, 'aluminum', 'PVC', false)).toBe(spec.alPvc1Ph);
    expect(getCableAmpacityColumn(spec, 'aluminum', 'XLPE', false)).toBe(spec.alXlpe1Ph);

    // Verify ordering: 1-phase > 3-phase, and XLPE > PVC, and copper > aluminum
    expect(spec.copperXlpe3Ph).toBeGreaterThan(spec.copperPvc3Ph);
    expect(spec.copperXlpe1Ph).toBeGreaterThan(spec.copperXlpe3Ph);
    expect(spec.alXlpe3Ph).toBeGreaterThan(spec.alPvc3Ph);
    expect(spec.alXlpe1Ph).toBeGreaterThan(spec.alXlpe3Ph);
    expect(spec.copperXlpe3Ph).toBeGreaterThan(spec.alXlpe3Ph);
    expect(spec.copperPvc3Ph).toBeGreaterThan(spec.alPvc3Ph);
  });

  it('getAmpacity handles aluminum for various IEC installation methods (B1, C, E, D1)', () => {
    // 70 mm² cable across methods
    const b1_xlpe_3ph_al = getAmpacity(70, 'B1', 'XLPE', true, 'aluminum');
    const b1_pvc_3ph_al = getAmpacity(70, 'B1', 'PVC', true, 'aluminum');
    const b1_xlpe_3ph_cu = getAmpacity(70, 'B1', 'XLPE', true, 'copper');

    expect(b1_xlpe_3ph_al).toBeGreaterThan(0);
    expect(b1_pvc_3ph_al).toBeGreaterThan(0);
    expect(b1_xlpe_3ph_al).toBeGreaterThan(b1_pvc_3ph_al);
    expect(b1_xlpe_3ph_cu).toBeGreaterThan(b1_xlpe_3ph_al);

    const c_xlpe_1ph_al = getAmpacity(70, 'C', 'XLPE', false, 'aluminum');
    const c_pvc_1ph_al = getAmpacity(70, 'C', 'PVC', false, 'aluminum');
    expect(c_xlpe_1ph_al).toBeGreaterThan(c_pvc_1ph_al);
  });
});

