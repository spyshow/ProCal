import { describe, it, expect } from 'vitest';
import {
  aggregateBOM,
  aggregateFeederRows,
  aggregateCableRows,
  aggregateBreakerRows,
  aggregateVoltageDropRows,
  type EquipmentItem,
} from './aggregates';
import type { Building, FloorItem, Project } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  { id: 'm1', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T1', ratedCurrent: 16, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm2', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T1', ratedCurrent: 25, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm3', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T2', ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm4', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T3', ratedCurrent: 100, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm5', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T4', ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm6', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T5', ratedCurrent: 250, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm7', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T6', ratedCurrent: 630, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  // MCBs for per-apartment feeders.
  { id: 'mc1', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S201', ratedCurrent: 16, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc2', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S202', ratedCurrent: 20, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc3', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S203', ratedCurrent: 25, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc4', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S204', ratedCurrent: 32, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc5', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S205', ratedCurrent: 40, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc6', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S206', ratedCurrent: 63, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
];

import type { FindBreaker, FoundBreaker } from '@/lib/calculations/feeders';

const findBreaker: FindBreaker = (currentRating, category) => {
  const match = equipment.find((e) => e.category === category && e.ratedCurrent >= currentRating);
  if (match) {
    return {
      model: `${match.manufacturer} ${match.series} ${match.model}`,
      manufacturer: match.manufacturer,
      familyName: match.familyName,
      ratedCurrent: match.ratedCurrent,
      fallback: false,
      fallbackType: 'SAME_FAMILY',
    };
  }
  return {
    model: null,
    manufacturer: null,
    familyName: null,
    ratedCurrent: null,
    fallback: true,
    fallbackType: 'GENERIC_SPEC',
  };
};

const noBreaker: FindBreaker = () => ({
  model: null,
  manufacturer: null,
  familyName: null,
  ratedCurrent: null,
  fallback: true,
  fallbackType: 'GENERIC_SPEC',
});

const baseProject: Project = {
  id: 'p1', name: 'Test', client: '', consultant: '', contractor: '', location: '', engineer: '', date: '',
  voltage: 400, frequency: 50, powerFactor: 0.85, country: 'US', preferredManufacturer: 'ABB',
  logoUrl: null, maxVoltageDropLighting: 3, maxVoltageDropPower: 5,
  buildings: [], apartmentTemplates: [], loadLibraryItems: [],
};

function item(overrides: Partial<FloorItem> = {}): FloorItem {
  return {
    id: 'i1', name: 'Apt A', type: 'APARTMENT',
    calculatedConnectedLoad: 5, calculatedMaxDemand: 4, calculatedCurrent: 12,
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

function projectWithBuildings(buildings: Building[]): Project {
  return { ...baseProject, buildings };
}

// ---------------------------------------------------------------------------
// aggregateBOM
// ---------------------------------------------------------------------------

describe('aggregateBOM', () => {
  it('aggregates cables by size and breakers by rating', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [
          item({ cableSize: '4 mm²', breakerSize: '16A', cableLength: 20 }),
          item({ cableSize: '4 mm²', breakerSize: '16A', cableLength: 30 }),
          item({ cableSize: '6 mm²', breakerSize: '25A', cableLength: 15 }),
        ],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.cables).toHaveLength(2);
    const cable4 = result.cables.find((c) => c.size === 4);
    const cable6 = result.cables.find((c) => c.size === 6);
    expect(cable4).toBeDefined();
    expect(cable4!.count).toBe(2);
    expect(cable4!.totalLength).toBe(50);
    expect(cable6).toBeDefined();
    expect(cable6!.count).toBe(1);

    expect(result.breakers).toHaveLength(2);
    const breaker16 = result.breakers.find((b) => b.rating === 16);
    const breaker25 = result.breakers.find((b) => b.rating === 25);
    expect(breaker16).toBeDefined();
    expect(breaker16!.count).toBe(2);
    expect(breaker25).toBeDefined();
    expect(breaker25!.count).toBe(1);
  });

  it('differentiates between 2 cores for 1-phase and 4 cores for 3-phase cables', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [
          // 1-phase apartment load: 4 mm² -> 2C × 4 mm²
          item({ type: 'APARTMENT', cableSize: '4 mm²', apartmentTemplate: { id: 't1', name: '1P', phases: 1 } as any, cableLength: 20 }),
          // 3-phase manual or elevator load: 4 mm² -> 4C × 4 mm²
          item({ type: 'ELEVATOR', cableSize: '4 mm²', apartmentTemplate: null, cableLength: 35 }),
        ],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.cables).toHaveLength(2);
    const cable1P = result.cables.find((c) => c.cores === 2);
    const cable3P = result.cables.find((c) => c.cores === 4);

    expect(cable1P).toBeDefined();
    expect(cable1P!.size).toBe(4);
    expect(cable1P!.cores).toBe(2);
    expect(cable1P!.description).toBe('2C × 4 mm²');
    expect(cable1P!.totalLength).toBe(20);

    expect(cable3P).toBeDefined();
    expect(cable3P!.size).toBe(4);
    expect(cable3P!.cores).toBe(4);
    expect(cable3P!.description).toBe('4C × 4 mm²');
    expect(cable3P!.totalLength).toBe(35);
  });

  it('falls back to estimated length when cableLength is not set', () => {
    const bldg = building({
      floorDesigns: [
        { id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item({ cableLength: null })] },
        { id: 'f2', floorNumber: 3, hasFloorSubPanels: false, items: [item({ cableLength: null })] },
      ],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.cables[0].totalLength).toBe(10 + (10 + 2 * 5));
  });

  it('falls back to default cable size 4 when cableSize is empty', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ cableSize: '' })],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.cables[0].size).toBe(4);
  });

  it('falls back to 0A breaker rating when breakerSize contains no digits', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ breakerSize: 'unknown' })],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.breakers[0].rating).toBe(0);
  });

  it('sorts cables and breakers ascending', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [
          item({ cableSize: '10 mm²', breakerSize: '63A' }),
          item({ cableSize: '2.5 mm²', breakerSize: '25A' }),
          item({ cableSize: '6 mm²', breakerSize: '16A' }),
        ],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([bldg]));

    expect(result.cables.map((c) => c.size)).toEqual([2.5, 6, 10]);
    expect(result.breakers.map((b) => b.rating)).toEqual([16, 25, 63]);
  });

  it('aggregates across multiple buildings', () => {
    const b1 = building({
      name: 'Tower A',
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ cableSize: '4 mm²', breakerSize: '16A' })],
      }],
    });
    const b2 = building({
      id: 'b2', name: 'Tower B',
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ cableSize: '4 mm²', breakerSize: '16A' })],
      }],
    });

    const result = aggregateBOM(projectWithBuildings([b1, b2]));

    expect(result.cables[0].count).toBe(2);
    expect(result.breakers[0].count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateFeederRows
// ---------------------------------------------------------------------------

describe('aggregateFeederRows', () => {
  it('creates indexed feeder rows for per-apartment feeders', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 }), item({ name: 'Apt B', calculatedCurrent: 18 })],
      }],
    });

    const rows = aggregateFeederRows(projectWithBuildings([bldg]), findBreaker);

    expect(rows).toHaveLength(2);
    expect(rows[0].index).toBe(1);
    expect(rows[0].feeder).toBe('F1 – Apt A');
    expect(rows[1].index).toBe(2);
    expect(rows[1].feeder).toBe('F1 – Apt B');
    expect(rows[0].buildingName).toBe('Tower A');
  });

  it('marks SMDB feeders as sub-panels and emits per-apartment SMDB feeders', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 2, hasFloorSubPanels: true,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 })],
      }],
    });

    const rows = aggregateFeederRows(projectWithBuildings([bldg]), findBreaker);

    const smdb = rows.find((r) => r.type === 'SMDB');
    expect(smdb).toBeDefined();
    expect(smdb!.isSubPanel).toBe(true);
    const apt = rows.find((r) => r.feeder === 'F2 – Apt A');
    expect(apt).toBeDefined();
    expect(apt!.isSubPanel).toBe(false);
  });

  it('computes demandKw from current and project voltage', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 100 })],
      }],
    });

    const rows = aggregateFeederRows(projectWithBuildings([bldg]), findBreaker);

    const expectedKw = 1.73205 * 0.4 * 100 * 0.85;
    expect(rows[0].demandKw).toBeCloseTo(expectedKw, 1);
  });

  it('uses fallback breaker model when no equipment is found', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 40 })],
      }],
    });

    const rows = aggregateFeederRows(projectWithBuildings([bldg]), noBreaker);

    expect(rows[0].breakerModel).toMatch(/^(MCB|MCCB) \d+$/);
  });

  it('preserves continuous index across buildings', () => {
    const b1 = building({ id: 'b1', name: 'A1', floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item()] }] });
    const b2 = building({ id: 'b2', name: 'A2', floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item()] }] });

    const rows = aggregateFeederRows(projectWithBuildings([b1, b2]), findBreaker);

    expect(rows[0].index).toBe(1);
    expect(rows[1].index).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateCableRows
