// IEC 60364-5-52 Installation Methods for Cable Sizing
// Current-carrying capacities (Ampacity) in air at 30°C ambient, ground at 20°C ambient

export type MethodCategory = 'conduit' | 'surface' | 'tray' | 'void' | 'ground';

export interface InstallationMethod {
  id: string;
  number: number;
  code: string;
  refMethod: string;
  name: string;
  description: string;
  category: MethodCategory;
}

export const INSTALLATION_METHODS: InstallationMethod[] = [
  // Page 1: Methods 1 - 21
  {
    id: '1',
    number: 1,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 1 (A1)',
    description: 'Insulated conductors or single-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: '2',
    number: 2,
    code: 'A2',
    refMethod: 'A2',
    name: 'Method 2 (A2)',
    description: 'Multi-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: '3',
    number: 3,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 3 (A1)',
    description: 'Multi-core cable direct in a thermally insulated wall',
    category: 'surface',
  },
  {
    id: '4',
    number: 4,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 4 (B1)',
    description: 'Insulated conductors or single-core cables in conduit on a wooden or masonry wall or spaced less than 0.3 × conduit diameter from it',
    category: 'conduit',
  },
  {
    id: '5',
    number: 5,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 5 (B2)',
    description: 'Multi-core cable in conduit on a wooden or masonry wall or spaced less than 0.3 × conduit diameter from it',
    category: 'conduit',
  },
  {
    id: '6',
    number: 6,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 6 (B1)',
    description: 'Insulated conductors or single-core cables in cable trunking on a wooden or masonry wall run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '8',
    number: 8,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 8 (B2)',
    description: 'Multi-core cable in cable trunking on a wooden or masonry wall run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '10',
    number: 10,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 10 (B1)',
    description: 'Insulated conductors or single-core cable in suspended cable trunking',
    category: 'conduit',
  },
  {
    id: '11',
    number: 11,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 11 (B2)',
    description: 'Multi-core cable in suspended cable trunking',
    category: 'conduit',
  },
  {
    id: '12',
    number: 12,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 12 (A1)',
    description: 'Insulated conductors or single-core cable run in mouldings',
    category: 'surface',
  },
  {
    id: '15',
    number: 15,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 15 (A1)',
    description: 'Insulated conductors in conduit or single-core or multi-core cable in architrave',
    category: 'surface',
  },
  {
    id: '16',
    number: 16,
    code: 'A1',
    refMethod: 'A1',
    name: 'Method 16 (A1)',
    description: 'Insulated conductors in conduit or single-core or multi-core cable in window frames',
    category: 'surface',
  },
  {
    id: '20',
    number: 20,
    code: 'C',
    refMethod: 'C',
    name: 'Method 20 (C)',
    description: 'Single-core or multi-core cables fixed on, or spaced less than 0.3 × cable diameter from a wooden or masonry wall',
    category: 'surface',
  },
  {
    id: '21',
    number: 21,
    code: 'C',
    refMethod: 'C',
    name: 'Method 21 (C)',
    description: 'Single-core or multi-core cables fixed directly under a wooden or masonry ceiling',
    category: 'surface',
  },

  // Page 2: Methods 22 - 36
  {
    id: '22',
    number: 22,
    code: 'E',
    refMethod: 'E',
    name: 'Method 22 (E)',
    description: 'Single-core or multi-core cables spaced from a ceiling',
    category: 'surface',
  },
  {
    id: '30',
    number: 30,
    code: 'C',
    refMethod: 'C',
    name: 'Method 30 (C)',
    description: 'Single-core or multi-core cables on unperforated tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '31-F-touch',
    number: 31,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 31 - F (Touching)',
    description: 'Single-core cable on perforated tray run horizontally or vertically (Touching)',
    category: 'tray',
  },
  {
    id: '31-F-tref',
    number: 31,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 31 - F (Trefoil)',
    description: 'Single-core cable on perforated tray run horizontally or vertically (Trefoil)',
    category: 'tray',
  },
  {
    id: '31-E',
    number: 31,
    code: 'E',
    refMethod: 'E',
    name: 'Method 31 - E',
    description: 'Multi-core cable on perforated tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '32-F-touch',
    number: 32,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 32 - F (Touching)',
    description: 'Single-core cable on brackets or on a wire mesh tray run horizontally or vertically (Touching)',
    category: 'tray',
  },
  {
    id: '32-F-tref',
    number: 32,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 32 - F (Trefoil)',
    description: 'Single-core cable on brackets or on a wire mesh tray run horizontally or vertically (Trefoil)',
    category: 'tray',
  },
  {
    id: '32-E',
    number: 32,
    code: 'E',
    refMethod: 'E',
    name: 'Method 32 - E',
    description: 'Multi-core cable on brackets or on a wire mesh tray run horizontally or vertically',
    category: 'tray',
  },
  {
    id: '33-F-touch',
    number: 33,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 33 - F (Touching)',
    description: 'Single-core cable spaced more than 0.3 times cable diameter from a wall (Touching)',
    category: 'surface',
  },
  {
    id: '33-E',
    number: 33,
    code: 'E',
    refMethod: 'E',
    name: 'Method 33 - E',
    description: 'Multi-core cable spaced more than 0.3 times cable diameter from a wall',
    category: 'surface',
  },
  {
    id: '34-F-touch',
    number: 34,
    code: 'F (touch.)',
    refMethod: 'F',
    name: 'Method 34 - F (Touching)',
    description: 'Single-core cable on ladder (Touching)',
    category: 'tray',
  },
  {
    id: '34-F-tref',
    number: 34,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 34 - F (Trefoil)',
    description: 'Single-core cable on ladder (Trefoil)',
    category: 'tray',
  },
  {
    id: '34-E',
    number: 34,
    code: 'E',
    refMethod: 'E',
    name: 'Method 34 - E',
    description: 'Multi-core cable on ladder',
    category: 'tray',
  },
  {
    id: '35-F-tref',
    number: 35,
    code: 'F (tref.)',
    refMethod: 'F',
    name: 'Method 35 - F (Trefoil)',
    description: 'Single-core cable suspended from or incorporating a support wire or harness (Trefoil)',
    category: 'surface',
  },
  {
    id: '35-E',
    number: 35,
    code: 'E',
    refMethod: 'E',
    name: 'Method 35 - E',
    description: 'Multi-core cable suspended from or incorporating a support wire or harness',
    category: 'surface',
  },
  {
    id: '36-G-H',
    number: 36,
    code: 'G (H)',
    refMethod: 'G',
    name: 'Method 36 - G (Horizontal)',
    description: 'Bare or insulated conductors on insulators (Spaced horizontally)',
    category: 'surface',
  },

  // Page 3: Methods 36(V) - 45
  {
    id: '36-G-V',
    number: 36,
    code: 'G (V)',
    refMethod: 'G',
    name: 'Method 36 - G (Vertical)',
    description: 'Bare or insulated conductors on insulators (Spaced vertically)',
    category: 'surface',
  },
  {
    id: '40-B2',
    number: 40,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 40 - B2',
    description: 'Single-core or multi-core cable in a building void (1.5 De ≤ V < 5 De)',
    category: 'void',
  },
  {
    id: '40-B1',
    number: 40,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 40 - B1',
    description: 'Single-core or multi-core cable in a building void (5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '41-B2',
    number: 41,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 41 - B2',
    description: 'Insulated conductors in conduit in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '41-B1',
    number: 41,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 41 - B1',
    description: 'Insulated conductors in conduit in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '42-B2',
    number: 42,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 42 - B2',
    description: 'Single-core or multi-core cable in conduit in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '42-B1',
    number: 42,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 42 - B1',
    description: 'Single-core or multi-core cable in conduit in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '43-B2',
    number: 43,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 43 - B2',
    description: 'Insulated conductors ducting in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '43-B1',
    number: 43,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 43 - B1',
    description: 'Insulated conductors ducting in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '44-B2',
    number: 44,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 44 - B2',
    description: 'Single-core or multi-core cable ducting in a building void (1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '44-B1',
    number: 44,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 44 - B1',
    description: 'Single-core or multi-core cable ducting in a building void (V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '45-B2',
    number: 45,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 45 - B2',
    description: 'Insulated conductors ducting in masonry (thermal resistivity ≤ 2 K·m/W, 1.5 De ≤ V < 5 De)',
    category: 'void',
  },

  // Page 4: Methods 45(B1) - 55
  {
    id: '45-B1',
    number: 45,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 45 - B1',
    description: 'Insulated conductors ducting in masonry (thermal resistivity ≤ 2 K·m/W, 5 De ≤ V < 50 De)',
    category: 'void',
  },
  {
    id: '46-B2',
    number: 46,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 46 - B2',
    description: 'Single-core or multi-core cable in cable ducting in masonry (≤ 2 K·m/W, 1.5 De ≤ V < 20 De)',
    category: 'void',
  },
  {
    id: '46-B1',
    number: 46,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 46 - B1',
    description: 'Single-core or multi-core cable in cable ducting in masonry (≤ 2 K·m/W, V ≥ 20 De)',
    category: 'void',
  },
  {
    id: '47-B2',
    number: 47,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 47 - B2',
    description: 'Single-core or multi-core cable in a ceiling void or raised floor (1.5 De ≤ V < 5 De)',
    category: 'void',
  },
  {
    id: '47-B1',
    number: 47,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 47 - B1',
    description: 'Single-core or multi-core cable in a ceiling void or raised floor (5 De ≤ V < 50 De)',
    category: 'void',
  },
  {
    id: '50',
    number: 50,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 50 (B1)',
    description: 'Insulated conductors or single-core cable in flush cable trunking in the floor',
    category: 'conduit',
  },
  {
    id: '51',
    number: 51,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 51 (B2)',
    description: 'Multi-core cable in flush cable trunking in the floor',
    category: 'conduit',
  },
  {
    id: '52',
    number: 52,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 52 (B1)',
    description: 'Insulated conductors or single-core cables in flush cable trunking',
    category: 'conduit',
  },
  {
    id: '53',
    number: 53,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 53 (B2)',
    description: 'Multi-core cable in flush trunking',
    category: 'conduit',
  },
  {
    id: '54-B2',
    number: 54,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 54 - B2',
    description: 'Insulated conductors or single-core in conduit in unventilated cable channel (1.5 De ≤ V < 20 De)',
    category: 'conduit',
  },
  {
    id: '54-B1',
    number: 54,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 54 - B1',
    description: 'Insulated conductors or single-core in conduit in unventilated cable channel (V ≥ 20 De)',
    category: 'conduit',
  },
  {
    id: '55',
    number: 55,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 55 (B1)',
    description: 'Insulated conductors in conduit in an open or ventilated cable channel run horizontally or vertically',
    category: 'conduit',
  },

  // Page 5: Methods 56 - 73
  {
    id: '56',
    number: 56,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 56 (B1)',
    description: 'Single-core or multi-core cable in an open or ventilated cable channel run horizontally or vertically',
    category: 'conduit',
  },
  {
    id: '57',
    number: 57,
    code: 'C',
    refMethod: 'C',
    name: 'Method 57 (C)',
    description: 'Single-core or multi-core cable direct in masonry having a thermal resistivity not greater than 2 K·m/W',
    category: 'surface',
  },
  {
    id: '58',
    number: 58,
    code: 'C',
    refMethod: 'C',
    name: 'Method 58 (C)',
    description: 'Single-core or multi-core cable direct in masonry (thermal resistivity ≤ 2 K·m/W) with added mechanical protection',
    category: 'surface',
  },
  {
    id: '59',
    number: 59,
    code: 'B1',
    refMethod: 'B1',
    name: 'Method 59 (B1)',
    description: 'Insulated conductors or single-core cables in conduit in masonry',
    category: 'conduit',
  },
  {
    id: '60',
    number: 60,
    code: 'B2',
    refMethod: 'B2',
    name: 'Method 60 (B2)',
    description: 'Multi-core cables in conduit in masonry',
    category: 'conduit',
  },
  {
    id: '70',
    number: 70,
    code: 'D1',
    refMethod: 'D1',
    name: 'Method 70 (D1)',
    description: 'Multi-core cable in conduit or in cable ducting in the ground',
    category: 'ground',
  },
  {
    id: '71',
    number: 71,
    code: 'D1',
    refMethod: 'D1',
    name: 'Method 71 (D1)',
    description: 'Single-core cable in conduit or in cable ducting in the ground',
    category: 'ground',
  },
  {
    id: '72',
    number: 72,
    code: 'D2',
    refMethod: 'D2',
    name: 'Method 72 (D2)',
    description: 'Sheathed single-core or multi-core cables direct in the ground',
    category: 'ground',
  },
  {
    id: '73',
    number: 73,
    code: 'D2',
    refMethod: 'D2',
    name: 'Method 73 (D2)',
    description: 'Sheathed single-core or multi-core cables direct in the ground with added mechanical protection',
    category: 'ground',
  },
];

