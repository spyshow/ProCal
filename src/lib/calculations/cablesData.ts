// IEC 60364-5-52 Reference Data for Cable Sizing

export interface CableSpec {
  size: number; // in mm²
  copperPvc3Ph: number; // Ampacity for 3-phase Copper PVC
  copperXlpe3Ph: number; // Ampacity for 3-phase Copper XLPE
  copperPvc1Ph: number; // Ampacity for 1-phase Copper PVC
  copperXlpe1Ph: number; // Ampacity for 1-phase Copper XLPE
  alXlpe3Ph: number; // Ampacity for 3-phase Aluminum XLPE
  resistance: number; // AC Resistance at 70/90°C (ohms/km)
  reactance: number; // Reactance at 50Hz (ohms/km)
}

// Typical AC resistance & reactance values (ohms/km) and ampacities (Reference Method C - Clipped directly)
export const CABLE_CATALOG: CableSpec[] = [
  { size: 1.5, copperPvc3Ph: 15.5, copperXlpe3Ph: 22, copperPvc1Ph: 17.5, copperXlpe1Ph: 24, alXlpe3Ph: 18.5, resistance: 14.8, reactance: 0.115 },
  { size: 2.5, copperPvc3Ph: 21, copperXlpe3Ph: 30, copperPvc1Ph: 24, copperXlpe1Ph: 33, alXlpe3Ph: 25, resistance: 8.91, reactance: 0.106 },
  { size: 4, copperPvc3Ph: 28, copperXlpe3Ph: 40, copperPvc1Ph: 32, copperXlpe1Ph: 45, alXlpe3Ph: 34, resistance: 5.57, reactance: 0.097 },
  { size: 6, copperPvc3Ph: 36, copperXlpe3Ph: 52, copperPvc1Ph: 41, copperXlpe1Ph: 58, alXlpe3Ph: 43, resistance: 3.71, reactance: 0.093 },
  { size: 10, copperPvc3Ph: 50, copperXlpe3Ph: 71, copperPvc1Ph: 57, copperXlpe1Ph: 80, alXlpe3Ph: 60, resistance: 2.19, reactance: 0.086 },
  { size: 16, copperPvc3Ph: 68, copperXlpe3Ph: 96, copperPvc1Ph: 76, copperXlpe1Ph: 107, alXlpe3Ph: 79, resistance: 1.38, reactance: 0.082 },
  { size: 25, copperPvc3Ph: 89, copperXlpe3Ph: 119, copperPvc1Ph: 101, copperXlpe1Ph: 135, alXlpe3Ph: 101, resistance: 0.87, reactance: 0.080 },
  { size: 35, copperPvc3Ph: 110, copperXlpe3Ph: 147, copperPvc1Ph: 125, copperXlpe1Ph: 169, alXlpe3Ph: 126, resistance: 0.627, reactance: 0.077 },
  { size: 50, copperPvc3Ph: 134, copperXlpe3Ph: 179, copperPvc1Ph: 151, copperXlpe1Ph: 207, alXlpe3Ph: 153, resistance: 0.463, reactance: 0.075 },
  { size: 70, copperPvc3Ph: 171, copperXlpe3Ph: 229, copperPvc1Ph: 192, copperXlpe1Ph: 268, alXlpe3Ph: 196, resistance: 0.321, reactance: 0.073 },
  { size: 95, copperPvc3Ph: 207, copperXlpe3Ph: 278, copperPvc1Ph: 232, copperXlpe1Ph: 328, alXlpe3Ph: 238, resistance: 0.232, reactance: 0.072 },
  { size: 120, copperPvc3Ph: 239, copperXlpe3Ph: 322, copperPvc1Ph: 269, copperXlpe1Ph: 382, alXlpe3Ph: 276, resistance: 0.184, reactance: 0.070 },
  { size: 150, copperPvc3Ph: 272, copperXlpe3Ph: 371, copperPvc1Ph: 300, copperXlpe1Ph: 441, alXlpe3Ph: 319, resistance: 0.147, reactance: 0.070 },
  { size: 185, copperPvc3Ph: 310, copperXlpe3Ph: 424, copperPvc1Ph: 341, copperXlpe1Ph: 506, alXlpe3Ph: 364, resistance: 0.117, reactance: 0.069 },
  { size: 240, copperPvc3Ph: 364, copperXlpe3Ph: 500, copperPvc1Ph: 400, copperXlpe1Ph: 599, alXlpe3Ph: 430, resistance: 0.089, reactance: 0.068 },
  { size: 300, copperPvc3Ph: 419, copperXlpe3Ph: 576, copperPvc1Ph: 460, copperXlpe1Ph: 693, alXlpe3Ph: 497, resistance: 0.072, reactance: 0.068 },
];

// Temperature derating factors (Reference ambient: 30°C in air)
export const TEMP_DERATING: Record<string, Record<number, number>> = {
  PVC: {
    10: 1.22,
    15: 1.17,
    20: 1.12,
    25: 1.06,
    30: 1.00,
    35: 0.94,
    40: 0.87,
    45: 0.79,
    50: 0.71,
    55: 0.61,
    60: 0.50,
  },
  XLPE: {
    10: 1.15,
    15: 1.11,
    20: 1.07,
    25: 1.04,
    30: 1.00,
    35: 0.96,
    40: 0.91,
    45: 0.87,
    50: 0.82,
    55: 0.76,
    60: 0.71,
  },
};

// Grouping derating factors for multi-core cables in a single layer (tray/wall)
export const GROUP_DERATING: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.65,
  5: 0.6,
  6: 0.57,
  7: 0.54,
  8: 0.52,
  9: 0.5,
  12: 0.45,
  16: 0.41,
  20: 0.38,
};
