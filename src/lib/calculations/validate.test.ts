import { describe, it, expect } from 'vitest';
import {
  CalculationError,
  clampPowerFactor,
  assertPositive,
  assertNonNegative,
  assertInRange,
  assertOneOf,
} from './validate';

describe('Validation Helpers', () => {
  describe('CalculationError', () => {
    it('is instance of Error and CalculationError', () => {
      const err = new CalculationError('invalid value');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CalculationError);
      expect(err.name).toBe('CalculationError');
      expect(err.message).toBe('invalid value');
    });
  });

  describe('clampPowerFactor', () => {
    it('clamps values below 0.1 to 0.1', () => {
      expect(clampPowerFactor(0)).toBe(0.1);
      expect(clampPowerFactor(-0.5)).toBe(0.1);
      expect(clampPowerFactor(0.05)).toBe(0.1);
    });

    it('clamps values above 1.0 to 1.0', () => {
      expect(clampPowerFactor(1.05)).toBe(1.0);
      expect(clampPowerFactor(2.0)).toBe(1.0);
    });

    it('preserves valid power factors', () => {
      expect(clampPowerFactor(0.85)).toBe(0.85);
      expect(clampPowerFactor(0.95)).toBe(0.95);
      expect(clampPowerFactor(1.0)).toBe(1.0);
      expect(clampPowerFactor(0.1)).toBe(0.1);
    });

    it('defaults NaN / non-finite to 0.85', () => {
      expect(clampPowerFactor(NaN)).toBe(0.85);
      expect(clampPowerFactor(Infinity)).toBe(0.85);
    });
  });

  describe('assertPositive', () => {
    it('passes for positive finite numbers', () => {
      expect(() => assertPositive('test', 1)).not.toThrow();
      expect(() => assertPositive('test', 0.0001)).not.toThrow();
    });

    it('throws CalculationError for zero, negative, NaN, or non-finite numbers', () => {
      expect(() => assertPositive('test', 0)).toThrow(CalculationError);
      expect(() => assertPositive('test', -1)).toThrow(CalculationError);
      expect(() => assertPositive('test', NaN)).toThrow(CalculationError);
      expect(() => assertPositive('test', Infinity)).toThrow(CalculationError);
    });
  });

  describe('assertNonNegative', () => {
    it('passes for zero and positive finite numbers', () => {
      expect(() => assertNonNegative('test', 0)).not.toThrow();
      expect(() => assertNonNegative('test', 10)).not.toThrow();
    });

    it('throws CalculationError for negative, NaN, or non-finite numbers', () => {
      expect(() => assertNonNegative('test', -0.001)).toThrow(CalculationError);
      expect(() => assertNonNegative('test', -10)).toThrow(CalculationError);
      expect(() => assertNonNegative('test', NaN)).toThrow(CalculationError);
      expect(() => assertNonNegative('test', -Infinity)).toThrow(CalculationError);
    });
  });

  describe('assertInRange', () => {
    it('passes for numbers within range', () => {
      expect(() => assertInRange('temp', 30, 10, 60)).not.toThrow();
      expect(() => assertInRange('temp', 10, 10, 60)).not.toThrow();
      expect(() => assertInRange('temp', 60, 10, 60)).not.toThrow();
    });

    it('throws CalculationError for numbers outside range', () => {
      expect(() => assertInRange('temp', 9, 10, 60)).toThrow(CalculationError);
      expect(() => assertInRange('temp', 61, 10, 60)).toThrow(CalculationError);
      expect(() => assertInRange('temp', NaN, 10, 60)).toThrow(CalculationError);
    });
  });

  describe('assertOneOf', () => {
    it('passes for allowed values', () => {
      expect(() => assertOneOf('material', 'copper', ['copper', 'aluminum'] as const)).not.toThrow();
    });

    it('throws CalculationError for disallowed values', () => {
      expect(() => assertOneOf('material', 'gold' as unknown as 'copper', ['copper', 'aluminum'] as const)).toThrow(CalculationError);
    });
  });
});