/**
 * Resolves any method identifier (e.g. '31-E', '4', '70', 'F (touch.)', or legacy 'C')
 * to its standard Reference Method code: A1, A2, B1, B2, C, D1, D2, E, F, G.
 */
export function resolveReferenceMethod(methodId: string): string {
  if (!methodId) return 'C';

  // Direct match by method ID in the catalogue
  const found = INSTALLATION_METHODS.find((m) => m.id === methodId);
  if (found) return found.refMethod;

  // Direct match by number (e.g. if passed as numeric string '4' or '31')
  const foundByNumber = INSTALLATION_METHODS.find((m) => String(m.number) === methodId);
  if (foundByNumber) return foundByNumber.refMethod;

  // Check if standard reference code directly
  const upper = methodId.toUpperCase();
  if (['A1', 'A2', 'B1', 'B2', 'C', 'D1', 'D2', 'E', 'F', 'G'].includes(upper)) {
    return upper;
  }

  // If contains reference code prefix/suffix
  if (upper.startsWith('A1')) return 'A1';
  if (upper.startsWith('A2')) return 'A2';
  if (upper.startsWith('B1')) return 'B1';
  if (upper.startsWith('B2')) return 'B2';
  if (upper.startsWith('D1')) return 'D1';
  if (upper.startsWith('D2')) return 'D2';
  if (upper.startsWith('F')) return 'F';
  if (upper.startsWith('G')) return 'G';
  if (upper.startsWith('E')) return 'E';
  if (upper.startsWith('C')) return 'C';

  return 'C';
}

