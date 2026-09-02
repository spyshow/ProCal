import { describe, it, expect } from 'vitest';
import {
  getTripTimeForCurrent,
  generateCurvePoints,
  generateMcbCurve,
  interpolateTripTime,
  calculateCableWithstandTime,
  generateCableDamageCurve,
  checkCableProtection,
  lookupTestedSelectivity,
  verifyCoordination,
  recommendBreakerSettings,
  suggestAlternativeBreaker,
  type BreakerCurveSettings,
} from './selectivity';
import { CalculationError } from './validate';

describe('getTripTimeForCurrent', () => {
  const settings = {
    inRating: 160,
    ir: 128,
    tr: 12,
    isd: 640,
    tsd: 0.1,
    i2t: false,
    ii: 1280,
    ig: 50,
    tg: 0.1,
  };

  it('returns high time for current below Ir', () => {
    const time = getTripTimeForCurrent(settings, 100);
    expect(time).toBeGreaterThan(1000);
  });

  it('calculates long-time trip for overload', () => {
    const time = getTripTimeForCurrent(settings, 200);
    expect(time).toBeGreaterThan(0.01);
    expect(time).toBeLessThan(10000);
  });

  it('trips instantaneously above Ii', () => {
    const time = getTripTimeForCurrent(settings, 1500);
    expect(time).toBe(0.02);
  });

  it('trips in short-time region', () => {
    const time = getTripTimeForCurrent(settings, 700);
    expect(time).toBeLessThan(1);
    expect(time).toBeGreaterThanOrEqual(0.02);
  });

  it('throws CalculationError for negative current or invalid settings', () => {
    expect(() => getTripTimeForCurrent(settings, -1)).toThrow(CalculationError);
    expect(() => getTripTimeForCurrent({ ...settings, inRating: 0 }, 100)).toThrow(CalculationError);
    expect(() => getTripTimeForCurrent({ ...settings, ir: -10 }, 100)).toThrow(CalculationError);
  });
});

describe('getTripTimeForCurrent — MCB uses IEC 60898 curve (not parametric LSI)', () => {
  const mcb = (curveType?: 'B' | 'C' | 'D'): BreakerCurveSettings => ({
    inRating: 32,
    ir: 25,
    tr: 12,
    ii: 320,
    category: 'MCB',
    curveType,
  });

  it('matches the plotted IEC curve exactly (verdict/plot consistency)', () => {
    const curve = generateMcbCurve(32, 'C');
    for (const I of [30, 46.4, 64, 96, 160, 256, 320, 800]) {
      expect(getTripTimeForCurrent(mcb('C'), I))
        .toBeCloseTo(interpolateTripTime(curve, I), 6);
    }
  });

  it('does not trip below 1.05×In and trips within IEC bounds at 1.45×In', () => {
    const s = mcb('C');
    expect(getTripTimeForCurrent(s, 32)).toBe(10000);
    expect(getTripTimeForCurrent(s, 32 * 1.05)).toBe(10000);
    expect(getTripTimeForCurrent(s, 32 * 1.45)).toBeLessThanOrEqual(60);
    expect(getTripTimeForCurrent(s, 32 * 1.45)).toBeGreaterThan(1);
  });

  it('trips magnetically inside the Curve C band (5×–10×In)', () => {
    const s = mcb('C');
    expect(getTripTimeForCurrent(s, 32 * 5)).toBeLessThanOrEqual(0.05);
    expect(getTripTimeForCurrent(s, 32 * 10)).toBeLessThanOrEqual(0.02);
  });

  it('honors Curve B (magnetic from 3×In) and Curve D (magnetic from 10×In)', () => {
    expect(getTripTimeForCurrent(mcb('B'), 32 * 3)).toBeLessThanOrEqual(0.05);
    // Curve D must NOT trip magnetically at 5×In
    expect(getTripTimeForCurrent(mcb('D'), 32 * 5)).toBeGreaterThan(0.05);
    expect(getTripTimeForCurrent(mcb('D'), 32 * 10)).toBeLessThanOrEqual(0.05);
  });

  it('explicit curveData still wins over the generated MCB curve', () => {
    const custom: BreakerCurveSettings = {
      ...mcb('C'),
      curveData: [
        { current: 100, time: 5 },
        { current: 1000, time: 0.1 },
      ],
    };
    expect(getTripTimeForCurrent(custom, 100)).toBe(5);
  });

  it('non-MCB settings without curveData still use the parametric LSI model', () => {
    const lsi: BreakerCurveSettings = { inRating: 32, ir: 32, tr: 12, category: 'MCCB' };
    // t = tr·36/((I/Ir)²−1) at 2×Ir = 12·36/3 = 144s
    expect(getTripTimeForCurrent(lsi, 64)).toBeCloseTo(144, 1);
  });
});

