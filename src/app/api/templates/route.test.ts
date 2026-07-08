import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { calculateRoomLoad } from '@/lib/country-defaults';
import { COUNTRY_DEFAULTS } from '@/lib/country-defaults';

describe('Template API - Room-based calculations', () => {
  const syriaDefaults = COUNTRY_DEFAULTS.Syria;

  describe('calculateRoomLoad', () => {
    it('calculates kitchen load correctly', () => {
      const load = calculateRoomLoad(12, 150, false, syriaDefaults.acSizingRules);
      expect(load).toBe(1800); // 12m² × 150 VA/m²
    });

    it('calculates bedroom load with AC', () => {
      const load = calculateRoomLoad(15, 80, true, syriaDefaults.acSizingRules);
      // Base: 15 × 80 = 1200
      // AC: 15m² → 9000 BTU → 2637 watts
      expect(load).toBe(3837);
    });

    it('calculates living room load with AC', () => {
      const load = calculateRoomLoad(25, 100, true, syriaDefaults.acSizingRules);
      // Base: 25 × 100 = 2500
      // AC: 25m² → 12000 BTU → 3516 watts
      expect(load).toBe(6016);
    });

    it('sums multiple room loads for apartment total', () => {
      const rooms = [
        { area: 12, density: 150, hasAc: false }, // Kitchen: 1800
        { area: 15, density: 80, hasAc: true },   // Bedroom: 3837
        { area: 15, density: 80, hasAc: true },   // Bedroom: 3837
        { area: 25, density: 100, hasAc: true },  // Living: 6016
        { area: 8, density: 50, hasAc: false },   // Hall: 400
      ];

      const total = rooms.reduce((sum, room) => {
        return sum + calculateRoomLoad(room.area, room.density, room.hasAc, syriaDefaults.acSizingRules);
      }, 0);

      // 1800 + 3837 + 3837 + 6016 + 400 = 15890 VA
      expect(total).toBe(15890);
    });
  });

  describe('Room type defaults', () => {
    it('Syria has correct default densities', () => {
      expect(syriaDefaults.roomDensities.kitchen).toBe(150);
      expect(syriaDefaults.roomDensities.bedroom).toBe(80);
      expect(syriaDefaults.roomDensities.livingRoom).toBe(100);
      expect(syriaDefaults.roomDensities.diningRoom).toBe(90);
      expect(syriaDefaults.roomDensities.bathroom).toBe(60);
      expect(syriaDefaults.roomDensities.hall).toBe(50);
      expect(syriaDefaults.roomDensities.other).toBe(70);
    });
  });
});
