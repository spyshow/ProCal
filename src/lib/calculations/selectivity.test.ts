import { describe, it, expect } from 'vitest';
import {
  getTripTimeForCurrent,
  generateCurvePoints,
  verifyCoordination,
  recommendBreakerSettings,
} from './selectivity';

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
});

describe('generateCurvePoints', () => {
  it('generates 101 points', () => {
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
});

describe('verifyCoordination', () => {
  it('returns NONE when upstream Ir <= downstream Ir', () => {
    const upstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800 };
    const downstream = { inRating: 100, ir: 100, tr: 12, isd: 500, tsd: 0.1, ii: 1000 };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(result.status).toBe('NONE');
  });

  it('returns FULL or PARTIAL when upstream is much larger', () => {
    const upstream = { inRating: 630, ir: 500, tr: 12, isd: 2500, tsd: 0.3, ii: 5000 };
    const downstream = { inRating: 100, ir: 80, tr: 12, isd: 400, tsd: 0.1, ii: 800 };
    const result = verifyCoordination(upstream, downstream, 10000, { upstreamMfg: 'ABB', downstreamMfg: 'ABB' });
    expect(['FULL', 'PARTIAL']).toContain(result.status);
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
});