describe('generateMcbCurve & IEC 60898 Curves', () => {
  it('generates valid MCB Curve C data points', () => {
    const curve = generateMcbCurve(32, 'C');
    expect(curve.length).toBeGreaterThan(5);
    // Non-trip at 1.05 In
    expect(curve[0].current).toBe(32 * 1.05);
    expect(curve[0].time).toBe(10000);
    // Instantaneous magnetic trip at 5x - 10x In
    const magPoint = curve.find((p) => p.current === 32 * 5);
    expect(magPoint).toBeDefined();
    expect(magPoint!.time).toBeLessThanOrEqual(0.05);
  });

  it('generates Curve B with lower magnetic threshold (3x - 5x In)', () => {
    const curveB = generateMcbCurve(20, 'B');
    const magPointB = curveB.find((p) => p.current === 20 * 3);
    expect(magPointB).toBeDefined();
    expect(magPointB!.time).toBeLessThanOrEqual(0.05);
  });

  it('generates Curve D with high magnetic threshold (10x - 20x In)', () => {
    const curveD = generateMcbCurve(20, 'D');
    const magPointD = curveD.find((p) => p.current === 20 * 10);
    expect(magPointD).toBeDefined();
    expect(magPointD!.time).toBeLessThanOrEqual(0.05);
  });
});

describe('interpolateTripTime (Log-Log Interpolation)', () => {
  const samplePoints = [
    { current: 100, time: 1000 },
    { current: 200, time: 100 },
    { current: 1000, time: 1 },
    { current: 5000, time: 0.02 },
  ];

  it('interpolates accurately on log-log coordinates between points', () => {
    const timeAt100 = interpolateTripTime(samplePoints, 100);
    expect(timeAt100).toBe(1000);

    const timeAt200 = interpolateTripTime(samplePoints, 200);
    expect(timeAt200).toBe(100);

    // Midpoint on log scale between 100 (1000s) and 200 (100s)
    const timeAt150 = interpolateTripTime(samplePoints, 150);
    expect(timeAt150).toBeLessThan(1000);
    expect(timeAt150).toBeGreaterThan(100);
  });

  it('handles boundaries (below minimum, above maximum)', () => {
    expect(interpolateTripTime(samplePoints, 50)).toBe(1000);
    expect(interpolateTripTime(samplePoints, 10000)).toBe(0.02);
  });
});

