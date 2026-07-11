import { describe, it, expect } from 'vitest';
import { isThreePhaseForItem, computeFeeders, type EquipmentItem } from './feeders';
import { sizeCableAndBreaker } from './cables';
import type { FloorItem, Building, Project } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  { id: 'm1', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T1', ratedCurrent: 16, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm2', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T1', ratedCurrent: 25, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm3', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T2', ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm4', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T3', ratedCurrent: 100, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'm5', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T4', ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
];

const findBreaker = (rating: number, category: 'MCCB' | 'ACB') => {
  const f = equipment.filter((e) => e.category === category && e.ratedCurrent >= rating);
  return f.sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0] || null;
};

const noBreaker = () => null; // empty-equipment fallback path

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
    elevators: 0, waterPumps: 0, firePump: false, splitAc: 0, centralAc: 0,
    supplyVoltage: '400', earthingSystem: 'TN-S', lightningProtection: false,
    floorDesigns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isThreePhaseForItem — 6 paths (mirrors the API routes' per-type rule)
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
    expect(isThreePhaseForItem(item({ type: 'SERVICE_PANEL', loadLibraryItem: { name: 'Pump', category: 'Pump', power: 7.5, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1 } }))).toBe(true);
  });

  it('Load Library item with phase === 1 → false (the bug D3/D10 fixes)', () => {
    expect(isThreePhaseForItem(item({ type: 'SERVICE_PANEL', loadLibraryItem: { name: 'Light', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10 } }))).toBe(false);
  });

  it('Manual panel entry (no template, no library item) → true (3-phase default)', () => {
    expect(isThreePhaseForItem(item({ type: 'PUMP_PANEL', apartmentTemplate: null, loadLibraryItem: null }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeFeeders — 8 paths
// ---------------------------------------------------------------------------

describe('computeFeeders', () => {
  it('floor WITH hasFloorSubPanels → one SMDB feeder for the whole floor', () => {
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
    expect(smdb[0].current).toBe(50); // 20 + 30
  });

  it('floor WITHOUT sub-panels → individual apartment feeders', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 }), item({ name: 'Apt B', calculatedCurrent: 18 })],
      }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders).toHaveLength(2);
    expect(mdbFeeders[0].name).toBe('F1 – Apt A');
    expect(mdbFeeders[1].name).toBe('F1 – Apt B');
  });

  it('adds an elevator building-load feeder', () => {
    const bldg = building({ elevators: 1, floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }] });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders.find((f) => f.type === 'ELEVATOR')).toBeDefined();
  });

  it('adds a water-pump feeder and respects firePump', () => {
    const bldg = building({ waterPumps: 2, firePump: true, floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }] });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders.find((f) => f.type === 'WATER_PUMP')).toBeDefined();
    expect(mdbFeeders.find((f) => f.type === 'FIRE_PUMP')).toBeDefined();
  });

  it('firePump=false → no FIRE_PUMP feeder', () => {
    const bldg = building({ firePump: false, floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }] });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, findBreaker);
    expect(mdbFeeders.find((f) => f.type === 'FIRE_PUMP')).toBeUndefined();
  });

  it('empty equipment → findBreaker returns null → "MCCB <size>" fallback, no crash', () => {
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item({ calculatedCurrent: 40 })] }],
    });
    const { mdbFeeders } = computeFeeders(bldg, baseProject, noBreaker);
    expect(mdbFeeders).toHaveLength(1);
    expect(mdbFeeders[0].breakerModel).toMatch(/^MCCB \d+$/);
  });

  it('smdbFeeders(floorNumber) returns per-apartment feeders for a sub-panel floor', () => {
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

  it('smdbFloorNumbers returns only floors with hasFloorSubPanels, in order', () => {
    const bldg = building({
      floorDesigns: [
        { id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] },
        { id: 'f2', floorNumber: 2, hasFloorSubPanels: true, items: [] },
        { id: 'f3', floorNumber: 3, hasFloorSubPanels: true, items: [] },
      ],
    });
    const { smdbFloorNumbers } = computeFeeders(bldg, baseProject, findBreaker);
    expect(smdbFloorNumbers).toEqual([2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Regression tests — CRITICAL (IRON RULE)
// ---------------------------------------------------------------------------

describe('regression: three-phase classification', () => {
  it('REGRESSION: SMDB feeder for a 3-phase apartment uses THREE-PHASE sizing (panel/page.tsx:184 was inverted)', () => {
    // Before the fix, panel/page.tsx:184 passed isThreePhase = item.type === 'APARTMENT'
    // (i.e. apartments were treated as 3-phase regardless of template), which is
    // inverted vs. the direct-feeder branch. computeFeeders must derive it from
    // apartmentTemplate.phases via isThreePhaseForItem.
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

  it('REGRESSION: a single-phase Load Library item stays SINGLE-PHASE (cable-schedule:114 forced 3-phase)', () => {
    // Before the fix, cable-schedule/page.tsx:114 used
    //   item.type !== 'APARTMENT' || apartmentTemplate?.phases === 3
    // forcing ALL non-apartments (incl. single-phase library loads) to 3-phase.
    // isThreePhaseForItem now reads loadLibraryItem.phase, so a phase:1 item
    // classifies as single-phase across all three views.
    const singlePhaseLib = item({
      type: 'SERVICE_PANEL',
      calculatedCurrent: 25,
      apartmentTemplate: null,
      loadLibraryItem: { name: 'Lights', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10 },
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
