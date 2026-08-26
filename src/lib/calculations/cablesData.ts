// IEC 60364-5-52 Reference Data for Cable Sizing

export interface CableSpec {
  size: number; // in mm²
  copperPvc3Ph: number; // Ampacity for 3-phase Copper PVC
  copperXlpe3Ph: number; // Ampacity for 3-phase Copper XLPE
  copperPvc1Ph: number; // Ampacity for 1-phase Copper PVC
  copperXlpe1Ph: number; // Ampacity for 1-phase Copper XLPE
  alXlpe3Ph: number; // Ampacity for 3-phase Aluminum XLPE
  alXlpe1Ph: number; // Ampacity for 1-phase Aluminum XLPE
  alPvc3Ph: number; // Ampacity for 3-phase Aluminum PVC
  alPvc1Ph: number; // Ampacity for 1-phase Aluminum PVC
  resistance: number; // AC Resistance at 70/90°C (ohms/km) — COPPER values; aluminum is ~1.64× (see calculateVoltageDrop)
  reactance: number; // Reactance at 50Hz (ohms/km)
}

type CableSpecBase = Omit<CableSpec, 'alXlpe1Ph' | 'alPvc3Ph' | 'alPvc1Ph'>;

// Typical AC resistance & reactance values (ohms/km) and ampacities (Reference Method C - Clipped directly)
// The three extra aluminum columns are derived from the IEC-style alXlpe3Ph base
// scaled by the copper 1-phase / PVC ratios — aluminum ampacity tables in
// IEC 60364-5-52 keep the same relative shape, only lower.
export const CABLE_CATALOG: CableSpec[] = (
  [
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
    // IEC 60364-5-52 B.52.x tables stop at 300 mm²; these two rows are
    // extrapolated with the table's own size-scaling exponent (ampacity ≈
    // S^0.63, fitted from the 185→300 progression) and R ∝ 1/S. Reachable only
    // when a caller passes maxCableSize > 300 (the sizer default stays 300).
    { size: 400, copperPvc3Ph: 502, copperXlpe3Ph: 690, copperPvc1Ph: 551, copperXlpe1Ph: 830, alXlpe3Ph: 595, resistance: 0.054, reactance: 0.066 },
    { size: 500, copperPvc3Ph: 578, copperXlpe3Ph: 794, copperPvc1Ph: 635, copperXlpe1Ph: 955, alXlpe3Ph: 685, resistance: 0.043, reactance: 0.065 },
  ] as CableSpecBase[]
).map((c) => ({
  ...c,
  alXlpe1Ph: Math.round(c.alXlpe3Ph * (c.copperXlpe1Ph / c.copperXlpe3Ph)),
  alPvc3Ph: Math.round(c.alXlpe3Ph * (c.copperPvc3Ph / c.copperXlpe3Ph)),
  alPvc1Ph: Math.round(c.alXlpe3Ph * (c.copperPvc1Ph / c.copperXlpe3Ph)),
}));

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
    15: 1.12,
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

/**
 * Ambient-temperature correction factor, linearly interpolated between the
 * tabulated 5 °C steps. Exact-key lookup alone silently returned 1.0 (no
 * derating) for real-world ambients like 31–34 °C — non-conservative, since
 * the factor only ever decreases as ambient rises above the 30 °C reference.
 */
export function temperatureDeratingFactor(
  insulation: 'PVC' | 'XLPE',
  ambientTemp: number
): number {
  const table = TEMP_DERATING[insulation];
  if (!table) return 1.0;
  const temps = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (temps.length === 0) return 1.0;
  if (ambientTemp <= temps[0]) return table[temps[0]];
  if (ambientTemp >= temps[temps.length - 1]) return table[temps[temps.length - 1]];
  for (let i = 0; i < temps.length - 1; i++) {
    const t1 = temps[i];
    const t2 = temps[i + 1];
    if (ambientTemp <= t2) {
      const f1 = table[t1];
      const f2 = table[t2];
      return f1 + (f2 - f1) * ((ambientTemp - t1) / (t2 - t1));
    }
  }
  return table[temps[temps.length - 1]];
}

/**
 * Grouping correction factor, interpolated between tabulated circuit counts.
 * The old `?? 0.5` fallback was non-monotonic (13–15 and 17–19 circuits got
 * 0.5 while 12 → 0.45 and 16 → 0.41) and `?? 1.0` at other call sites meant
 * no grouping derating at all for unlisted counts.
 */
export function groupingDeratingFactor(groupingCount: number): number {
  const counts = Object.keys(GROUP_DERATING).map(Number).sort((a, b) => a - b);
  if (counts.length === 0) return 1.0;
  if (groupingCount <= counts[0]) return GROUP_DERATING[counts[0]];
  if (groupingCount >= counts[counts.length - 1]) return GROUP_DERATING[counts[counts.length - 1]];
  for (let i = 0; i < counts.length - 1; i++) {
    const c1 = counts[i];
    const c2 = counts[i + 1];
    if (groupingCount <= c2) {
      const f1 = GROUP_DERATING[c1];
      const f2 = GROUP_DERATING[c2];
      return f1 + (f2 - f1) * ((groupingCount - c1) / (c2 - c1));
    }
  }
  return GROUP_DERATING[counts[counts.length - 1]];
}