// ---------------------------------------------------------------------------

describe('aggregateCableRows', () => {
  it('generates circuit tags from floor and item index', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 3, hasFloorSubPanels: false,
        items: [item({ name: 'Apt A' }), item({ name: 'Apt B' })],
      }],
    });

    const rows = aggregateCableRows(projectWithBuildings([bldg]));

    expect(rows.map((r) => r.circuit)).toEqual(['F3-A', 'F3-B']);
  });

  it('resolves phase count from apartment template', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({
          apartmentTemplate: { id: 't', name: 'T', phases: 3, rooms: [], createdAt: '', updatedAt: '' },
        })],
      }],
    });

    const rows = aggregateCableRows(projectWithBuildings([bldg]));

    expect(rows[0].phase).toBe(3);
  });

  it('resolves phase count from load library item', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({
          type: 'SERVICE_PANEL',
          apartmentTemplate: null,
          loadLibraryItem: { id: 'l1', name: 'Lights', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10, runningCurrent: 4, startingCurrent: 4, notes: null },
        })],
      }],
    });

    const rows = aggregateCableRows(projectWithBuildings([bldg]));

    expect(rows[0].phase).toBe(1);
  });

  it('defaults manual panels to 3-phase', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ type: 'PUMP_PANEL', apartmentTemplate: null, loadLibraryItem: null })],
      }],
    });

    const rows = aggregateCableRows(projectWithBuildings([bldg]));

    expect(rows[0].phase).toBe(3);
  });

  it('falls back to default method C and XLPE insulation when not set', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item()],
      }],
    });

    const rows = aggregateCableRows(projectWithBuildings([bldg]));

    expect(rows[0].method).toBe('C');
    expect(rows[0].insulation).toBe('XLPE');
  });
});

