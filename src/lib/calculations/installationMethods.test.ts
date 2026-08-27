import { describe, it, expect } from 'vitest';
import {
  INSTALLATION_METHODS,
  NEC_INSTALLATION_METHODS,
  resolveReferenceMethod,
  getAmpacity,
  isGroundMethod,
  groundTemperatureDeratingFactor,
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

  it('resolves the extrapolated 400/500 mm² entries in every table (incl. aluminum)', () => {
    // Method C must equal the catalog columns in cablesData.ts exactly.
    expect(getAmpacity(400, 'C', 'XLPE', true)).toBe(690);
    expect(getAmpacity(500, 'C', 'PVC', true)).toBe(578);
    expect(getAmpacity(400, 'C', 'XLPE', false)).toBe(830);
    // Buried methods scale their own 300 mm² column (D2 XLPE: 446 → 535 / 615).
    expect(getAmpacity(400, '72', 'XLPE', true)).toBe(535);
    expect(getAmpacity(500, '72', 'XLPE', true)).toBe(615);
    // Aluminum scales by the catalog al/cu ratio per size.
    const cu = getAmpacity(400, 'C', 'XLPE', true);
    const al = getAmpacity(400, 'C', 'XLPE', true, 'aluminum');
    expect(al).toBe(Math.round(cu * 595 / 690));
    // Derived 1-phase tables extend too (E has no explicit 1PH table).
    expect(getAmpacity(400, 'E', 'XLPE', false)).toBeGreaterThan(0);
  });

  it('resolves ampacity for every reference code, including derived 1-phase tables', () => {
    const expectedCodes = ['A1', 'A2', 'B1', 'B2', 'C', 'E', 'F', 'G', 'D1', 'D2'];
    for (const code of expectedCodes) {
      // 3-phase
      expect(getAmpacity(50, code, 'XLPE', true)).toBeGreaterThan(0);
      expect(getAmpacity(50, code, 'PVC', true)).toBeGreaterThan(0);
      // 1-phase — explicit (A1/B1/C) or derived from the 3-phase table × C ratio
      expect(getAmpacity(50, code, 'XLPE', false)).toBeGreaterThan(0);
      expect(getAmpacity(50, code, 'PVC', false)).toBeGreaterThan(0);
    }
  });

  it('derives missing 1-phase tables with the C-table shape (2 loaded conductors run above 3)', () => {
    // Method E has no published 1PH table here: derived = E_3PH × (C_1PH/C_3PH).
    // 50 mm² XLPE: E=193A, C ratio 207/179 ≈ 1.1565 → round(193×1.1565) = 223.
    expect(getAmpacity(50, 'E', 'XLPE', false)).toBe(223);
    // Like every explicit IEC pair (C: 107 vs 96 @ 16 mm²), the derived
    // "2-loaded-conductor" column sits ABOVE the same method's 3-phase column.
    for (const size of [16, 70, 150]) {
      expect(getAmpacity(size, 'E', 'XLPE', false)).toBeGreaterThanOrEqual(getAmpacity(size, 'E', 'XLPE', true));
    }
    // And tracks the C-ratio per size exactly.
    const cRatio70 = getAmpacity(70, 'C', 'PVC', false) / getAmpacity(70, 'C', 'PVC', true);
    expect(getAmpacity(70, 'E', 'PVC', false)).toBe(Math.round(getAmpacity(70, 'E', 'PVC', true) * cRatio70));
  });

  it('flags ground methods and uses the 20°C-soil correction table', () => {
    expect(isGroundMethod('72')).toBe(true);
    expect(isGroundMethod('D2')).toBe(true);
    expect(isGroundMethod('31-E')).toBe(false);
    expect(isGroundMethod(undefined)).toBe(false);

    // BS 7671 Table 4B2 / IEC B.52.15 reference points.
    expect(groundTemperatureDeratingFactor('XLPE', 20)).toBeCloseTo(1.0);
    expect(groundTemperatureDeratingFactor('XLPE', 30)).toBeCloseTo(0.93);
    expect(groundTemperatureDeratingFactor('PVC', 30)).toBeCloseTo(0.90);
    // Interpolated between steps: XLPE 27 °C → 0.96 + (0.93-0.96)·(2/5) = 0.948.
    expect(groundTemperatureDeratingFactor('XLPE', 27)).toBeCloseTo(0.948);
    // Ground factors must be stricter than the air table at the same ambient.
    expect(groundTemperatureDeratingFactor('XLPE', 40)).toBeLessThan(
      0.91 // air-table XLPE factor at 40 °C
    );
  });
});

