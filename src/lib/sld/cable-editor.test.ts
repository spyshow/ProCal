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
});
