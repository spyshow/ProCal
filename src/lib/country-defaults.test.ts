import { describe, it, expect } from 'vitest';
import {
  COUNTRY_DEFAULTS,
  ROOM_TYPES,
  calculateAcWatts,
  calculateRoomLoad,
  getCountryDefaults,
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
