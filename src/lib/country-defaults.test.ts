import { describe, it, expect } from 'vitest';
import {
  COUNTRY_DEFAULTS,
  ROOM_TYPES,
  calculateAcWatts,
  calculateRoomLoad,
  getCountryDefaults,
  getDensityKeyForRoomType,
  getRoomDensity,
} from './country-defaults';

describe('ROOM_TYPES', () => {
  it('contains 7 room types', () => {
    expect(ROOM_TYPES).toHaveLength(7);
  });

  it('includes all required room types', () => {
    const types = ROOM_TYPES.map(r => r.value);
    expect(types).toContain('KITCHEN');
    expect(types).toContain('BEDROOM');
    expect(types).toContain('LIVING_ROOM');
    expect(types).toContain('DINING_ROOM');
    expect(types).toContain('BATHROOM');
    expect(types).toContain('HALL');
    expect(types).toContain('OTHER');
  });

  it('each room type has value and label', () => {
    ROOM_TYPES.forEach(room => {
      expect(room.value).toBeDefined();
      expect(room.label).toBeDefined();
      expect(typeof room.value).toBe('string');
      expect(typeof room.label).toBe('string');
    });
  });
});

describe('COUNTRY_DEFAULTS', () => {
  it('contains Syria defaults', () => {
    expect(COUNTRY_DEFAULTS.Syria).toBeDefined();
  });

  it('Syria has correct voltage and frequency', () => {
    const syria = COUNTRY_DEFAULTS.Syria;
    expect(syria.voltage).toBe(400);
    expect(syria.frequency).toBe(50);
  });

  it('Syria has room densities for all room types', () => {
    const syria = COUNTRY_DEFAULTS.Syria;
    expect(syria.roomDensities.kitchen).toBe(150);
    expect(syria.roomDensities.bedroom).toBe(80);
    expect(syria.roomDensities.livingRoom).toBe(100);
    expect(syria.roomDensities.diningRoom).toBe(90);
    expect(syria.roomDensities.bathroom).toBe(60);
    expect(syria.roomDensities.hall).toBe(50);
    expect(syria.roomDensities.other).toBe(70);
  });

  it('Syria has AC sizing rules', () => {
    const syria = COUNTRY_DEFAULTS.Syria;
    expect(syria.acSizingRules).toBeDefined();
    expect(syria.acSizingRules.length).toBeGreaterThan(0);
  });
});

describe('calculateAcWatts', () => {
  it('returns 0 for small room (≤15m²) - 9000 BTU', () => {
    const watts = calculateAcWatts(10, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(watts).toBe(2637); // 9000 BTU ≈ 2637 watts
  });

  it('returns correct watts for medium room (15-25m²) - 12000 BTU', () => {
    const watts = calculateAcWatts(20, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(watts).toBe(3516); // 12000 BTU ≈ 3516 watts
  });

  it('returns correct watts for large room (25-35m²) - 18000 BTU', () => {
    const watts = calculateAcWatts(30, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(watts).toBe(5274); // 18000 BTU ≈ 5274 watts
  });

  it('returns correct watts for very large room (35-50m²) - 24000 BTU', () => {
    const watts = calculateAcWatts(45, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(watts).toBe(7032); // 24000 BTU ≈ 7032 watts
  });

  it('returns correct watts for extra large room (>50m²) - 30000 BTU', () => {
    const watts = calculateAcWatts(60, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(watts).toBe(8790); // 30000 BTU ≈ 8790 watts
  });
});

describe('calculateRoomLoad', () => {
  it('calculates base load without AC', () => {
    const load = calculateRoomLoad(10, 150, false, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(load).toBe(1500); // 10m² × 150 VA/m² = 1500 VA
  });

  it('calculates load with AC added', () => {
    const load = calculateRoomLoad(10, 150, true, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(load).toBe(4137); // 1500 (base) + 2637 (AC) = 4137 VA
  });

  it('handles zero area', () => {
    const load = calculateRoomLoad(0, 150, false, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(load).toBe(0);
  });

  it('handles zero density', () => {
    const load = calculateRoomLoad(10, 0, false, COUNTRY_DEFAULTS.Syria.acSizingRules);
    expect(load).toBe(0);
  });
});

describe('getCountryDefaults', () => {
  it('returns defaults for Syria', () => {
    const defaults = getCountryDefaults('Syria');
    expect(defaults).toBeDefined();
    expect(defaults.voltage).toBe(400);
  });

  it('returns default config for unknown country', () => {
    const defaults = getCountryDefaults('UnknownCountry');
    expect(defaults).toBeDefined();
    expect(defaults.voltage).toBe(400);
    expect(defaults.frequency).toBe(50);
  });
});

describe('getDensityKeyForRoomType', () => {
  it('maps all standard room types to canonical keys', () => {
    expect(getDensityKeyForRoomType('KITCHEN')).toBe('kitchen');
    expect(getDensityKeyForRoomType('BEDROOM')).toBe('bedroom');
    expect(getDensityKeyForRoomType('LIVING_ROOM')).toBe('livingRoom');
    expect(getDensityKeyForRoomType('DINING_ROOM')).toBe('diningRoom');
    expect(getDensityKeyForRoomType('BATHROOM')).toBe('bathroom');
    expect(getDensityKeyForRoomType('HALL')).toBe('hall');
    expect(getDensityKeyForRoomType('OTHER')).toBe('other');
  });

  it('handles lowercase and mixed variations', () => {
    expect(getDensityKeyForRoomType('living_room')).toBe('livingRoom');
    expect(getDensityKeyForRoomType('dining_room')).toBe('diningRoom');
    expect(getDensityKeyForRoomType('Living Room')).toBe('livingRoom');
    expect(getDensityKeyForRoomType('Dining Room')).toBe('diningRoom');
    expect(getDensityKeyForRoomType('corridor')).toBe('hall');
    expect(getDensityKeyForRoomType('wc')).toBe('bathroom');
    expect(getDensityKeyForRoomType('unknown_type')).toBe('other');
  });
});

describe('getRoomDensity', () => {
  const customDensities = {
    kitchen: 160,
    bedroom: 90,
    livingRoom: 110,
    diningRoom: 95,
    bathroom: 65,
    hall: 55,
    other: 75,
  };

  it('retrieves correct density for uppercase room types', () => {
    expect(getRoomDensity(customDensities, 'KITCHEN')).toBe(160);
    expect(getRoomDensity(customDensities, 'BEDROOM')).toBe(90);
    expect(getRoomDensity(customDensities, 'LIVING_ROOM')).toBe(110);
    expect(getRoomDensity(customDensities, 'DINING_ROOM')).toBe(95);
    expect(getRoomDensity(customDensities, 'BATHROOM')).toBe(65);
    expect(getRoomDensity(customDensities, 'HALL')).toBe(55);
    expect(getRoomDensity(customDensities, 'OTHER')).toBe(75);
  });

  it('supports legacy snake_case keys stored in settings', () => {
    const legacyDensities = {
      kitchen: 140,
      living_room: 105,
      dining_room: 88,
    };
    expect(getRoomDensity(legacyDensities, 'LIVING_ROOM')).toBe(105);
    expect(getRoomDensity(legacyDensities, 'DINING_ROOM')).toBe(88);
  });

  it('falls back to provided fallback or 70 if not found', () => {
    expect(getRoomDensity({}, 'KITCHEN', 120)).toBe(120);
    expect(getRoomDensity(undefined, 'BEDROOM')).toBe(70);
  });
});
