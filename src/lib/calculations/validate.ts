/**
 * Shared validation helpers and error types for calculation engine.
 */

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
    Object.setPrototypeOf(this, CalculationError.prototype);
  }
}

/**
 * Clamps power factor to [0.1, 1.0].
 * If pf is not a finite number, defaults to 0.85.
 */
export function clampPowerFactor(pf: number): number {
  if (typeof pf !== 'number' || Number.isNaN(pf) || !Number.isFinite(pf)) {
    return 0.85;
  }
  return Math.max(0.1, Math.min(1.0, pf));
}

/**
 * Asserts that a numeric value is strictly positive (> 0) and finite.
 */
export function assertPositive(name: string, value: number): void {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    throw new CalculationError(`${name} must be greater than 0, received ${value}`);
  }
}

/**
 * Asserts that a numeric value is non-negative (>= 0) and finite.
 */
export function assertNonNegative(name: string, value: number): void {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
    throw new CalculationError(`${name} must be greater than or equal to 0, received ${value}`);
  }
}

/**
 * Asserts that a numeric value is within [min, max] inclusive.
 */
export function assertInRange(name: string, value: number, min: number, max: number): void {
  if (
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new CalculationError(`${name} must be between ${min} and ${max}, received ${value}`);
  }
}

/**
 * Asserts that a value is one of the allowed choices.
 */
export function assertOneOf<T>(name: string, value: T, allowed: readonly T[]): void {
  if (!allowed.includes(value)) {
    throw new CalculationError(
      `${name} must be one of [${allowed.join(', ')}], received ${String(value)}`
    );
  }
}

export interface ProjectElectricalSettings {
  voltage?: number;
  frequency?: number;
  powerFactor?: number;
  maxDemandFactor?: number;
  maxVoltageDropLighting?: number;
  maxVoltageDropPower?: number;
}

/**
 * Validates physical electrical boundaries for project settings.
 * Enforces physical limits (e.g. 0.1 <= PF <= 1.0, 100 <= V <= 1000)
 * to prevent downstream corruption across calculation engines.
 */
export function validateProjectSettings(settings: ProjectElectricalSettings): void {
  if (settings.voltage !== undefined) {
    assertInRange('voltage', settings.voltage, 100, 1000);
  }
  if (settings.frequency !== undefined) {
    assertInRange('frequency', settings.frequency, 45, 65);
  }
  if (settings.powerFactor !== undefined) {
    if (
      typeof settings.powerFactor !== 'number' ||
      Number.isNaN(settings.powerFactor) ||
      settings.powerFactor < 0.1 ||
      settings.powerFactor > 1.0
    ) {
      throw new CalculationError(
        `powerFactor must be between 0.10 and 1.00, received ${settings.powerFactor}`
      );
    }
  }
  if (settings.maxDemandFactor !== undefined) {
    assertInRange('maxDemandFactor', settings.maxDemandFactor, 0.05, 1.50);
  }
  if (settings.maxVoltageDropLighting !== undefined) {
    assertInRange('maxVoltageDropLighting', settings.maxVoltageDropLighting, 0.1, 20);
  }
  if (settings.maxVoltageDropPower !== undefined) {
    assertInRange('maxVoltageDropPower', settings.maxVoltageDropPower, 0.1, 20);
  }
}