// Ampacity multipliers relative to Method C (clipped directly)
// Method C = 1.0 (reference)
export const METHOD_AMPACITY_FACTORS: Record<string, number> = {
  A1: 0.72,  // In conduit in insulated wall
  A2: 0.72,  // Multi-core in conduit in insulated wall
  B1: 0.78,  // In conduit on wall
  B2: 0.78,  // Multi-core in conduit on wall
  C: 1.00,   // Clipped directly (reference)
  E: 1.08,   // Spaced from surface / Perforated tray multicore
  F: 1.12,   // On perforated tray single-core
  G: 1.15,   // On ladder/insulators
  D1: 0.90,  // In ground conduit/duct
  D2: 1.00,  // Direct buried in ground (20°C ambient baseline)
};

// Ampacity tables (A) for copper cables at standard ambient (30°C in air, 20°C in ground)

// Method A1 - Insulated conductors in conduit in insulated wall
export const AMPACITY_A1_PVC_3PH: Record<number, number> = {
  1.5: 11, 2.5: 15, 4: 20, 6: 25, 10: 35, 16: 48, 25: 63, 35: 78,
  50: 95, 70: 121, 95: 147, 120: 170, 150: 194, 185: 221, 240: 260, 300: 298,
};

export const AMPACITY_A1_XLPE_3PH: Record<number, number> = {
  1.5: 16, 2.5: 22, 4: 29, 6: 37, 10: 51, 16: 69, 25: 89, 35: 110,
  50: 134, 70: 172, 95: 209, 120: 242, 150: 277, 185: 316, 240: 371, 300: 426,
};

