import { describe, it, expect } from 'vitest';

/**
 * Phase-aware current calculation tests.
 * These verify the formulas used in floor items API and template sizing.
 *
 * 1Φ: I = P_max / V_LN = P_max / 0.23  (230V line-to-neutral)
 * 3Φ: I = P_max / (√3 × V_LL) = P_max / (√3 × 0.4)  (400V line-to-line)
 */

function calculateCurrent(maxDemandKva: number, isThreePhase: boolean): number {
  if (isThreePhase) {
    return maxDemandKva / (Math.sqrt(3) * 0.4);
  }
  return maxDemandKva / 0.23;
}

describe('Phase-aware current calculation', () => {
  it('calculates single-phase current correctly', () => {
    // 5 kVA at 230V = 21.74A
    const current = calculateCurrent(5, false);
    expect(current).toBeCloseTo(21.74, 1);
  });

  it('calculates three-phase current correctly', () => {
    // 15 kVA at 400V = 15 / (√3 × 0.4) = 21.65A
    const current = calculateCurrent(15, true);
    expect(current).toBeCloseTo(21.65, 1);
  });

  it('three-phase current is lower than single-phase for same kVA', () => {
    const kva = 10;
    const singlePhase = calculateCurrent(kva, false);
    const threePhase = calculateCurrent(kva, true);
    // Ratio: V_LN / (√3 × V_LL) = 230 / (1.732 × 400) ≈ 0.332
    expect(threePhase).toBeLessThan(singlePhase);
    expect(threePhase / singlePhase).toBeCloseTo(0.332, 2);
  });

  it('handles zero current', () => {
    expect(calculateCurrent(0, false)).toBe(0);
    expect(calculateCurrent(0, true)).toBe(0);
  });

  it('scales linearly with demand', () => {
    const current5 = calculateCurrent(5, false);
    const current10 = calculateCurrent(10, false);
    expect(current10).toBeCloseTo(current5 * 2, 10);
  });
});

/**
 * Per-phase load calculation tests.
 * For 3Φ: per-phase load = total demand / 3 (balanced assumption)
 * For 1Φ: per-phase load = total demand (all power on one phase)
 */

function calculatePerPhaseLoad(maxDemand: number, isThreePhase: boolean): number {
  if (isThreePhase) {
    return maxDemand / 3;
  }
  return maxDemand;
}

describe('Per-phase load calculation', () => {
  it('divides 3Φ load by 3', () => {
    // 15 kW 3Φ → 5.0 kW per phase
    expect(calculatePerPhaseLoad(15, true)).toBeCloseTo(5.0, 10);
  });

  it('keeps 1Φ load as total', () => {
    // 15 kW 1Φ → 15 kW (all on one phase)
    expect(calculatePerPhaseLoad(15, false)).toBe(15);
  });

  it('handles zero load', () => {
    expect(calculatePerPhaseLoad(0, true)).toBe(0);
    expect(calculatePerPhaseLoad(0, false)).toBe(0);
  });

  it('3Φ per-phase is exactly 1/3 of total', () => {
    const total = 12.75;
    const perPhase = calculatePerPhaseLoad(total, true);
    expect(perPhase * 3).toBeCloseTo(total, 10);
  });
});