describe('Cable Thermal Withstand (IEC 60364-4-43 Table 43.1)', () => {
  it('calculates adiabatic damage time t = (k*S/I)^2', () => {
    // Copper + XLPE (k = 143), S = 50mm², I = 5000A
    // t = (143 * 50 / 5000)^2 = (7150 / 5000)^2 = (1.43)^2 = 2.0449 s
    const t = calculateCableWithstandTime(50, 5000, 'copper', 'XLPE');
    expect(t).toBeCloseTo(2.0449, 2);
  });

  it('reflects PVC vs XLPE k-factor differences', () => {
    const tXlpe = calculateCableWithstandTime(25, 2000, 'copper', 'XLPE'); // k=143
    const tPvc = calculateCableWithstandTime(25, 2000, 'copper', 'PVC');   // k=115
    expect(tXlpe).toBeGreaterThan(tPvc);
  });

  it('generates valid cable damage curve points', () => {
    const points = generateCableDamageCurve(35, 'copper', 'XLPE');
    expect(points.length).toBeGreaterThan(10);
    for (let i = 1; i < points.length; i++) {
      // Current increases, withstand time decreases
      expect(points[i].current).toBeGreaterThan(points[i - 1].current);
      expect(points[i].time).toBeLessThanOrEqual(points[i - 1].time);
    }
  });

  it('checks whether breaker protects cable properly', () => {
    const breaker = {
      inRating: 63,
      ir: 50,
      tr: 12,
      ii: 630,
    };
    // 16mm² XLPE cable with 63A breaker at 10kA fault -> breaker trips in 20ms, cable withstands > 0.08s
    const safe = checkCableProtection(16, breaker, 10000, 'copper', 'XLPE');
    expect(safe).toBe(true);

    // Severely undersized cable (0.5 mm²) at 25kA -> breaker does not protect in time
    const unsafe = checkCableProtection(0.5, breaker, 25000, 'copper', 'PVC');
    expect(unsafe).toBe(false);
  });

  it('parallel runs multiply the total copper area (numeric and string agree)', () => {
    // t = (k·S/I)², so 4 runs of 16 mm² = 64 mm² total and 16× the
    // withstand time of a single 16 mm² run.
    const at20kA = calculateCableWithstandTime(16, 20000, 'copper', 'XLPE');
    const fourRuns = calculateCableWithstandTime(16, 20000, 'copper', 'XLPE', 4);
    const asString = calculateCableWithstandTime('4 × 16 mm²', 20000, 'copper', 'XLPE');
    const single64 = calculateCableWithstandTime(64, 20000, 'copper', 'XLPE');

    expect(fourRuns).toBe(single64);        // numeric size × runs == total area
    expect(asString).toBe(fourRuns);        // string parse path agrees
    expect(fourRuns).toBeCloseTo(at20kA * 16, 6);
  });

  it('regression: a parallel-run set passes the withstand check a single run fails', () => {
    // Slow long-time breaker: every test point (5×–20×In and the 20 kA fault)
    // trips in the L region in seconds, so the cable's adiabatic withstand is
    // the limiting factor — exactly where ignoring parallel runs used to
    // false-flag a parallel set as unprotected.
    const breaker: BreakerCurveSettings = {
      inRating: 630,
      ir: 480,
      tr: 12,
      category: 'MCCB',
    };

    // Single 25 mm²: withstand ≈ 0.032 s at 20 kA ≪ breaker trip ≈ 0.25 s.
    expect(checkCableProtection(25, breaker, 20000, 'copper', 'XLPE')).toBe(false);

    // 4 × 25 mm² (100 mm² total): withstand clears every test point under the
    // Table 43.1 k=143 (the old -5-54 PE k=176 masked a genuine marginal case
    // at 64 mm² — the 5×In point trips ~10.3 s vs withstand ~8.4 s).
    // The numeric size + runs must behave like the parsed "4 × 25 mm²" string.
    expect(checkCableProtection(25, breaker, 20000, 'copper', 'XLPE', 4)).toBe(true);
    expect(checkCableProtection('4 × 25 mm²', breaker, 20000, 'copper', 'XLPE')).toBe(true);
  });

  it('verifyCoordination threads cableRuns into the cable-damage verdict', () => {
    const upstream: BreakerCurveSettings = {
      inRating: 1000, ir: 800, tr: 12, isd: 4000, tsd: 0.3, ii: 10000, category: 'ACB',
    };
    const downstream: BreakerCurveSettings = {
      inRating: 630, ir: 480, tr: 12, category: 'MCCB',
    };

    const singleRun = verifyCoordination(upstream, downstream, 20000, { cableSizeMm2: 25 });
    const parallel = verifyCoordination(upstream, downstream, 20000, { cableSizeMm2: 25, cableRuns: 4 });

    expect(singleRun.cableDamageOk).toBe(false);
    expect(parallel.cableDamageOk).toBe(true);
  });
});

