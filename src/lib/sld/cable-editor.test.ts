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
});
