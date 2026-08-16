import { describe, it, expect } from 'vitest';
import {
  INSTALLATION_METHODS,
  resolveReferenceMethod,
  getAmpacity,
  METHOD_AMPACITY_FACTORS,
} from './installationMethods';

describe('IEC 60364-5-52 Installation Methods Catalogue', () => {
  it('contains all methods from the 5-page standard specification', () => {
    expect(INSTALLATION_METHODS.length).toBeGreaterThanOrEqual(58);

    // Verify key landmark methods from the document
    const method1 = INSTALLATION_METHODS.find((m) => m.id === '1');
    expect(method1).toBeDefined();
    expect(method1?.refMethod).toBe('A1');
    expect(method1?.category).toBe('conduit');

    const method4 = INSTALLATION_METHODS.find((m) => m.id === '4');
    expect(method4).toBeDefined();
    expect(method4?.refMethod).toBe('B1');

    const method31E = INSTALLATION_METHODS.find((m) => m.id === '31-E');
    expect(method31E).toBeDefined();
    expect(method31E?.refMethod).toBe('E');
    expect(method31E?.category).toBe('tray');

    const method31FTref = INSTALLATION_METHODS.find((m) => m.id === '31-F-tref');
    expect(method31FTref).toBeDefined();
    expect(method31FTref?.refMethod).toBe('F');

    const method34E = INSTALLATION_METHODS.find((m) => m.id === '34-E');
    expect(method34E).toBeDefined();
    expect(method34E?.refMethod).toBe('E');

    const method70 = INSTALLATION_METHODS.find((m) => m.id === '70');
    expect(method70).toBeDefined();
    expect(method70?.refMethod).toBe('D1');
    expect(method70?.category).toBe('ground');

    const method72 = INSTALLATION_METHODS.find((m) => m.id === '72');
    expect(method72).toBeDefined();
    expect(method72?.refMethod).toBe('D2');
    expect(method72?.category).toBe('ground');
  });

  it('correctly maps various method identifiers to reference methods', () => {
    // Specific compound IDs
    expect(resolveReferenceMethod('31-E')).toBe('E');
    expect(resolveReferenceMethod('31-F-touch')).toBe('F');
    expect(resolveReferenceMethod('31-F-tref')).toBe('F');
    expect(resolveReferenceMethod('70')).toBe('D1');
    expect(resolveReferenceMethod('72')).toBe('D2');
    expect(resolveReferenceMethod('4')).toBe('B1');
    expect(resolveReferenceMethod('1')).toBe('A1');

    // Legacy standard codes
    expect(resolveReferenceMethod('C')).toBe('C');
    expect(resolveReferenceMethod('B1')).toBe('B1');
    expect(resolveReferenceMethod('B2')).toBe('B2');
    expect(resolveReferenceMethod('E')).toBe('E');
    expect(resolveReferenceMethod('F')).toBe('F');
    expect(resolveReferenceMethod('G')).toBe('G');
    expect(resolveReferenceMethod('D1')).toBe('D1');
    expect(resolveReferenceMethod('D2')).toBe('D2');

    // Empty / unknown fallback
    expect(resolveReferenceMethod('')).toBe('C');
  });

  it('calculates accurate ampacities across methods and insulations', () => {
    // 3-Phase XLPE 50mm² under Method C (Reference) = 179A
    const ampC = getAmpacity(50, 'C', 'XLPE', true);
    expect(ampC).toBe(179);

    // 3-Phase XLPE 50mm² under Method 31-E (Perforated tray multicore) = 193A
    const amp31E = getAmpacity(50, '31-E', 'XLPE', true);
    expect(amp31E).toBe(193);

    // 3-Phase XLPE 50mm² under Method 31-F-tref (Trefoil single-core) = 201A
    const amp31F = getAmpacity(50, '31-F-tref', 'XLPE', true);
    expect(amp31F).toBe(201);

    // 3-Phase XLPE 50mm² under Method 1 / A1 (In conduit insulated wall) = 134A
    const amp1 = getAmpacity(50, '1', 'XLPE', true);
    expect(amp1).toBe(134);

    // 3-Phase XLPE 50mm² under Method 70 / D1 (Ground duct) = 148A
    const amp70 = getAmpacity(50, '70', 'XLPE', true);
    expect(amp70).toBe(148);

    // 3-Phase XLPE 50mm² under Method 72 / D2 (Direct buried ground) = 164A
    const amp72 = getAmpacity(50, '72', 'XLPE', true);
    expect(amp72).toBe(164);
  });

  it('has ampacity factors for all reference codes', () => {
    const expectedCodes = ['A1', 'A2', 'B1', 'B2', 'C', 'E', 'F', 'G', 'D1', 'D2'];
    for (const code of expectedCodes) {
      expect(METHOD_AMPACITY_FACTORS[code]).toBeDefined();
      expect(METHOD_AMPACITY_FACTORS[code]).toBeGreaterThan(0);
    }
  });
});
