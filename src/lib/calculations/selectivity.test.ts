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

describe('Cable Thermal Withstand (IEC 60364-5-54)', () => {
  it('calculates adiabatic damage time t = (k*S/I)^2', () => {
    // Copper + XLPE (k = 176), S = 50mm², I = 5000A
    // t = (176 * 50 / 5000)^2 = (8800 / 5000)^2 = (1.76)^2 = 3.0976 s
    const t = calculateCableWithstandTime(50, 5000, 'copper', 'XLPE');
    expect(t).toBeCloseTo(3.0976, 2);
  });

  it('reflects PVC vs XLPE k-factor differences', () => {
    const tXlpe = calculateCableWithstandTime(25, 2000, 'copper', 'XLPE'); // k=176
    const tPvc = calculateCableWithstandTime(25, 2000, 'copper', 'PVC');   // k=143
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

  it('throws CalculationError for negative fault current', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12 };
    const downstream = { inRating: 100, ir: 80, tr: 12 };
    expect(() => verifyCoordination(upstream, downstream, -100, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' })).toThrow(CalculationError);
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
