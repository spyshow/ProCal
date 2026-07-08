export interface AcSizingRule {
  maxArea: number;
  btu: number;
  watts: number;
}

export interface CountryConfig {
  voltage: number;
  frequency: number;
  powerFactor: number;
  roomDensities: {
    kitchen: number;
    bedroom: number;
    livingRoom: number;
    diningRoom: number;
    bathroom: number;
    hall: number;
    other: number;
  };
  acSizingRules: AcSizingRule[];
}

export const ROOM_TYPES = [
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'BEDROOM', label: 'Bedroom' },
  { value: 'LIVING_ROOM', label: 'Living Room' },
  { value: 'DINING_ROOM', label: 'Dining Room' },
  { value: 'BATHROOM', label: 'Bathroom/WC' },
  { value: 'HALL', label: 'Hall/Corridor' },
  { value: 'OTHER', label: 'Other' },
];

// Default AC sizing rules (used for all countries)
const DEFAULT_AC_RULES: AcSizingRule[] = [
  { maxArea: 15, btu: 9000, watts: 2637 },
  { maxArea: 25, btu: 12000, watts: 3516 },
  { maxArea: 35, btu: 18000, watts: 5274 },
  { maxArea: 50, btu: 24000, watts: 7032 },
  { maxArea: Infinity, btu: 30000, watts: 8790 },
];

// Default room densities for new countries
const DEFAULT_DENSITIES = {
  kitchen: 150,
  bedroom: 80,
  livingRoom: 100,
  diningRoom: 90,
  bathroom: 60,
  hall: 50,
  other: 70,
};