// ---------------------------------------------------------------------------
// aggregateBreakerRows
// ---------------------------------------------------------------------------

describe('aggregateBreakerRows', () => {
  it('creates breaker rows for Main Incomer, MDB, and SMDB feeders', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 2, hasFloorSubPanels: true,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 })],
      }],
    });

    const rows = aggregateBreakerRows(projectWithBuildings([bldg]), findBreaker);

    const incomerRow = rows.find((r) => r.type === 'INCOMER');
    const mdbRow = rows.find((r) => r.type === 'SMDB');
    const smdbRow = rows.find((r) => r.feeder === 'F2 – Apt A');
    expect(incomerRow).toBeDefined();
    expect(incomerRow!.floor).toBe(0);
    expect(incomerRow!.isThreePhase).toBe(true);
    expect(mdbRow).toBeDefined();
    expect(mdbRow!.floor).toBe(2);
    expect(smdbRow).toBeDefined();
  });

  it('includes building-load feeders (water pump, elevator, etc.)', () => {
    const bldg = building({
      buildingLoads: [{
        id: 'bl1', buildingId: 'b1', loadLibraryItemId: 'l1', quantity: 1,
        loadLibraryItem: { id: 'l1', name: 'Water Pump', category: 'Pump', power: 7.5, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 1, quantity: 1, runningCurrent: 0, startingCurrent: null, notes: null },
      }],
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [] }],
    });

    const rows = aggregateBreakerRows(projectWithBuildings([bldg]), findBreaker);

    expect(rows.find((r) => r.type === 'Pump')).toBeDefined();
  });

  it('uses fallback breaker model when no equipment is found', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 40 })],
      }],
    });

    const rows = aggregateBreakerRows(projectWithBuildings([bldg]), noBreaker);

    const branchRow = rows.find((r) => r.type === 'APARTMENT');
    expect(branchRow?.breakerModel).toMatch(/^(MCB|MCCB) \d+$/);
  });

  it('marks apartment rows as non-three-phase and incomer as three-phase', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ apartmentTemplate: { id: 't', name: 'T', phases: 1, rooms: [], createdAt: '', updatedAt: '' } })],
      }],
    });

    const rows = aggregateBreakerRows(projectWithBuildings([bldg]), findBreaker);

    const branchRow = rows.find((r) => r.type === 'APARTMENT');
    expect(branchRow?.isThreePhase).toBe(false);
    const incomerRow = rows.find((r) => r.type === 'INCOMER');
    expect(incomerRow?.isThreePhase).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aggregateVoltageDropRows
