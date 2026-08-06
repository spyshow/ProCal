import { describe, it, expect } from 'vitest';
import { isThreePhaseForItem, computeFeeders, createFindBreaker, type EquipmentItem } from './feeders';
import { sizeCableAndBreaker } from './cables';
import type { FloorItem, Building, Project } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  { id: 'm1', category: 'MCCB', manufacturer: 'ABB', familyId: 'f1', familyName: 'Tmax', series: 'Tmax', model: 'T1', ratedCurrent: 16, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm2', category: 'MCCB', manufacturer: 'ABB', familyId: 'f1', familyName: 'Tmax', series: 'Tmax', model: 'T1', ratedCurrent: 25, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm3', category: 'MCCB', manufacturer: 'ABB', familyId: 'f1', familyName: 'Tmax', series: 'Tmax', model: 'T2', ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm4', category: 'MCCB', manufacturer: 'ABB', familyId: 'f1', familyName: 'Tmax', series: 'Tmax', model: 'T3', ratedCurrent: 100, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm5', category: 'MCCB', manufacturer: 'ABB', familyId: 'f1', familyName: 'Tmax', series: 'Tmax', model: 'T4', ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'ac1', category: 'ACB', manufacturer: 'ABB', familyId: 'f2', familyName: 'Emax', series: 'Emax', model: 'E1', ratedCurrent: 800, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null },
  { id: 'cb1', category: 'MCB', manufacturer: 'ABB', familyId: 'f3', familyName: 'S200', series: 'S200', model: 'S201-C16', ratedCurrent: 16, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'cb2', category: 'MCB', manufacturer: 'ABB', familyId: 'f3', familyName: 'S200', series: 'S200', model: 'S201-C32', ratedCurrent: 32, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'cb3', category: 'MCB', manufacturer: 'ABB', familyId: 'f3', familyName: 'S200', series: 'S200', model: 'S203-C32', ratedCurrent: 32, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
];

const baseProject: Project = {
  id: 'p1', name: 'Test', client: '', consultant: '', contractor: '', location: '', engineer: '', date: '',
  voltage: 400, frequency: 50, powerFactor: 0.85, country: 'US', preferredManufacturer: 'ABB',
  logoUrl: null, maxVoltageDropLighting: 3, maxVoltageDropPower: 5,
  buildings: [], apartmentTemplates: [], loadLibraryItems: [],
};

function item(overrides: Partial<FloorItem> = {}): FloorItem {
  return {
    id: 'i1', name: 'Apt A', type: 'APARTMENT',
    calculatedConnectedLoad: 5, calculatedMaxDemand: 2, calculatedCurrent: 12,
    breakerSize: '16A', cableSize: '4 mm²', voltageDrop: 0.1,
    ...overrides,
  };
}

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: 'b1', name: 'Tower A', floors: 2, serviceFloors: 0, apartmentsPerFloor: 2,
    supplyVoltage: '400', earthingSystem: 'TN-S', lightningProtection: false,
    floorDesigns: [],
    buildingLoads: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isThreePhaseForItem
// ---------------------------------------------------------------------------