describe('Tested Manufacturer Selectivity Matrix', () => {
  it('looks up tested ABB / Schneider combinations', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, category: 'ACB' as const };
    const downstream = { inRating: 160, ir: 128, tr: 12, category: 'MCCB' as const };
    const limit = lookupTestedSelectivity(upstream, downstream);
    expect(limit).toBe(50000); // 50 kA
  });

  it('returns null for non-listed pairs', () => {
    const upstream = { inRating: 32, ir: 25, tr: 12, category: 'MCB' as const };
    const downstream = { inRating: 16, ir: 16, tr: 12, category: 'MCB' as const };
    const limit = lookupTestedSelectivity(upstream, downstream);
    expect(limit).toBeNull();
  });
});

describe('generateCurvePoints', () => {
  it('generates 101 points for standard settings', () => {
    const settings = {
      inRating: 160,
      ir: 128,
      tr: 12,
      isd: 640,
      tsd: 0.1,
      i2t: false,
      ii: 1280,
    };
    const points = generateCurvePoints(settings);
    expect(points.length).toBe(101);
  });

  it('points are in ascending current order', () => {
    const settings = {
      inRating: 160,
      ir: 128,
      tr: 12,
    };
    const points = generateCurvePoints(settings);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].current).toBeGreaterThanOrEqual(points[i - 1].current);
    }
  });

  it('time values are within log scale bounds', () => {
    const settings = {
      inRating: 160,
      ir: 128,
      tr: 12,
    };
    const points = generateCurvePoints(settings);
    for (const point of points) {
      expect(point.time).toBeGreaterThanOrEqual(0.01);
      expect(point.time).toBeLessThanOrEqual(10000);
    }
  });

  it('throws CalculationError for invalid settings', () => {
    expect(() => generateCurvePoints({ inRating: 0, ir: 128, tr: 12 })).toThrow(CalculationError);
    expect(() => generateCurvePoints({ inRating: 160, ir: -1, tr: 12 })).toThrow(CalculationError);
  });
});

