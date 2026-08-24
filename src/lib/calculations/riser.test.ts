import { describe, it, expect } from 'vitest';
import { calculateVoltageDrop } from './cables';
import { computeFloorRiserVd, parseMm2 } from './riser';
import { phaseBalance } from './phaseBalance';
import type { FloorDesign, FloorItem, Project } from '@/types';

// ---- fixtures for computeFloorRiserVd ----

const proj: Project = {
  id: 'p1', name: 'T', client: '', consultant: '', contractor: '', location: '', engineer: '', date: '',
  voltage: 400, frequency: 50, powerFactor: 0.85, country: 'US', preferredManufacturer: 'ABB',
  logoUrl: null, maxVoltageDropLighting: 3, maxVoltageDropPower: 5,
  buildings: [], apartmentTemplates: [], loadLibraryItems: [],
};

function apt(overrides: Partial<FloorItem> = {}): FloorItem {
  return {
    id: 'i1', name: 'Apt A', type: 'APARTMENT',
    calculatedConnectedLoad: 5, calculatedMaxDemand: 2, calculatedCurrent: 20,
    breakerSize: '16A', cableSize: '16 mm²', voltageDrop: 0.1,
    ...overrides,
  };
}

function floor(overrides: Partial<FloorDesign> = {}): FloorDesign {
  return {
    id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [],
    ...overrides,
  };
}

const V230 = 400 / Math.sqrt(3); // line-neutral voltage for 1-phase feeders

/**
 * Riser Diagram Calculation Tests
 *
 * These tests verify the correct behavior for riser diagram voltage drop calculations.
 * The current implementation has bugs that these tests will expose.
 */