describe('NEC / NEMA (NFPA 70) Installation Methods and Ampacity Tables', () => {
  it('defines 13 NEC wiring methods across all standard categories', () => {
    expect(NEC_INSTALLATION_METHODS.length).toBe(13);

    const raceway = NEC_INSTALLATION_METHODS.find((m) => m.id === 'NEC-1');
    expect(raceway).toBeDefined();
    expect(raceway?.refMethod).toBe('310.16');
    expect(raceway?.category).toBe('conduit');

    const tray = NEC_INSTALLATION_METHODS.find((m) => m.id === 'NEC-4');
    expect(tray).toBeDefined();
    expect(tray?.refMethod).toBe('392.80(A)');
    expect(tray?.category).toBe('tray');

    const spacedTray = NEC_INSTALLATION_METHODS.find((m) => m.id === 'NEC-5');
    expect(spacedTray).toBeDefined();
    expect(spacedTray?.refMethod).toBe('310.17');

    const directBuried = NEC_INSTALLATION_METHODS.find((m) => m.id === 'NEC-10');
    expect(directBuried).toBeDefined();
    expect(directBuried?.category).toBe('ground');

    const ductBank = NEC_INSTALLATION_METHODS.find((m) => m.id === 'NEC-11');
    expect(ductBank).toBeDefined();
    expect(ductBank?.refMethod).toBe('310.20');
    expect(ductBank?.category).toBe('ground');
  });

  it('resolves reference method codes for NEC and cross-standard lookups', () => {
    expect(resolveReferenceMethod('NEC-1', 'NEMA')).toBe('310.16');
    expect(resolveReferenceMethod('NEC-4', 'NEMA')).toBe('392.80(A)');
    expect(resolveReferenceMethod('NEC-5', 'NEMA')).toBe('310.17');
    expect(resolveReferenceMethod('NEC-11', 'NEMA')).toBe('310.20');

    // Mappings from IEC codes to NEC equivalents when NEMA is active
    expect(resolveReferenceMethod('C', 'NEMA')).toBe('310.16');
    expect(resolveReferenceMethod('E', 'NEMA')).toBe('392.80(A)');
    expect(resolveReferenceMethod('G', 'NEMA')).toBe('310.17');
    expect(resolveReferenceMethod('D1', 'NEMA')).toBe('310.20');
  });

  it('looks up exact NEC Table 310.16 ampacities for copper and aluminum', () => {
    // Copper 90°C (XLPE / THHN)
    expect(getAmpacity(1.5, 'NEC-1', 'XLPE', true, 'copper', 'NEMA')).toBe(25); // 14 AWG
    expect(getAmpacity(2.5, 'NEC-1', 'XLPE', true, 'copper', 'NEMA')).toBe(30); // 12 AWG
    expect(getAmpacity(4, 'NEC-1', 'XLPE', true, 'copper', 'NEMA')).toBe(40);   // 10 AWG
    expect(getAmpacity(50, 'NEC-1', 'XLPE', true, 'copper', 'NEMA')).toBe(170); // 1/0 AWG
    expect(getAmpacity(240, 'NEC-1', 'XLPE', true, 'copper', 'NEMA')).toBe(430); // 500 kcmil

    // Copper 75°C (PVC / THWN)
    expect(getAmpacity(1.5, 'NEC-1', 'PVC', true, 'copper', 'NEMA')).toBe(20);
    expect(getAmpacity(50, 'NEC-1', 'PVC', true, 'copper', 'NEMA')).toBe(150);
    expect(getAmpacity(240, 'NEC-1', 'PVC', true, 'copper', 'NEMA')).toBe(380);

    // Aluminum 90°C
    expect(getAmpacity(50, 'NEC-1', 'XLPE', true, 'aluminum', 'NEMA')).toBe(135);
    expect(getAmpacity(240, 'NEC-1', 'XLPE', true, 'aluminum', 'NEMA')).toBe(350);
  });

  it('looks up NEC Table 310.17 Free Air and Table 310.20 Duct Bank ampacities', () => {
    // Table 310.17 Free Air (NEC-5 / NEC-8 / NEC-9)
    expect(getAmpacity(50, 'NEC-8', 'XLPE', true, 'copper', 'NEMA')).toBe(260);
    expect(getAmpacity(240, 'NEC-8', 'XLPE', true, 'copper', 'NEMA')).toBe(700);

    // NEC-6 (Single conductors touching in tray = 65% of Table 310.17)
    expect(getAmpacity(50, 'NEC-6', 'XLPE', true, 'copper', 'NEMA')).toBe(Math.round(260 * 0.65)); // 169

    // Table 310.20 Underground Duct Bank (NEC-11)
    expect(getAmpacity(50, 'NEC-11', 'XLPE', true, 'copper', 'NEMA')).toBe(175);
    expect(getAmpacity(240, 'NEC-11', 'XLPE', true, 'copper', 'NEMA')).toBe(416);
  });

  it('recognizes NEC underground methods as ground methods', () => {
    expect(isGroundMethod('NEC-10', 'NEMA')).toBe(true);
    expect(isGroundMethod('NEC-11', 'NEMA')).toBe(true);
    expect(isGroundMethod('NEC-1', 'NEMA')).toBe(false);
    expect(isGroundMethod('NEC-4', 'NEMA')).toBe(false);
  });
});