describe('verifyCoordination (4-Phase Protection Engine)', () => {
  it('returns NONE when upstream Ir <= downstream Ir', () => {
    const upstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800 };
    const downstream = { inRating: 100, ir: 100, tr: 12, isd: 500, tsd: 0.1, ii: 1000 };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(result.status).toBe('NONE');
    expect(result.currentGradingOk).toBe(false);
  });

  it('returns FULL or PARTIAL when upstream is properly graded', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000, category: 'ACB' as const };
    const downstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800, category: 'MCCB' as const };
    const result = verifyCoordination(upstream, downstream, 10000, {
      cableSizeMm2: 35,
      manufacturerPair: { upstreamMfg: 'ABB', downstreamMfg: 'ABB' },
    });
    expect(['FULL', 'PARTIAL']).toContain(result.status);
    expect(result.currentGradingOk).toBe(true);
    expect(result.cableDamageOk).toBe(true);
  });

  it('enables cascading for same manufacturer', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000 };
    const downstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800 };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(result.cascadingSupported).toBe(true);
  });

  it('disables cascading for different manufacturers', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000 };
    const downstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800 };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'SCHNEIDER' });
    expect(result.cascadingSupported).toBe(false);
  });

  it('disables cascading for generic (GENERIC_SPEC) devices even when manufacturer strings match', () => {
    // computeFeeders defaults a generic spec's manufacturer to the project
    // preference, so a generic main + generic branch would otherwise claim the
    // "tested" 10 kA limit purely from same-brand strings.
    const upstream = {
      inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000,
      category: 'ACB' as const, manufacturer: 'ABB', isGeneric: true,
    };
    const downstream = {
      inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800,
      manufacturer: 'ABB', isGeneric: true,
    };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(result.energySelectivityApplied).toBe(false);
    expect(result.cascadingSupported).toBe(false);
    expect(result.cascadingIcu).toBeUndefined();
  });

  it('disables tested selectivity when upstream is generic and downstream is catalog (or vice versa)', () => {
    const upstreamGen: BreakerCurveSettings = {
      inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000,
      category: 'ACB', manufacturer: 'ABB', isGeneric: true,
    };
    const downstreamCat: BreakerCurveSettings = {
      inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800,
      category: 'MCCB', manufacturer: 'ABB', isGeneric: false,
    };
    const res1 = verifyCoordination(upstreamGen, downstreamCat, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(res1.energySelectivityApplied).toBe(false);
    expect(res1.cascadingSupported).toBe(false);

    const upstreamCat: BreakerCurveSettings = {
      inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000,
      category: 'ACB', manufacturer: 'ABB', isGeneric: false,
    };
    const downstreamGen: BreakerCurveSettings = {
      inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800,
      category: 'MCCB', manufacturer: 'ABB', isGeneric: true,
    };
    const res2 = verifyCoordination(upstreamCat, downstreamGen, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(res2.energySelectivityApplied).toBe(false);
    expect(res2.cascadingSupported).toBe(false);
  });

  it('does not assume same-brand tested selectivity when manufacturers are null or generic', () => {
    // MCCB 400A vs MCB 63A at 10 kA fault current:
    // With real ABB catalog devices, tested matrix yields 25 kA (FULL selectivity + cascading supported).
    const catalogUpstream: BreakerCurveSettings = {
      inRating: 400, ir: 320, tr: 12, isd: 1600, tsd: 0.3, ii: 4000,
      category: 'MCCB', manufacturer: 'ABB', isGeneric: false,
    };
    const catalogDownstream: BreakerCurveSettings = {
      inRating: 63, ir: 50, tr: 12, ii: 630,
      category: 'MCB', manufacturer: 'ABB', isGeneric: false,
    };
    const catalogRes = verifyCoordination(catalogUpstream, catalogDownstream, 10000, {
      manufacturerPair: { upstreamMfg: 'ABB', downstreamMfg: 'ABB' },
    });
    expect(catalogRes.energySelectivityApplied).toBe(true);
    expect(catalogRes.cascadingSupported).toBe(true);
    expect(catalogRes.status).toBe('FULL');

    // With generic specs, tested tables are skipped -> selectivity is limited by magnetic crossover (4.0 kA < 10 kA).
    const genericUpstream: BreakerCurveSettings = {
      inRating: 400, ir: 320, tr: 12, isd: 1600, tsd: 0.3, ii: 4000,
      category: 'MCCB', manufacturer: undefined, isGeneric: true,
    };
    const genericDownstream: BreakerCurveSettings = {
      inRating: 63, ir: 50, tr: 12, ii: 630,
      category: 'MCB', manufacturer: undefined, isGeneric: true,
    };
    const genericRes = verifyCoordination(genericUpstream, genericDownstream, 10000, {});
    expect(genericRes.energySelectivityApplied).toBe(false);
    expect(genericRes.cascadingSupported).toBe(false);
    expect(genericRes.status).toBe('PARTIAL');
    expect(genericRes.limitCurrent).toBeGreaterThanOrEqual(4000);
    expect(genericRes.limitCurrent).toBeLessThan(10000);
  });

  it('throws CalculationError for negative fault current', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12 };
    const downstream = { inRating: 100, ir: 80, tr: 12 };
    expect(() => verifyCoordination(upstream, downstream, -100, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' })).toThrow(CalculationError);
  });

  it('MCCB vs MCB: verdict computed on the IEC MCB curve (mixed brands, no tested table)', () => {
    // SMDB riser MCCB 160A vs 32A Curve-C MCB branch — as built by computeFeeders.
    const upstream = {
      inRating: 160, ir: 128, tr: 12, isd: 640, tsd: 0.1, ii: 1600,
      category: 'MCCB' as const, manufacturer: 'ABB',
    };
    const downstream = {
      inRating: 32, ir: 20, tr: 12, ii: 320,
      category: 'MCB' as const, curveType: 'C' as const, manufacturer: 'SCHNEIDER',
    };
    const result = verifyCoordination(upstream, downstream, 800, {
      cableSizeMm2: 4,
      cableMaterial: 'copper',
      cableInsulation: 'XLPE',
    });
    expect(result.currentGradingOk).toBe(true);
    // On the IEC 60898 curve the MCB is magnetic (≤40 ms) at 10×In = 320 A,
    // so the time margin vs the MCCB is huge; the old parametric model gave
    // ~1.7 s there.
    expect(result.timeGradingOk).toBe(true);
    // The first real crossover is the upstream instantaneous (~1.6 kA), not
    // inside the MCB overload band. The old model intersected at the MCCB's
    // isd (640 A) because the parametric MCB was still ~0.4 s slow there —
    // that flipped this 800 A case to PARTIAL.
    expect(result.status).toBe('FULL');
    expect(result.limitCurrent!).toBeGreaterThanOrEqual(1500);
    // MCB magnetic trip (≤40 ms) protects the 4 mm² cable at every test
    // point up to the 800 A fault level.
    expect(result.cableDamageOk).toBe(true);
  });

  it('demotes FULL to PARTIAL when the 1.6× current-grading rule is violated', () => {
    // Ir ratio 320/240 = 1.33 < 1.6 → current grading violated, yet the curve
    // intersection (~4.1 kA) clears the 3 kA fault level — the old verdict
    // reported FULL while carrying currentGradingOk: false.
    const upstream = {
      inRating: 400, ir: 320, tr: 12, isd: 1600, tsd: 0.3, ii: 4000,
      category: 'MCCB' as const,
    };
    const downstream = {
      inRating: 250, ir: 240, tr: 12, isd: 1000, tsd: 0.1, ii: 2500,
      category: 'MCCB' as const,
    };
    const result = verifyCoordination(upstream, downstream, 3000, { cableSizeMm2: 120 });
    expect(result.currentGradingOk).toBe(false);
    expect(result.timeGradingOk).toBe(true);
    expect(result.status).toBe('PARTIAL');
    expect(result.overlapDetails).toMatch(/Grading rules violated/);
  });

  it('evaluates current grading boundary (1.58x vs 1.60x) correctly (Boundary Grading)', () => {
    const downstream = {
      inRating: 100, ir: 100, tr: 12, isd: 500, tsd: 0.1, ii: 1000, category: 'MCCB' as const,
    };

    // 158A < 100A * 1.59 -> violates current grading
    const upstreamFail = {
      inRating: 250, ir: 158, tr: 12, isd: 1000, tsd: 0.4, ii: 2500, category: 'MCCB' as const,
    };
    const resFail = verifyCoordination(upstreamFail, downstream, 2000, { cableSizeMm2: 35 });
    expect(resFail.currentGradingOk).toBe(false);

    // 160A >= 100A * 1.59 -> satisfies current grading
    const upstreamPass = {
      inRating: 250, ir: 160, tr: 12, isd: 1000, tsd: 0.4, ii: 2500, category: 'MCCB' as const,
    };
    const resPass = verifyCoordination(upstreamPass, downstream, 2000, { cableSizeMm2: 35 });
    expect(resPass.currentGradingOk).toBe(true);
  });

  it('strictly isolates generic specs from tested selectivity tables even if same brand is selected', () => {
    const catalogUpstream = {
      inRating: 400, ir: 320, tr: 12, isd: 1600, tsd: 0.3, ii: 4000,
      category: 'MCCB' as const, manufacturer: 'ABB', isGeneric: false,
    };
    const catalogDownstream = {
      inRating: 63, ir: 50, tr: 12, ii: 630,
      category: 'MCB' as const, manufacturer: 'ABB', isGeneric: false,
    };
    const catalogRes = verifyCoordination(catalogUpstream, catalogDownstream, 10000, {
      manufacturerPair: { upstreamMfg: 'ABB', downstreamMfg: 'ABB' },
    });
    expect(catalogRes.energySelectivityApplied).toBe(true);
    expect(catalogRes.cascadingSupported).toBe(true);

    const genericUpstream = { ...catalogUpstream, isGeneric: true };
    const genericRes = verifyCoordination(genericUpstream, catalogDownstream, 10000, {
      manufacturerPair: { upstreamMfg: 'ABB', downstreamMfg: 'ABB' },
    });
    expect(genericRes.energySelectivityApplied).toBe(false);
    expect(genericRes.cascadingSupported).toBe(false);
  });
});