export const AMPACITY_A1_PVC_1PH: Record<number, number> = {
  1.5: 12, 2.5: 17, 4: 23, 6: 29, 10: 40, 16: 54, 25: 71, 35: 88,
  50: 107, 70: 137, 95: 166, 120: 192, 150: 219, 185: 250, 240: 294, 300: 337,
};

export const AMPACITY_A1_XLPE_1PH: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 79, 25: 102, 35: 125,
  50: 153, 70: 198, 95: 240, 120: 278, 150: 318, 185: 363, 240: 426, 300: 490,
};

// Method A2 - Multi-core cables in conduit in insulated wall
export const AMPACITY_A2_PVC_3PH: Record<number, number> = {
  1.5: 11, 2.5: 15, 4: 20, 6: 25, 10: 35, 16: 48, 25: 63, 35: 78,
  50: 95, 70: 121, 95: 147, 120: 170, 150: 194, 185: 221, 240: 260, 300: 298,
};

export const AMPACITY_A2_XLPE_3PH: Record<number, number> = {
  1.5: 16, 2.5: 22, 4: 29, 6: 37, 10: 51, 16: 69, 25: 89, 35: 110,
  50: 134, 70: 172, 95: 209, 120: 242, 150: 277, 185: 316, 240: 371, 300: 426,
};

// Method B1 - Insulated conductors in conduit on wall / trunking
export const AMPACITY_B1_PVC_3PH: Record<number, number> = {
  1.5: 12, 2.5: 16.5, 4: 22, 6: 28, 10: 39, 16: 53, 25: 70, 35: 86,
  50: 105, 70: 134, 95: 162, 120: 187, 150: 213, 185: 243, 240: 286, 300: 328,
};