describe('isThreePhaseForItem', () => {
  it('APARTMENT with a 3-phase template → true', () => {
    expect(isThreePhaseForItem(item({ apartmentTemplate: { id: 't', name: 'T', phases: 3, rooms: [], createdAt: '', updatedAt: '' } }))).toBe(true);
  });

  it('APARTMENT with a 1-phase template → false', () => {
    expect(isThreePhaseForItem(item({ apartmentTemplate: { id: 't', name: 'T', phases: 1, rooms: [], createdAt: '', updatedAt: '' } }))).toBe(false);
  });

  it('APARTMENT with no apartmentTemplate → false (defensive default)', () => {
    expect(isThreePhaseForItem(item({ apartmentTemplate: null }))).toBe(false);
  });

  it('Load Library item with phase === 3 → true', () => {
    expect(isThreePhaseForItem(item({ type: 'SERVICE_PANEL', loadLibraryItem: { id: 'l1', name: 'Pump', category: 'Pump', power: 7.5, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 10, startingCurrent: 50, notes: null } }))).toBe(true);
  });

  it('Load Library item with phase === 1 → false', () => {
    expect(isThreePhaseForItem(item({ type: 'SERVICE_PANEL', loadLibraryItem: { id: 'l2', name: 'Light', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10, runningCurrent: 4, startingCurrent: 4, notes: null } }))).toBe(false);
  });

  it('Manual panel entry (no template, no library item) → true (3-phase default)', () => {
    expect(isThreePhaseForItem(item({ type: 'PUMP_PANEL', apartmentTemplate: null, loadLibraryItem: null }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createFindBreaker
// ---------------------------------------------------------------------------

describe('createFindBreaker', () => {
  it('picks smallest MCCB from the default family', () => {
    const findBreaker = createFindBreaker(equipment, { MCCB: 'f1' }, 'ABB');
    const result = findBreaker(50, 'MCCB', 3, { familyId: 'f1' });
    expect(result.model).toContain('T2');
    expect(result.fallback).toBe(false);
  });

  it('picks MCB by pole count for single-phase apartment', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const result = findBreaker(20, 'MCB', 1);
    expect(result.model).toContain('S201-C32');
    expect(result.manufacturer).toBe('ABB');
  });

  it('picks 3P MCB for three-phase end load', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const result = findBreaker(25, 'MCB', 3);
    expect(result.model).toContain('S203-C32');
  });

  it('falls back to manufacturer + category when family has no match', () => {
    // family f2 has no MCCB rows in our fixture; fallback should pick ABB MCCB 63A
    const findBreaker = createFindBreaker(equipment, { MCCB: 'f2' }, 'ABB');
    const result = findBreaker(50, 'MCCB', 3);
    expect(result.model).toContain('T2');
    expect(result.fallback).toBe(true);
  });

  it('returns null model when nothing matches', () => {
    const findBreaker = createFindBreaker([], {}, 'ABB');
    const result = findBreaker(50, 'MCCB', 3);
    expect(result.model).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeFeeders
// ---------------------------------------------------------------------------

describe('computeFeeders', () => {
  it('floor WITH hasFloorSubPanels → one SMDB feeder sized by max-loaded phase current', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        items: [item({ calculatedCurrent: 20 }), item({ calculatedCurrent: 30 })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const smdb = mdbFeeders.filter((f) => f.type === 'SMDB');
    expect(smdb).toHaveLength(1);
    expect(smdb[0].name).toBe('F1 – SMDB');
    // PR1: per-phase balance assigns the 1-phase loads to phases; the riser
    // is sized by the max-loaded phase, not the flat sum (20+30=50).
    // With simple round-robin, first load (20) goes to L1, second (30) to L2.
    expect(smdb[0].current).toBe(30);
    expect(smdb[0].phaseCurrent).toEqual([20, 30, 0]);
    expect(smdb[0].manufacturer).toBe('ABB');
  });

  it('floor WITHOUT sub-panels → individual apartment feeders use MCB', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 }), item({ name: 'Apt B', calculatedCurrent: 18 })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders).toHaveLength(2);
    expect(mdbFeeders[0].name).toBe('F1 – Apt A');
    expect(mdbFeeders[0].breakerModel).toContain('S201');
  });

  it('SERVICE_PANEL item routes to MCCB', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ type: 'SERVICE_PANEL', name: 'Service', calculatedCurrent: 50, apartmentTemplate: null, loadLibraryItem: null })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders[0].breakerModel).toContain('T2');
  });

  it('adds an elevator building-load feeder', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      buildingLoads: [{
        id: 'bl1', buildingId: 'b1', loadLibraryItemId: 'l1', quantity: 1,
        loadLibraryItem: { id: 'l1', name: 'Elevator', category: 'Elevator', power: 22, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null },
      }],
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders.find((f) => f.type === 'Elevator')).toBeDefined();
  });

  it('smdbFeeders(floorNumber) returns per-apartment feeders for a sub-panel floor', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 3, hasFloorSubPanels: true,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 }), item({ name: 'Apt B', calculatedCurrent: 16 })],
      }],
    });
    const { smdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const f = smdbFeeders(3);
    expect(f).toHaveLength(2);
    expect(f[0].name).toBe('F3 – Apt A');
  });

  it('uses building load library item power as kW', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      buildingLoads: [{
        id: 'bl1', buildingId: 'b1', loadLibraryItemId: 'l1', quantity: 1,
        loadLibraryItem: { id: 'l1', name: 'Central AC', category: 'AC', power: 15, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null },
      }],
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const ac = mdbFeeders.find((f) => f.type === 'AC')!;
    // 15 kW @ 400V 3-phase 0.85pf ≈ 25.5 A, so breaker should be much smaller than 1600A.
    expect(ac.current).toBeCloseTo(15 / (Math.sqrt(3) * 0.4 * 0.85), 1);
    expect(ac.breakerSize).toBeLessThan(100);
  });

  it('empty equipment → fallback model, no crash', () => {
    const findBreaker = createFindBreaker([], {}, 'ABB');
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item({ calculatedCurrent: 40 })] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders).toHaveLength(1);
    expect(mdbFeeders[0].breakerModel).toMatch(/^MCB \d+$/);
    expect(mdbFeeders[0].fallback).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression tests
// ---------------------------------------------------------------------------

describe('regression: three-phase classification', () => {
  it('REGRESSION: SMDB feeder for a 3-phase apartment uses THREE-PHASE sizing (panel/page.tsx:184 was inverted)', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const threePhaseItem = item({
      calculatedCurrent: 40,
      apartmentTemplate: { id: 't', name: 'T', phases: 3, rooms: [], createdAt: '', updatedAt: '' },
    });
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: true, items: [threePhaseItem] }],
    });
    const { smdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const feeder = smdbFeeders(1)[0];

    const expected = sizeCableAndBreaker(40, true, { material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 2 });
    expect(feeder.breakerSize).toBe(expected.breakerSize);
    expect(feeder.cableSize).toBe(expected.cableSize);
  });

  it('REGRESSION: a single-phase Load Library item stays SINGLE-PHASE', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const singlePhaseLib = item({
      type: 'SERVICE_PANEL',
      calculatedCurrent: 25,
      apartmentTemplate: null,
      loadLibraryItem: { id: 'l3', name: 'Lights', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10, runningCurrent: 4, startingCurrent: 4, notes: null },
    });
    expect(isThreePhaseForItem(singlePhaseLib)).toBe(false);

    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [singlePhaseLib] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const feeder = mdbFeeders[0];

    const expected = sizeCableAndBreaker(25, false, { material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 2 });
    expect(feeder.breakerSize).toBe(expected.breakerSize);
    expect(feeder.cableSize).toBe(expected.cableSize);
  });
});
