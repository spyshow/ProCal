// IEC 60364-5-52 Installation Methods for Cable Sizing
// Current-carrying capacities (Ampacity) in air at 30°C ambient

export interface InstallationMethod {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'conduit' | 'surface' | 'tray' | 'ground';
}

export const INSTALLATION_METHODS: InstallationMethod[] = [
  // Conduit methods
  {
    id: 'A1',
    code: 'A1',
    name: 'Method A1',
    description: 'Insulated conductors or single-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: 'A2',
    code: 'A2',
    name: 'Method A2',
    description: 'Multi-core cables in conduit in a thermally insulated wall',
    category: 'conduit',
  },
  {
    id: 'B1',
    code: 'B1',
    name: 'Method B1',
    description: 'Insulated conductors or single-core cables in conduit on a wooden or masonry wall',
    category: 'conduit',
  },
  {
    id: 'B2',
    code: 'B2',
    name: 'Method B2',
    description: 'Multi-core cables in conduit on a wooden or masonry wall',
    category: 'conduit',
  },
  // Surface methods
  {
    id: 'C',
    code: 'C',
    name: 'Method C',
    description: 'Single-core or multi-core cables clipped directly on a wall or surface',
    category: 'surface',
  },
  {
    id: 'E',
    code: 'E',
    name: 'Method E',
    description: 'Single-core or multi-core cables spaced from wall or ceiling surface',
    category: 'surface',
  },
  // Tray/ladder methods
  {
    id: 'F',
    code: 'F',
    name: 'Method F',
    description: 'Single-core or multi-core cables on perforated cable tray',
    category: 'tray',
  },
  {
    id: 'G',
    code: 'G',
    name: 'Method G',
    description: 'Single-core or multi-core cables on ladder or insulators',
    category: 'tray',
  },
];

// Ampacity multipliers relative to Method C (clipped directly)
// Method C = 1.0 (reference)
export const METHOD_AMPACITY_FACTORS: Record<string, number> = {
  A1: 0.72,  // In conduit in insulated wall
  A2: 0.72,  // Multi-core in conduit in insulated wall
  B1: 0.78,  // In conduit on wall
  B2: 0.78,  // Multi-core in conduit on wall
  C: 1.00,   // Clipped directly (reference)
  E: 1.08,   // Spaced from surface
  F: 1.12,   // On perforated tray
  G: 1.15,   // On ladder/insulators
};

// Ampacity tables (A) for copper cables, 3-phase, at 30°C ambient
// Reference Method C (clipped directly)
export interface AmpacityTable {
  method: string;
  insulation: 'PVC' | 'XLPE';
  phases: 1 | 3;
  cableSizeAmpacity: Record<number, number>;
}

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

// Method B1 - Insulated conductors in conduit
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

// Method B2 - Multi-core cables in conduit
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

// Method E - Spaced from surface
export const AMPACITY_E_PVC_3PH: Record<number, number> = {
  1.5: 17, 2.5: 23, 4: 30, 6: 39, 10: 54, 16: 73, 25: 96, 35: 119,
  50: 144, 70: 184, 95: 223, 120: 258, 150: 293, 185: 334, 240: 392, 300: 451,
};

export const AMPACITY_E_XLPE_3PH: Record<number, number> = {
  1.5: 24, 2.5: 32, 4: 43, 6: 56, 10: 76, 16: 103, 25: 128, 35: 158,
  50: 193, 70: 247, 95: 300, 120: 347, 150: 400, 185: 457, 240: 540, 300: 621,
};

// Method F - On perforated tray
export const AMPACITY_F_PVC_3PH: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 77, 25: 100, 35: 124,
  50: 150, 70: 192, 95: 232, 120: 269, 150: 305, 185: 348, 240: 409, 300: 472,
};

export const AMPACITY_F_XLPE_3PH: Record<number, number> = {
  1.5: 25, 2.5: 34, 4: 46, 6: 59, 10: 80, 16: 108, 25: 133, 35: 165,
  50: 201, 70: 257, 95: 311, 120: 361, 150: 415, 185: 475, 240: 560, 300: 645,
};

// Method G - On ladder/insulators
export const AMPACITY_G_PVC_3PH: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 33, 6: 42, 10: 58, 16: 79, 25: 103, 35: 128,
  50: 155, 70: 198, 95: 240, 120: 278, 150: 316, 185: 361, 240: 424, 300: 488,
};

export const AMPACITY_G_XLPE_3PH: Record<number, number> = {
  1.5: 26, 2.5: 36, 4: 48, 6: 62, 10: 84, 16: 113, 25: 140, 35: 173,
  50: 210, 70: 269, 95: 326, 120: 378, 150: 435, 185: 497, 240: 586, 300: 674,
};

/**
 * Get ampacity for a given cable size, method, insulation, and phase count
 */
export function getAmpacity(
  cableSize: number,
  method: string,
  insulation: 'PVC' | 'XLPE',
  isThreePhase: boolean
): number {
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
  };

  const key = `${method}_${insulation}_${isThreePhase ? '3PH' : '1PH'}`;
  const table = tables[key] || tables['C_XLPE_3PH']; // fallback to Method C XLPE 3-phase

  return table[cableSize] || 0;
}