export const AMPACITY_B1_XLPE_3PH: Record<number, number> = {
  1.5: 17, 2.5: 24, 4: 32, 6: 41, 10: 56, 16: 76, 25: 98, 35: 120,
  50: 146, 70: 190, 95: 230, 120: 268, 150: 300, 185: 342, 240: 403, 300: 464,
};

export const AMPACITY_B1_PVC_1PH: Record<number, number> = {
  1.5: 13.5, 2.5: 18.5, 4: 25, 6: 32, 10: 44, 16: 60, 25: 79, 35: 97,
  50: 119, 70: 152, 95: 184, 120: 213, 150: 241, 185: 276, 240: 325, 300: 373,
};

export const AMPACITY_B1_XLPE_1PH: Record<number, number> = {
  1.5: 19, 2.5: 27, 4: 37, 6: 47, 10: 64, 16: 87, 25: 112, 35: 138,
  50: 168, 70: 218, 95: 264, 120: 307, 150: 344, 185: 392, 240: 462, 300: 532,
};

// Method B2 - Multi-core cables in conduit on wall / trunking
export const AMPACITY_B2_PVC_3PH: Record<number, number> = {
  1.5: 12, 2.5: 16.5, 4: 22, 6: 28, 10: 39, 16: 53, 25: 70, 35: 86,
  50: 105, 70: 134, 95: 162, 120: 187, 150: 213, 185: 243, 240: 286, 300: 328,
};

export const AMPACITY_B2_XLPE_3PH: Record<number, number> = {
  1.5: 17, 2.5: 24, 4: 32, 6: 41, 10: 56, 16: 76, 25: 98, 35: 120,
  50: 146, 70: 190, 95: 230, 120: 268, 150: 300, 185: 342, 240: 403, 300: 464,
};

// Method C - Clipped directly (reference method)
export const AMPACITY_C_PVC_3PH: Record<number, number> = {
  1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110,
  50: 134, 70: 171, 95: 207, 120: 239, 150: 272, 185: 310, 240: 364, 300: 419,
};

export const AMPACITY_C_XLPE_3PH: Record<number, number> = {
  1.5: 22, 2.5: 30, 4: 40, 6: 52, 10: 71, 16: 96, 25: 119, 35: 147,
  50: 179, 70: 229, 95: 278, 120: 322, 150: 371, 185: 424, 240: 500, 300: 576,
};

export const AMPACITY_C_PVC_1PH: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125,
  50: 151, 70: 192, 95: 232, 120: 269, 150: 300, 185: 341, 240: 400, 300: 460,
};

export const AMPACITY_C_XLPE_1PH: Record<number, number> = {
  1.5: 24, 2.5: 33, 4: 45, 6: 58, 10: 80, 16: 107, 25: 135, 35: 169,
  50: 207, 70: 268, 95: 328, 120: 382, 150: 441, 185: 506, 240: 599, 300: 693,
};

// Method E - Spaced from surface / Perforated tray multicore
export const AMPACITY_E_PVC_3PH: Record<number, number> = {
  1.5: 17, 2.5: 23, 4: 30, 6: 39, 10: 54, 16: 73, 25: 96, 35: 119,
  50: 144, 70: 184, 95: 223, 120: 258, 150: 293, 185: 334, 240: 392, 300: 451,
};

export const AMPACITY_E_XLPE_3PH: Record<number, number> = {
  1.5: 24, 2.5: 32, 4: 43, 6: 56, 10: 76, 16: 103, 25: 128, 35: 158,
  50: 193, 70: 247, 95: 300, 120: 347, 150: 400, 185: 457, 240: 540, 300: 621,
};

// Method F - On perforated tray single-core
export const AMPACITY_F_PVC_3PH: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 77, 25: 100, 35: 124,
  50: 150, 70: 192, 95: 232, 120: 269, 150: 305, 185: 348, 240: 409, 300: 472,
};

export const AMPACITY_F_XLPE_3PH: Record<number, number> = {
  1.5: 25, 2.5: 34, 4: 46, 6: 59, 10: 80, 16: 108, 25: 133, 35: 165,
  50: 201, 70: 257, 95: 311, 120: 361, 150: 415, 185: 475, 240: 560, 300: 645,
};

// Method G - On ladder / insulators
export const AMPACITY_G_PVC_3PH: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 79, 25: 103, 35: 128,
  50: 155, 70: 198, 95: 240, 120: 278, 150: 316, 185: 361, 240: 424, 300: 488,
};

