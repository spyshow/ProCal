import { describe, it, expect } from 'vitest';
import { recalculateCable } from './cable-editor';

describe('Cable recalculation', () => {
  it('recalculates cable size when length increases', () => {
    const result = recalculateCable({
      current: 21.74,
      isThreePhase: false,
      lengthMeters: 100,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
    });
    expect(result.cableSize).toBeGreaterThanOrEqual(4);
    expect(result.voltageDropPercent).toBeLessThanOrEqual(5);
  });

  it('keeps cable size when within limits', () => {
    const result = recalculateCable({
      current: 21.74,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
    });
    expect(result.voltageDropPercent).toBeLessThanOrEqual(5);
  });

  it('returns correct voltage drop for given length', () => {
    const result = recalculateCable({
      current: 21.74,
      isThreePhase: false,
      lengthMeters: 30,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
    });
    expect(result.voltageDropPercent).toBeGreaterThan(0);
    expect(result.voltageDropPercent).toBeLessThan(10);
  });

  it('derates ampacity when ambient temperature is elevated', () => {
    const standard = recalculateCable({
      current: 25,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
      method: 'C',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });
    const hot = recalculateCable({
      current: 25,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
      method: 'C',
      insulation: 'XLPE',
      ambientTemp: 50,
      groupingCount: 1,
    });
    expect(hot.ampacity).toBeLessThan(standard.ampacity);
  });

  it('derates ampacity when grouping count increases', () => {
    const single = recalculateCable({
      current: 25,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
      method: 'C',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });
    const grouped = recalculateCable({
      current: 25,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
      method: 'C',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 6,
    });
    expect(grouped.ampacity).toBeLessThan(single.ampacity);
  });

  it('triggers upsize when derated ampacity is below required breaker/current', () => {
    // 4mm² in Method C XLPE base = 42A.
    // At ambientTemp=50 (0.82) and grouping=6 (0.57), derating factor = 0.4674 -> ~19.6A.
    // With current=25A (requires at least 32A breaker), 4mm² will not suffice and must upsize.
    const result = recalculateCable({
      current: 25,
      isThreePhase: false,
      lengthMeters: 10,
      existingCableSize: 4,
      powerFactor: 0.85,
      systemVoltage: 230,
      maxVoltageDropPercent: 5,
      method: 'C',
      insulation: 'XLPE',
      ambientTemp: 50,
      groupingCount: 6,
    });
    expect(result.changed).toBe(true);
    expect(result.cableSize).toBeGreaterThan(4);
  });

  it('correctly calculates 2x 300mm2 ampacity (944A = 2x472A) for 902.1A load and marks compliant', () => {
    const result = recalculateCable({
      current: 902.1,
      isThreePhase: true,
      lengthMeters: 50,
      existingCableSize: '2 × 300 mm²',
      existingRuns: 2,
      powerFactor: 0.85,
      systemVoltage: 400,
      maxVoltageDropPercent: 5,
      method: 'F',
      insulation: 'PVC',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 300,
    });

    expect(result.singleAmpacity).toBe(472);
    expect(result.ampacity).toBe(944); // 2 * 472 = 944A
    expect(result.isOverloaded).toBe(false); // 944 >= 902.1
    expect(result.changed).toBe(false); // already safe, no upsize needed
  });

  it('selects 3x 150mm2 when targetRuns is 3, yielding ampacity 915A (3x305A)', () => {
    const result = recalculateCable({
      current: 902.1,
      isThreePhase: true,
      lengthMeters: 50,
      existingCableSize: '2 × 300 mm²',
      existingRuns: 2,
      powerFactor: 0.85,
      systemVoltage: 400,
      maxVoltageDropPercent: 5,
      method: 'F',
      insulation: 'PVC',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 300,
      targetRuns: 3,
    });

    expect(result.parallelRuns).toBe(3);
    expect(result.cableSize).toBe(150);
    expect(result.singleAmpacity).toBe(305);
    expect(result.ampacity).toBe(915); // 3 * 305 = 915A >= 902.1A
    expect(result.formattedCableSize).toBe('3 × 150 mm²');
  });

  it('re-evaluates to 2x 300mm2 (944A) when user switches targetRuns from 3 to 2', () => {
    const result = recalculateCable({
      current: 902.1,
      isThreePhase: true,
      lengthMeters: 50,
      existingCableSize: '3 × 185 mm²',
      existingRuns: 3,
      powerFactor: 0.85,
      systemVoltage: 400,
      maxVoltageDropPercent: 5,
      method: 'F',
      insulation: 'PVC',
      ambientTemp: 30,
      groupingCount: 1,
      maxCableSize: 300,
      targetRuns: 2,
    });

    expect(result.parallelRuns).toBe(2);
    expect(result.cableSize).toBe(300);
    expect(result.singleAmpacity).toBe(472);
    expect(result.ampacity).toBe(944); // 2 * 472 = 944A
    expect(result.formattedCableSize).toBe('2 × 300 mm²');
    expect(result.isOverloaded).toBe(false);
  });
});