describe('recommendBreakerSettings', () => {
  it('generates valid settings', () => {
    const settings = recommendBreakerSettings(100, 150, 160);
    expect(settings.inRating).toBe(160);
    expect(settings.ir).toBeGreaterThanOrEqual(100);
    expect(settings.ir).toBeLessThanOrEqual(160);
    expect(settings.tr).toBeGreaterThan(0);
  });

  it('Ir is bounded by In and cable ampacity', () => {
    const settings = recommendBreakerSettings(80, 100, 100);
    expect(settings.ir).toBeLessThanOrEqual(100);
    expect(settings.ir).toBeGreaterThanOrEqual(80);
  });

  it('generates Isd as multiple of Ir', () => {
    const settings = recommendBreakerSettings(100, 150, 160);
    expect(settings.isd).toBe(settings.ir * 5);
  });

  it('throws CalculationError for invalid inputs', () => {
    expect(() => recommendBreakerSettings(-10, 150, 160)).toThrow(CalculationError);
    expect(() => recommendBreakerSettings(100, 0, 160)).toThrow(CalculationError);
    expect(() => recommendBreakerSettings(100, 150, 0)).toThrow(CalculationError);
  });
});

describe('suggestAlternativeBreaker', () => {
  it('suggests upstream upgrade when current grading is violated', () => {
    const upstream = { inRating: 400, ir: 300, tr: 12, manufacturer: 'Schneider' };
    const downstream = { inRating: 400, ir: 254.7, tr: 12, manufacturer: 'Schneider', category: 'MCCB' as const };
    const suggestions = suggestAlternativeBreaker(upstream, downstream, 20000, {
      downstreamLoadCurrent: 254.7,
      parentFeederName: 'F1 – SMDB',
      preferredManufacturer: 'Schneider',
    });

    expect(suggestions.length).toBeGreaterThan(0);
    const upstreamSug = suggestions.find((s) => s.type === 'UPSTREAM_UPGRADE');
    expect(upstreamSug).toBeDefined();
    expect(upstreamSug?.suggestedFrameSize).toBeGreaterThanOrEqual(630);
    expect(upstreamSug?.suggestedModel).toContain('NSX630');
    expect(upstreamSug?.expectedSelectivity).toBe('FULL');
  });

  it('suggests direct MDB feed for heavy loads in SMDB sub-panels', () => {
    const upstream = { inRating: 250, ir: 200, tr: 12 };
    const downstream = { inRating: 250, ir: 203.8, tr: 12, category: 'MCCB' as const };
    const suggestions = suggestAlternativeBreaker(upstream, downstream, 19000, {
      downstreamLoadCurrent: 203.8,
      parentFeederName: 'F2 – SMDB',
    });

    const directFeedSug = suggestions.find((s) => s.type === 'DIRECT_MDB_FEED');
    expect(directFeedSug).toBeDefined();
    expect(directFeedSug?.title).toContain('Main Incomer');
  });

  it('suggests LSI delay tuning and electronic trip unit upgrade', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000, manufacturer: 'ABB' };
    const downstream = { inRating: 250, ir: 160, tr: 12, manufacturer: 'ABB', category: 'MCCB' as const };
    const suggestions = suggestAlternativeBreaker(upstream, downstream, 15000, {
      downstreamLoadCurrent: 160,
      preferredManufacturer: 'ABB',
    });

    const lsiSug = suggestions.find((s) => s.type === 'SETTINGS_ADJUSTMENT');
    expect(lsiSug).toBeDefined();
    expect(lsiSug?.suggestedSettings?.tsd).toBe(0.05);

    const tripUnitSug = suggestions.find((s) => s.type === 'ELECTRONIC_TRIP_UNIT');
    expect(tripUnitSug).toBeDefined();
    expect(tripUnitSug?.suggestedModel || tripUnitSug?.title).toContain('Ekip');
  });
});
