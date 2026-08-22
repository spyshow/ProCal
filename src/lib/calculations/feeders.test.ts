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
    breakerSize: '', cableSize: '', voltageDrop: 0.1,
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

describe('createFindBreaker 4-tier catalog search', () => {
  const multiMfgEquipment: EquipmentItem[] = [
    ...equipment,
    { id: 'sch1', category: 'MCCB', manufacturer: 'Schneider', familyId: 'f_sch', familyName: 'ComPacT NSX', series: 'NSX', model: 'NSX250', ratedCurrent: 250, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  ];

  it('Tier 1: picks smallest MCCB from the default family (SAME_FAMILY)', () => {
    const findBreaker = createFindBreaker(multiMfgEquipment, { MCCB: 'f1' }, 'ABB');
    const result = findBreaker(50, 'MCCB', 3, { familyId: 'f1' });
    expect(result.model).toContain('T2');
    expect(result.fallback).toBe(false);
    expect(result.fallbackType).toBe('SAME_FAMILY');
  });

  it('Tier 2: falls back to same manufacturer other family (OTHER_FAMILY)', () => {
    // family f2 (Emax) has no MCCB rows; should fall back to Tmax (ABB)
    const findBreaker = createFindBreaker(multiMfgEquipment, { MCCB: 'f2' }, 'ABB');
    const result = findBreaker(50, 'MCCB', 3);
    expect(result.model).toContain('T2');
    expect(result.fallback).toBe(true);
    expect(result.fallbackType).toBe('OTHER_FAMILY');
  });

  it('Tier 3: falls back to other brand in catalog when preferred brand has no rating (OTHER_BRAND)', () => {
    // ABB has no 250A MCCB in fixture; Schneider has 250A
    const findBreaker = createFindBreaker(multiMfgEquipment, { MCCB: 'f1' }, 'ABB');
    const result = findBreaker(200, 'MCCB', 3);
    expect(result.model).toContain('Schneider');
    expect(result.fallback).toBe(true);
    expect(result.fallbackType).toBe('OTHER_BRAND');
  });

  it('Tier 4: generates rich generic engineering spec when no catalog model matches (GENERIC_SPEC)', () => {
    const findBreaker = createFindBreaker(multiMfgEquipment, {}, 'ABB');
    const result = findBreaker(5000, 'ACB', 3);
    expect(result.fallback).toBe(true);
    expect(result.fallbackType).toBe('GENERIC_SPEC');
    expect(result.model).toContain('Generic ACB 5000A 3P (50kA)');
    expect(result.genericSpec).toBeDefined();
    expect(result.genericSpec?.requiredIcuKa).toBe(50);
    expect(result.genericSpec?.standard).toBe('IEC 60947-2');
    expect(result.genericSpec?.tripUnitType).toContain('Electronic LSI');
  });

  it('picks MCB by pole count for single-phase apartment', () => {
    const findBreaker = createFindBreaker(multiMfgEquipment, {}, 'ABB');
    const result = findBreaker(20, 'MCB', 1);
    expect(result.model).toContain('S201-C32');
    expect(result.manufacturer).toBe('ABB');
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

  it('empty equipment → generic specification model, fallbackType: GENERIC_SPEC', () => {
    const findBreaker = createFindBreaker([], {}, 'ABB');
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item({ calculatedCurrent: 40 })] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders).toHaveLength(1);
    expect(mdbFeeders[0].breakerModel).toContain('Generic MCB');
    expect(mdbFeeders[0].fallback).toBe(true);
    expect(mdbFeeders[0].fallbackType).toBe('GENERIC_SPEC');
    expect(mdbFeeders[0].genericSpec).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Regression tests
// ---------------------------------------------------------------------------

describe('regression: three-phase classification', () => {
  it('REGRESSION: SMDB feeder for a 3-phase apartment uses THREE-PHASE sizing (panel/page.tsx:184 was inverted)', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    // Branch sizing now derives apartments from their UNDIVERSIFIED connected
    // load (Ib = kW / (√3·kV·PF)), so the fixture's connected load must be
    // consistent with the 40 A it asserts: 40 × √3 × 0.4 × 0.85 ≈ 23.56 kW.
    const threePhaseItem = item({
      calculatedCurrent: 40,
      calculatedConnectedLoad: 40 * Math.sqrt(3) * 0.4 * 0.85,
      apartmentTemplate: { id: 't', name: 'T', phases: 3, rooms: [], createdAt: '', updatedAt: '' },
    });
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: true, items: [threePhaseItem] }],
    });
    const { smdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const feeder = smdbFeeders(1)[0];

    const expected = sizeCableAndBreaker(40, true, { material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1 });
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

    const expected = sizeCableAndBreaker(25, false, { material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1 });
    expect(feeder.breakerSize).toBe(expected.breakerSize);
    expect(feeder.cableSize).toBe(expected.cableSize);
  });

  it('respects item and project ambientTemp and groupingCount overrides in feeder sizing', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const deratedItem = item({
      calculatedCurrent: 25,
      ambientTemp: 50,
      groupingCount: 6,
    });
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [deratedItem] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    // At ambient=50°C and grouping=6, 25A load matches 32A MCB from catalog.
    // 6mm² has derated ampacity 25.24A (< 32A), so cable sizes up to 10mm² (35.05A >= 32A).
    expect(mdbFeeders[0].breakerSize).toBe(32);
    expect(mdbFeeders[0].cableSize).toBe(10);
  });

  it('respects saved item.cableSize from the database as single source of truth', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const savedItem = item({
      calculatedCurrent: 12,
      cableSize: '16 mm²',
    });
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [savedItem] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders[0].cableSize).toBe(16);
  });

  it('respects saved riserCableSize from the database for SMDB as single source of truth', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        riserCableSize: '185 mm²',
        items: [item({ calculatedCurrent: 20 })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const smdb = mdbFeeders.find((f) => f.type === 'SMDB');
    expect(smdb).toBeDefined();
    expect(smdb!.cableSize).toBe(185);
  });

  it('respects saved riserBreakerSize from the database for SMDB override', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        riserBreakerSize: '160A',
        items: [item({ calculatedCurrent: 20 })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    const smdb = mdbFeeders.find((f) => f.type === 'SMDB');
    expect(smdb).toBeDefined();
    expect(smdb!.breakerSize).toBe(160);
    expect(smdb!.breakerModel).toContain('T4');
  });

  it('respects saved item.breakerSize override for branch circuit', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 20, breakerSize: '63A' })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders[0].breakerSize).toBe(63);
  });

  it('respects exact manual item.breakerSize (e.g. 200A) even if smallest catalog frame is larger (250A)', () => {
    const schEquipment: EquipmentItem[] = [
      { id: 'sch1', category: 'MCCB', manufacturer: 'Schneider', familyId: 'f_sch', familyName: 'ComPacT NSX', series: 'ComPacT NSX250', model: 'NSX250N 250A MicroLogic 2.2', ratedCurrent: 250, poles: 3, breakingCapacity: 50, tripUnit: null, settingsJson: null },
    ];
    const findBreaker = createFindBreaker(schEquipment, { MCCB: 'f_sch' }, 'Schneider');
    const bldg = building({
      floorDesigns: [{
        id: 'f5', floorNumber: 5, hasFloorSubPanels: false,
        items: [item({ name: 'Parking', type: 'SERVICE_PANEL', calculatedCurrent: 135.8, breakerSize: '200A' })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, { ...baseProject, preferredManufacturer: 'Schneider' }, findBreaker);
    expect(mdbFeeders[0].breakerSize).toBe(200);
    expect(mdbFeeders[0].breakerModel).toBe('Schneider ComPacT NSX250 NSX250N 200A MicroLogic 2.2');
  });

  it('handles floors with zero current without throwing CalculationError for ir=0', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        riserBreakerSize: '160A',
        items: [], // empty floor
      }],
    });
    expect(() => computeFeeders(bldg, baseProject, findBreaker)).not.toThrow();
  });

  it('re-sizes the main incomer cable to the catalog breaker frame so Iz >= In', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    // ~110A demand → load-based standard breaker is 125A (35mm², Iz ≈ 138A),
    // but the smallest catalog MCCB covering the required Icu is the 160A
    // frame. The incomer breaker is upsized to 160A, so the cable must be
    // re-sized too — otherwise In (160A) > Iz (138A) leaves it under-protected.
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ type: 'SERVICE_PANEL', name: 'Mech', calculatedCurrent: 110, calculatedMaxDemand: 65, apartmentTemplate: null, loadLibraryItem: null })],
      }],
    });
    const result = computeFeeders(bldg, baseProject, findBreaker);

    // Catalog frame beats the load-based 125A standard breaker
    expect(result.mainBreakerIn).toBe(160);
    // Ib <= In <= Iz: the incomer cable ampacity must cover the catalog frame
    expect(result.mainCableIz).toBeGreaterThanOrEqual(result.mainBreakerIn);
    // The cable actually grew beyond the load-based sizing (the bug: it used to
    // stay on the 125A-sized cable with Iz < 160A)
    const loadBased = sizeCableAndBreaker(110.38, true, { material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1 });
    expect(result.mainCableIz).toBeGreaterThan(loadBased.deratedAmpacity);
    // Ir stays tuned to the load and below the cable ampacity
    expect(result.mainIncomerSettings.ir).toBeLessThanOrEqual(result.mainCableIz);
  });

  it('incorporates parallel cable runs into terminal fault current calculation (Isc increases with parallel runs)', () => {
    const findBreaker = createFindBreaker(equipment, {}, 'ABB');
    const bldgSingle = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        riserCableSize: '1 × 240 mm²',
        items: [item({ calculatedCurrent: 50 })],
      }],
    });
    const bldgParallel = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: true,
        riserCableSize: '2 × 240 mm²',
        items: [item({ calculatedCurrent: 50 })],
      }],
    });

    const resSingle = computeFeeders(bldgSingle, baseProject, findBreaker);
    const resParallel = computeFeeders(bldgParallel, baseProject, findBreaker);

    const riserSingle = resSingle.mdbFeeders.find((f) => f.type === 'SMDB')!;
    const riserParallel = resParallel.mdbFeeders.find((f) => f.type === 'SMDB')!;

    expect(riserSingle.parallelRuns).toBe(1);
    expect(riserParallel.parallelRuns).toBe(2);
    // Loop impedance is halved for 2 runs, so terminal fault current is strictly higher
    expect(riserParallel.faultCurrentKa!).toBeGreaterThan(riserSingle.faultCurrentKa!);
  });
});