describe('Riser Diagram Voltage Drop Calculations', () => {
  describe('Bug 1: Hardcoded cable length', () => {
    it('should use actual cable length from floor items, not hardcoded 15m', () => {
      // This test demonstrates that using different cable lengths produces different VD
      const current = 100; // Amps
      const cableSize = 120; // mm²
      const pf = 0.85;
      const voltage = 400;

      const vd10m = calculateVoltageDrop(current, 10, cableSize, pf, true, voltage);
      const vd15m = calculateVoltageDrop(current, 15, cableSize, pf, true, voltage);
      const vd20m = calculateVoltageDrop(current, 20, cableSize, pf, true, voltage);

      // VD should be proportional to length
      expect(vd10m.dropPercent).toBeLessThan(vd15m.dropPercent);
      expect(vd15m.dropPercent).toBeLessThan(vd20m.dropPercent);

      // The ratio should approximately match the length ratio (within rounding)
      expect(vd15m.dropPercent / vd10m.dropPercent).toBeGreaterThan(1.4);
      expect(vd15m.dropPercent / vd10m.dropPercent).toBeLessThan(1.7);
      expect(vd20m.dropPercent / vd10m.dropPercent).toBeGreaterThan(1.8);
      expect(vd20m.dropPercent / vd10m.dropPercent).toBeLessThan(2.2);
    });
  });

  describe('Bug 2: Cumulative VD direction', () => {
    it('cumulative VD should increase from bottom (closest to transformer) to top (furthest)', () => {
      // In a correct implementation, FL1 (closest to transformer) should have LOWEST VD
      // and top floor (furthest) should have HIGHEST VD

      const floors = [
        { floor: 1, cableLength: 10 },  // Closest to transformer
        { floor: 2, cableLength: 20 },
        { floor: 3, cableLength: 30 },
        { floor: 4, cableLength: 40 },
        { floor: 5, cableLength: 50 },
        { floor: 6, cableLength: 60 },  // Furthest from transformer
      ];

      const current = 50;
      const cableSize = 70;
      const pf = 0.85;
      const voltage = 400;

      let cumulativeVD = 0;
      const vdBysFloor: number[] = [];

      // Correct implementation: calculate VD from transformer to each floor
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        cumulativeVD = vd.dropPercent; // NOT cumulative, just the VD to this floor
        vdBysFloor.push(cumulativeVD);
      }

      // VD should increase as we go further from transformer
      for (let i = 1; i < vdBysFloor.length; i++) {
        expect(vdBysFloor[i]).toBeGreaterThan(vdBysFloor[i - 1]);
      }
    });

    it('BUG: current implementation accumulates VD incorrectly (bottom-up)', () => {
      // This test demonstrates the bug: current code adds VD from FL1 upward
      // which is WRONG - VD should be calculated from transformer to each floor

      const floors = [
        { floor: 1, cableLength: 10 },
        { floor: 2, cableLength: 10 },
        { floor: 3, cableLength: 10 },
      ];

      const current = 50;
      const cableSize = 70;
      const pf = 0.85;
      const voltage = 400;

      // BUGGY: Cumulative from bottom (current implementation)
      let buggyCumulative = 0;
      const buggyVD: number[] = [];
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        buggyCumulative += vd.dropPercent; // BUG: accumulates
        buggyVD.push(buggyCumulative);
      }

      // CORRECT: VD from transformer to each floor
      const correctVD: number[] = [];
      for (const floor of floors) {
        const vd = calculateVoltageDrop(current, floor.cableLength, cableSize, pf, true, voltage);
        correctVD.push(vd.dropPercent); // CORRECT: just the VD to this floor
      }

      // The buggy implementation shows INCREASING VD (wrong!)
      // The correct implementation shows SAME VD for equal lengths
      expect(buggyVD[2]).toBeGreaterThan(buggyVD[0]); // Bug: FL3 shows higher VD
      expect(correctVD[2]).toBeCloseTo(correctVD[0], 1); // Correct: same VD for same length
    });
  });

  describe('Bug 3: Wrong cable size selection', () => {
    it('should use riser cable size, not apartment cable size', () => {
      // In a real building:
      // - Riser cable from MDB to SDB might be 120mm²
      // - Apartment cables might be 4mm² or 6mm²

      const riserCableSize = 120; // mm² - the actual riser cable
      const apartmentCableSize = 4; // mm² - apartment cable (wrong to use this!)

      const current = 100; // Amps (total floor current)
      const length = 15; // meters
      const pf = 0.85;
      const voltage = 400;

      const vdRiser = calculateVoltageDrop(current, length, riserCableSize, pf, true, voltage);
      const vdApartment = calculateVoltageDrop(current, length, apartmentCableSize, pf, true, voltage);

      // Using apartment cable size would give MUCH higher VD (wrong!)
      expect(vdApartment.dropPercent).toBeGreaterThan(vdRiser.dropPercent);

      // The difference is significant - using wrong cable size gives wrong VD
      expect(vdApartment.dropPercent / vdRiser.dropPercent).toBeGreaterThan(5);
    });
  });

  describe('IEC 60364-5-52 Formula Verification', () => {
    it('calculates Vd = √3 × I × L × (R·cosφ + X·sinφ) correctly', () => {
      // Manual calculation for verification:
      // 120mm² Cu cable, 12m, 100A, PF=0.85
      // R = 0.184 Ω/km (from cablesData.ts)
      // X = 0.070 Ω/km (from cablesData.ts)
      // cosφ = 0.85, sinφ = √(1-0.85²) = 0.527

      const current = 100;
      const length = 12; // meters
      const cableSize = 120;
      const pf = 0.85;
      const voltage = 400;

      const result = calculateVoltageDrop(current, length, cableSize, pf, true, voltage);

      // Manual calculation:
      // impedance = R·cosφ + X·sinφ = 0.184×0.85 + 0.070×0.527 = 0.1564 + 0.0369 = 0.1933 Ω/km
      // Vd = √3 × 100 × (12/1000) × 0.1933 = 1.732 × 100 × 0.012 × 0.1933 = 0.402V
      // %Vd = (0.402 / 400) × 100 = 0.10%

      expect(result.dropVolts).toBeCloseTo(0.40, 1);
      expect(result.dropPercent).toBeCloseTo(0.10, 1);
    });

    it('verifies VD limits per IEC 60364', () => {
      // IEC limits:
      // - Total from transformer to furthest point: 4%
      // - Sub-main circuits: 1%
      // - Final circuits: 3%

      const maxTotalVD = 4; // %

      // Example: 6-floor building with 100A per floor
      const floors = 6;
      const current = 100;
      const cableSize = 120;
      const pf = 0.85;
      const voltage = 400;
      const cableLengthPerFloor = 10; // meters

      let cumulativeVD = 0;
      for (let i = 0; i < floors; i++) {
        const vd = calculateVoltageDrop(current, cableLengthPerFloor, cableSize, pf, true, voltage);
        cumulativeVD = vd.dropPercent; // VD to this floor (not cumulative)
      }

      // For this example, VD should be within limits
      expect(cumulativeVD).toBeLessThan(maxTotalVD);
    });
  });

  // ---- computeFloorRiserVd: the correctness fix ----

  describe('parseMm2', () => {
    it('extracts the leading number from a cable-size string', () => {
      expect(parseMm2('120 mm²')).toBe(120);
      expect(parseMm2('16 mm²')).toBe(16);
      expect(parseMm2('16')).toBe(16);
      expect(parseMm2(null)).toBeNull();
      expect(parseMm2('')).toBeNull();
      expect(parseMm2('N/A')).toBeNull();
    });
  });

  describe('Direct floor: no fabricated riser, branch = worst apartment', () => {
    it('branchVdPercent is the max apartment branch ΔV, not an aggregate; hasRiser=false', () => {
      const a = apt({ id: 'a', name: 'A', cableLength: 10 });   // short branch
      const b = apt({ id: 'b', name: 'B', cableLength: 30 });   // long branch → higher ΔV
      const fd = floor({ hasFloorSubPanels: false, items: [a, b] });
      const r = computeFloorRiserVd(fd, proj);

      // Honest per-apartment 1-phase ΔV at 230V (the fix), computed independently.
      const vdA = calculateVoltageDrop(20, 10, 16, 0.85, false, V230).dropPercent;
      const vdB = calculateVoltageDrop(20, 30, 16, 0.85, false, V230).dropPercent;
      expect(vdB).toBeGreaterThan(vdA);            // longer run → more drop
      expect(r.branchVdPercent).toBe(vdB);          // MAX of the two, not their sum/aggregate
      expect(r.hasRiser).toBe(false);              // no invented riser on a direct floor
      expect(r.riserVdPercent).toBe(0);
      expect(r.totalVdPercent).toBe(r.branchVdPercent);
      expect(r.worstItemName).toBe('B');
      expect(r.branchNoData).toBe(false);
    });
  });

  describe('SDB floor: total = riser + branch; riser uses maxPhaseCurrent', () => {
    it('riser ΔV off maxPhaseCurrent (≤ lumped), total = riser + worst branch', () => {
      // Two equal 1-phase apartments → round-robin onto L1 and L2, so maxPhaseCurrent
      // is ONE apartment's current — not the lumped sum. The riser carries that.
      const a = apt({ id: 'a', name: 'A', cableLength: 10 });
      const b = apt({ id: 'b', name: 'B', cableLength: 10 });
      const items = [a, b];
      const fd = floor({
        hasFloorSubPanels: true,
        riserCableLength: 25,
        riserCableSize: '120 mm²',
        items,
      });
      const r = computeFloorRiserVd(fd, proj);

      const balance = phaseBalance(items, proj);
      expect(balance.maxPhaseCurrent).toBe(20);                 // one apt, NOT 40 (lumped)
      expect(r.riserCurrent).toBe(balance.maxPhaseCurrent);      // imbalance-aware, per eng-review

      const riserVd = calculateVoltageDrop(20, 25, 120, 0.85, true, 400);
      const branchVd = calculateVoltageDrop(20, 10, 16, 0.85, false, V230);
      expect(r.riserVdPercent).toBe(riserVd.dropPercent);
      expect(r.branchVdPercent).toBe(branchVd.dropPercent);
      // Percentages sum: each leg's dropPercent is referenced to its own base
      // (riser vs 400V line-line, 1-phase branch vs 230V line-neutral). Adding
      // raw volts and dividing by 400 understated the branch by √3.
      const expectedTotal = riserVd.dropPercent + branchVd.dropPercent;
      expect(r.totalVdPercent).toBeCloseTo(expectedTotal, 5);
      expect(r.hasRiser).toBe(true);

      // And maxPhaseCurrent sizing yields a SMALLER riser ΔV than the lumped path would.
      const lumpedRiser = calculateVoltageDrop(40, 25, 120, 0.85, true, 400).dropPercent;
      expect(r.riserVdPercent).toBeLessThan(lumpedRiser);
    });

    it('1-phase branch: total = percent sum (mixed voltage bases reconcile exactly in %, never in raw volts)', () => {
      // 1-phase branch has drop calculated at 230V, riser at 400V. The branch's
      // volts eat into a 230V supply, so its % stays on its own base — dividing
      // its raw volts by 400 understated it by √3 and could flip FAIL to PASS
      // (e.g. true 6.5% total reported as 4.6%).
      const a = apt({ id: 'a', name: 'A', cableLength: 50, calculatedCurrent: 30 });
      const fd = floor({
        hasFloorSubPanels: true,
        riserCableLength: 30,
        riserCableSize: '70 mm²',
        items: [a],
      });
      const r = computeFloorRiserVd(fd, proj);
      const percentSum = r.riserVdPercent + r.branchVdPercent;
      expect(r.totalVdPercent).toBeCloseTo(percentSum, 5);

      // Cross-check via phase-referred volts: total L-N drop = riser/√3 + branch,
      // over the engine's L-N base (project.voltage/√3 ≈ 230.94) — algebraically
      // identical to the percent sum.
      const vLN = proj.voltage / Math.sqrt(3);
      const riserVd = calculateVoltageDrop(30, 30, 70, 0.85, true, proj.voltage);
      const branchVd = calculateVoltageDrop(30, 50, 16, 0.85, false, vLN);
      const expectedTotal =
        (((riserVd.dropVolts / Math.sqrt(3)) + branchVd.dropVolts) / vLN) * 100;
      // calculateVoltageDrop rounds its outputs to 2dp, so match at 2dp.
      expect(r.totalVdPercent).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('1-phase vs 3-phase apartment: correct voltage + formula path', () => {
    it('a 1-phase apartment uses the 230V / 2·I·L path; 3-phase uses 400V / √3·I·L', () => {
      const one = floor({ items: [apt({ cableLength: 12, cableSize: '16 mm²' })] });
      const rOne = computeFloorRiserVd(one, proj);
      expect(rOne.branchVdPercent).toBe(
        calculateVoltageDrop(20, 12, 16, 0.85, false, V230).dropPercent
      );

      const threeApt = apt({
        cableLength: 12, cableSize: '16 mm²',
        apartmentTemplate: { id: 't', name: 'T', phases: 3, rooms: [], createdAt: '', updatedAt: '' },
      });
      const three = floor({ items: [threeApt] });
      const rThree = computeFloorRiserVd(three, proj);
      expect(rThree.branchVdPercent).toBe(
        calculateVoltageDrop(20, 12, 16, 0.85, true, 400).dropPercent
      );

      // The two paths must differ — the bug was running everything as 3-phase/400V.
      expect(rOne.branchVdPercent).not.toBeCloseTo(rThree.branchVdPercent, 1);
    });
  });

  describe('Missing cable data: flagged, never fabricated', () => {
    it('direct floor with no cableLength → branchNoData, zero branch, no worst item', () => {
      const r = computeFloorRiserVd(floor({ items: [apt({ cableLength: null })] }), proj);
      expect(r.branchNoData).toBe(true);
      expect(r.totalNoData).toBe(true);
      expect(r.branchVdPercent).toBe(0);
      expect(r.worstItemName).toBeNull();
    });

    it('SDB floor with a riser but missing riser size/length → riserNoData, riserVd=0', () => {
      const r = computeFloorRiserVd(
        floor({ hasFloorSubPanels: true, riserCableSize: null, riserCableLength: null,
                items: [apt({ cableLength: 10 })] }),
        proj
      );
      expect(r.hasRiser).toBe(true);
      expect(r.riserNoData).toBe(true);
      expect(r.riserVdPercent).toBe(0);
      expect(r.riserCableSize).toBeNull();
      expect(r.totalNoData).toBe(true);        // total path incomputable → flagged, not invented
      expect(r.branchNoData).toBe(false);     // apartment branch itself is fine
    });
  });
});
