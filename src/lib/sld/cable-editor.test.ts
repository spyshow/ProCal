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

  it('correctly calculates 2x 300mm2 PVC ampacity (944A = 2x472A under Cg=1.0) for 902.1A load and marks compliant', () => {
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

    expect(result.singleAmpacity).toBe(472); // Method F PVC 300mm2 base = 472A
    expect(result.ampacity).toBe(944); // 2 * 472 = 944A
    expect(result.isOverloaded).toBe(false); // 944 >= 902.1
    expect(result.changed).toBe(false); // already safe, no upsize needed
  });

  it('correctly applies groupingCount 3 (Cg=0.70) across parallel runs', () => {
    const result = recalculateCable({
      current: 902.1,
      isThreePhase: true,
      lengthMeters: 50,
      existingCableSize: '3 × 300 mm²',
      existingRuns: 3,
      powerFactor: 0.85,
      systemVoltage: 400,
      maxVoltageDropPercent: 5,
      method: 'F',
      insulation: 'PVC',
      ambientTemp: 30,
      groupingCount: 3,
      maxCableSize: 300,
    });

    expect(result.singleAmpacity).toBe(330.4); // 472 x 0.70
    expect(result.ampacity).toBe(991.2); // 3 x 472 x 0.70 = 991.2A
    expect(result.isOverloaded).toBe(false); // 991.2 >= 902.1
  });

  it('upsizes to 3x 300mm2 when groupingCount 2 (Cg=0.80) makes 2 runs of 300mm2 insufficient for 902.1A', () => {
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
      groupingCount: 2,
      maxCableSize: 300,
    });

    expect(result.singleAmpacity).toBe(377.6); // 472 x 0.80
    expect(result.ampacity).toBe(1132.8); // steps to 3 runs: 3 x 472 x 0.80 = 1132.8A
    expect(result.parallelRuns).toBe(3);
    expect(result.changed).toBe(true);
    expect(result.isOverloaded).toBe(false);
  });
});