export const AMPACITY_G_XLPE_3PH: Record<number, number> = {
  1.5: 26, 2.5: 36, 4: 48, 6: 62, 10: 84, 16: 113, 25: 140, 35: 173,
  50: 210, 70: 269, 95: 326, 120: 378, 150: 435, 185: 497, 240: 586, 300: 674,
};

// Method D1 - In ground conduit / duct
export const AMPACITY_D1_PVC_3PH: Record<number, number> = {
  1.5: 18, 2.5: 24, 4: 31, 6: 39, 10: 52, 16: 67, 25: 86, 35: 103,
  50: 122, 70: 151, 95: 179, 120: 203, 150: 230, 185: 258, 240: 297, 300: 336,
};

export const AMPACITY_D1_XLPE_3PH: Record<number, number> = {
  1.5: 22, 2.5: 29, 4: 38, 6: 47, 10: 63, 16: 81, 25: 104, 35: 125,
  50: 148, 70: 183, 95: 216, 120: 246, 150: 278, 185: 312, 240: 361, 300: 408,
};

// Method D2 - Direct buried in ground
export const AMPACITY_D2_PVC_3PH: Record<number, number> = {
  1.5: 21, 2.5: 28, 4: 36, 6: 45, 10: 60, 16: 78, 25: 99, 35: 119,
  50: 140, 70: 173, 95: 204, 120: 231, 150: 261, 185: 292, 240: 336, 300: 379,
};

export const AMPACITY_D2_XLPE_3PH: Record<number, number> = {
  1.5: 25, 2.5: 33, 4: 43, 6: 53, 10: 71, 16: 91, 25: 116, 35: 139,
  50: 164, 70: 203, 95: 239, 120: 271, 150: 306, 185: 343, 240: 395, 300: 446,
};

/**
 * Get ampacity for a given cable size, method, insulation, and phase count
 */
export function getAmpacity(
  cableSize: number,
  methodInput: string,
  insulation: 'PVC' | 'XLPE',
  isThreePhase: boolean
): number {
  const refMethod = resolveReferenceMethod(methodInput);

  const tables: Record<string, Record<number, number>> = {
    'A1_PVC_3PH': AMPACITY_A1_PVC_3PH,
    'A1_XLPE_3PH': AMPACITY_A1_XLPE_3PH,
    'A1_PVC_1PH': AMPACITY_A1_PVC_1PH,
    'A1_XLPE_1PH': AMPACITY_A1_XLPE_1PH,
    'A2_PVC_3PH': AMPACITY_A2_PVC_3PH,
    'A2_XLPE_3PH': AMPACITY_A2_XLPE_3PH,
    'B1_PVC_3PH': AMPACITY_B1_PVC_3PH,
    'B1_XLPE_3PH': AMPACITY_B1_XLPE_3PH,
    'B1_PVC_1PH': AMPACITY_B1_PVC_1PH,
    'B1_XLPE_1PH': AMPACITY_B1_XLPE_1PH,
    'B2_PVC_3PH': AMPACITY_B2_PVC_3PH,
    'B2_XLPE_3PH': AMPACITY_B2_XLPE_3PH,
    'C_PVC_3PH': AMPACITY_C_PVC_3PH,
    'C_XLPE_3PH': AMPACITY_C_XLPE_3PH,
    'C_PVC_1PH': AMPACITY_C_PVC_1PH,
    'C_XLPE_1PH': AMPACITY_C_XLPE_1PH,
    'E_PVC_3PH': AMPACITY_E_PVC_3PH,
    'E_XLPE_3PH': AMPACITY_E_XLPE_3PH,
    'F_PVC_3PH': AMPACITY_F_PVC_3PH,
    'F_XLPE_3PH': AMPACITY_F_XLPE_3PH,
    'G_PVC_3PH': AMPACITY_G_PVC_3PH,
    'G_XLPE_3PH': AMPACITY_G_XLPE_3PH,
    'D1_PVC_3PH': AMPACITY_D1_PVC_3PH,
    'D1_XLPE_3PH': AMPACITY_D1_XLPE_3PH,
    'D2_PVC_3PH': AMPACITY_D2_PVC_3PH,
    'D2_XLPE_3PH': AMPACITY_D2_XLPE_3PH,
  };

  const key = `${refMethod}_${insulation}_${isThreePhase ? '3PH' : '1PH'}`;
  const table = tables[key] || tables[`${refMethod}_${insulation}_3PH`] || tables['C_XLPE_3PH'];

  return table[cableSize] || 0;
}