// ---------------------------------------------------------------------------

describe('aggregateVoltageDropRows', () => {
  it('calculates voltage drop and status', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 30, cableSize: '6 mm²', cableLength: 20 })],
      }],
    });

    const rows = aggregateVoltageDropRows(projectWithBuildings([bldg]));

    expect(rows).toHaveLength(1);
    expect(rows[0].voltageDropPercent).toBeGreaterThan(0);
    expect(rows[0].status).toBeOneOf(['OK', 'WARNING', 'FAIL']);
  });

  it('uses lighting voltage-drop limit for apartments', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ type: 'APARTMENT', calculatedCurrent: 10, cableSize: '1.5 mm²', cableLength: 100 })],
      }],
    });

    const rows = aggregateVoltageDropRows(projectWithBuildings([bldg]));

    // Lighting limit is stricter (3%); this thin long cable should fail.
    expect(rows[0].status).toBe('FAIL');
  });

  it('uses power voltage-drop limit for non-apartments', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({
          type: 'SERVICE_PANEL',
          calculatedCurrent: 10,
          cableSize: '6 mm²',
          cableLength: 50,
          apartmentTemplate: null,
          loadLibraryItem: { id: 'l2', name: 'Lights', category: 'Lighting', power: 1, voltage: 230, phase: 1, powerFactor: 0.9, demandFactor: 0.8, quantity: 10, runningCurrent: 4, startingCurrent: 4, notes: null },
        })],
      }],
    });

    const rows = aggregateVoltageDropRows(projectWithBuildings([bldg]));

    // Power limit is lenient (5%); a reasonably sized short cable should be OK.
    expect(rows[0].status).toBe('OK');
  });

  it('falls back to estimated length when cableLength is null', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 2, hasFloorSubPanels: false,
        items: [item({ cableLength: null, cableSize: '4 mm²', calculatedCurrent: 10 })],
      }],
    });

    const rows = aggregateVoltageDropRows(projectWithBuildings([bldg]));

    expect(rows[0].lengthMeters).toBe(10 + (2 - 1) * 5);
  });

  it('uses single-phase voltage for 230V projects', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 20, cableSize: '4 mm²', cableLength: 30 })],
      }],
    });

    const project230 = { ...baseProject, voltage: 230 };
    const rows400 = aggregateVoltageDropRows(projectWithBuildings([bldg]));
    const rows230 = aggregateVoltageDropRows({ ...project230, buildings: [bldg] });

    expect(rows230[0].voltageDropPercent).toBeGreaterThan(rows400[0].voltageDropPercent);
  });
});
