import { describe, it, expect } from 'vitest';
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

  describe('Standard Template Presets', () => {
    it('calculates Type A (2BR 1-Phase) connected load correctly', () => {
      const typeARooms = [
        { area: 24, density: syriaDefaults.roomDensities.livingRoom, hasAc: true },
        { area: 18, density: syriaDefaults.roomDensities.bedroom, hasAc: true },
        { area: 14, density: syriaDefaults.roomDensities.bedroom, hasAc: true },
        { area: 12, density: syriaDefaults.roomDensities.kitchen, hasAc: false },
        { area: 12, density: syriaDefaults.roomDensities.diningRoom, hasAc: false },
        { area: 6, density: syriaDefaults.roomDensities.bathroom, hasAc: false },
        { area: 8, density: syriaDefaults.roomDensities.hall, hasAc: false },
      ];

      const totalConnectedLoad = typeARooms.reduce((sum, r) => {
        return sum + calculateRoomLoad(r.area, r.density, r.hasAc, syriaDefaults.acSizingRules);
      }, 0);

      // Total load should be positive and reasonable (~22.7 kVA)
      expect(totalConnectedLoad).toBeGreaterThan(15000);
      expect(totalConnectedLoad).toBeLessThan(30000);
    });

    it('calculates Type C (Studio 1-Phase) connected load correctly', () => {
      const studioRooms = [
        { area: 26, density: syriaDefaults.roomDensities.livingRoom, hasAc: true },
        { area: 8, density: syriaDefaults.roomDensities.kitchen, hasAc: false },
        { area: 5, density: syriaDefaults.roomDensities.bathroom, hasAc: false },
      ];

      const totalConnectedLoad = studioRooms.reduce((sum, r) => {
        return sum + calculateRoomLoad(r.area, r.density, r.hasAc, syriaDefaults.acSizingRules);
      }, 0);

      expect(totalConnectedLoad).toBeGreaterThan(5000);
      expect(totalConnectedLoad).toBeLessThan(15000);
    });
  });

  describe('Apartment Current Calculation Consistency (Issue 5)', () => {
    it('ensures template route and floor items route calculate matching current for 1-phase and 3-phase', () => {
      const voltageLL = 400;
      const powerFactor = 0.85;
      const demandFactor = 0.4;
      const rooms = [
        { area: 20, density: 100, hasAc: true }, // 20*100 + 12000 BTU (3516W) = 5516 W
        { area: 15, density: 80, hasAc: false }, // 15*80 = 1200 W
      ];

      const totalConnectedLoadW = rooms.reduce(
        (sum, r) => sum + calculateRoomLoad(r.area, r.density, r.hasAc, syriaDefaults.acSizingRules),
        0
      );
      expect(totalConnectedLoadW).toBe(6716);

      const connectedLoadKw = totalConnectedLoadW / 1000;
      const maxDemandKw = connectedLoadKw * demandFactor;

      // 1-Phase calculation: V_LN = V_LL / √3
      const template1PhCurrent = maxDemandKw / ((voltageLL / Math.sqrt(3) / 1000) * powerFactor);
      const floorItem1PhCurrent = maxDemandKw / (((voltageLL / 1000) / Math.sqrt(3)) * powerFactor);
      expect(template1PhCurrent).toBeCloseTo(floorItem1PhCurrent, 4);
      expect(parseFloat(template1PhCurrent.toFixed(2))).toBe(13.69);

      // 3-Phase calculation: √3 * V_LL
      const template3PhCurrent = maxDemandKw / (Math.sqrt(3) * (voltageLL / 1000) * powerFactor);
      const floorItem3PhCurrent = maxDemandKw / (Math.sqrt(3) * (voltageLL / 1000) * powerFactor);
      expect(template3PhCurrent).toBeCloseTo(floorItem3PhCurrent, 4);
      expect(parseFloat(template3PhCurrent.toFixed(2))).toBe(4.56);
    });
  });
});