export const COUNTRY_DEFAULTS: Record<string, CountryConfig> = {
  // Middle East
  Syria: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 150, bedroom: 80, livingRoom: 100, diningRoom: 90, bathroom: 60, hall: 50, other: 70 }, acSizingRules: DEFAULT_AC_RULES },
  UAE: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 160, bedroom: 85, livingRoom: 110, diningRoom: 95, bathroom: 65, hall: 55, other: 75 }, acSizingRules: DEFAULT_AC_RULES },
  SaudiArabia: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 155, bedroom: 82, livingRoom: 105, diningRoom: 92, bathroom: 62, hall: 52, other: 72 }, acSizingRules: DEFAULT_AC_RULES },
  Egypt: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 75, livingRoom: 95, diningRoom: 85, bathroom: 55, hall: 45, other: 65 }, acSizingRules: DEFAULT_AC_RULES },
  Jordan: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 78, livingRoom: 98, diningRoom: 88, bathroom: 58, hall: 48, other: 68 }, acSizingRules: DEFAULT_AC_RULES },
  Iraq: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 148, bedroom: 79, livingRoom: 99, diningRoom: 89, bathroom: 59, hall: 49, other: 69 }, acSizingRules: DEFAULT_AC_RULES },
  Lebanon: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 150, bedroom: 80, livingRoom: 100, diningRoom: 90, bathroom: 60, hall: 50, other: 70 }, acSizingRules: DEFAULT_AC_RULES },
  Kuwait: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 158, bedroom: 84, livingRoom: 108, diningRoom: 94, bathroom: 64, hall: 54, other: 74 }, acSizingRules: DEFAULT_AC_RULES },
  Qatar: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 158, bedroom: 84, livingRoom: 108, diningRoom: 94, bathroom: 64, hall: 54, other: 74 }, acSizingRules: DEFAULT_AC_RULES },
  Bahrain: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 155, bedroom: 82, livingRoom: 105, diningRoom: 92, bathroom: 62, hall: 52, other: 72 }, acSizingRules: DEFAULT_AC_RULES },
  Oman: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 155, bedroom: 82, livingRoom: 105, diningRoom: 92, bathroom: 62, hall: 52, other: 72 }, acSizingRules: DEFAULT_AC_RULES },
  Yemen: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 75, livingRoom: 95, diningRoom: 85, bathroom: 55, hall: 45, other: 65 }, acSizingRules: DEFAULT_AC_RULES },
  Palestine: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 148, bedroom: 79, livingRoom: 99, diningRoom: 89, bathroom: 59, hall: 49, other: 69 }, acSizingRules: DEFAULT_AC_RULES },

  // North Africa
  Libya: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 78, livingRoom: 98, diningRoom: 88, bathroom: 58, hall: 48, other: 68 }, acSizingRules: DEFAULT_AC_RULES },
  Tunisia: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 76, livingRoom: 96, diningRoom: 86, bathroom: 56, hall: 46, other: 66 }, acSizingRules: DEFAULT_AC_RULES },
  Algeria: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 76, livingRoom: 96, diningRoom: 86, bathroom: 56, hall: 46, other: 66 }, acSizingRules: DEFAULT_AC_RULES },
  Morocco: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 75, livingRoom: 95, diningRoom: 85, bathroom: 55, hall: 45, other: 65 }, acSizingRules: DEFAULT_AC_RULES },

  // Europe
  UK: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 160, bedroom: 75, livingRoom: 90, diningRoom: 80, bathroom: 50, hall: 40, other: 60 }, acSizingRules: DEFAULT_AC_RULES },
  Germany: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  France: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Spain: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 150, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Italy: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 150, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Netherlands: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Belgium: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Switzerland: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 158, bedroom: 74, livingRoom: 90, diningRoom: 80, bathroom: 50, hall: 40, other: 60 }, acSizingRules: DEFAULT_AC_RULES },
  Austria: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Greece: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 148, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Turkey: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 78, livingRoom: 98, diningRoom: 88, bathroom: 58, hall: 48, other: 68 }, acSizingRules: DEFAULT_AC_RULES },
  Portugal: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 148, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Poland: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 145, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Sweden: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Norway: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Denmark: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Finland: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Ireland: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },

  // North America
  USA: { voltage: 480, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 170, bedroom: 75, livingRoom: 90, diningRoom: 80, bathroom: 50, hall: 40, other: 60 }, acSizingRules: DEFAULT_AC_RULES },
  Canada: { voltage: 480, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 165, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Mexico: { voltage: 480, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 150, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },

  // South America
  Brazil: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Argentina: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Chile: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Colombia: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Peru: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 67, livingRoom: 80, diningRoom: 70, bathroom: 40, hall: 30, other: 50 }, acSizingRules: DEFAULT_AC_RULES },

  // Asia
  India: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Pakistan: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 138, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  China: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 150, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Japan: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 148, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  SouthKorea: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 150, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Thailand: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Malaysia: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 148, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },
  Singapore: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 152, bedroom: 74, livingRoom: 90, diningRoom: 80, bathroom: 50, hall: 40, other: 60 }, acSizingRules: DEFAULT_AC_RULES },
  Indonesia: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Philippines: { voltage: 400, frequency: 60, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Vietnam: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 140, bedroom: 67, livingRoom: 80, diningRoom: 70, bathroom: 40, hall: 30, other: 50 }, acSizingRules: DEFAULT_AC_RULES },

  // Oceania
  Australia: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 160, bedroom: 75, livingRoom: 90, diningRoom: 80, bathroom: 50, hall: 40, other: 60 }, acSizingRules: DEFAULT_AC_RULES },
  NewZealand: { voltage: 400, frequency: 50, powerFactor: 0.9, roomDensities: { kitchen: 155, bedroom: 72, livingRoom: 88, diningRoom: 78, bathroom: 48, hall: 38, other: 58 }, acSizingRules: DEFAULT_AC_RULES },

  // Sub-Saharan Africa
  Nigeria: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 135, bedroom: 65, livingRoom: 78, diningRoom: 68, bathroom: 38, hall: 28, other: 48 }, acSizingRules: DEFAULT_AC_RULES },
  SouthAfrica: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 145, bedroom: 70, livingRoom: 85, diningRoom: 75, bathroom: 45, hall: 35, other: 55 }, acSizingRules: DEFAULT_AC_RULES },
  Kenya: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 135, bedroom: 65, livingRoom: 78, diningRoom: 68, bathroom: 38, hall: 28, other: 48 }, acSizingRules: DEFAULT_AC_RULES },
  Ghana: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 132, bedroom: 63, livingRoom: 76, diningRoom: 66, bathroom: 36, hall: 26, other: 46 }, acSizingRules: DEFAULT_AC_RULES },

  // Central Asia
  Kazakhstan: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 142, bedroom: 68, livingRoom: 82, diningRoom: 72, bathroom: 42, hall: 32, other: 52 }, acSizingRules: DEFAULT_AC_RULES },
  Uzbekistan: { voltage: 400, frequency: 50, powerFactor: 0.85, roomDensities: { kitchen: 138, bedroom: 66, livingRoom: 80, diningRoom: 70, bathroom: 40, hall: 30, other: 50 }, acSizingRules: DEFAULT_AC_RULES },
};

// Default config for countries not in the list
export const DEFAULT_COUNTRY_CONFIG: CountryConfig = {
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  roomDensities: DEFAULT_DENSITIES,
  acSizingRules: DEFAULT_AC_RULES,
};

export function calculateAcWatts(area: number, rules: AcSizingRule[]): number {
  const rule = rules.find((r) => area <= r.maxArea) || rules[rules.length - 1];
  return rule.watts;
}

export function calculateRoomLoad(
  area: number,
  density: number,
  hasAc: boolean,
  acRules: AcSizingRule[]
): number {
  const baseLoad = area * density;
  const acLoad = hasAc ? calculateAcWatts(area, acRules) : 0;
  return baseLoad + acLoad;
}

export function getCountryDefaults(country: string): CountryConfig {
  return COUNTRY_DEFAULTS[country] || DEFAULT_COUNTRY_CONFIG;
}
