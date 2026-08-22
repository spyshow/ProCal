import { describe, it, expect } from 'vitest';
import { computeFeeders, createFindBreaker, type EquipmentItem, type FindBreaker } from './feeders';
import { sizeCableAndBreaker } from './cables';
import { getApartmentDiversityFactor, calculateThreePhaseCurrent, sizeTransformer } from './loads';
import type { Building, BuildingLoad, FloorDesign, FloorItem, LoadLibraryItem, Project } from '@/types';

// ---------------------------------------------------------------------------
// Mixed-Brand Equipment Catalog
//
// Mirrors the seeded catalog shape: multiple brands with distinct Icu tiers so
// different buildings resolve to different real frames, and the same-brand
// selectivity matrix only applies to genuine catalog pairs.
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  // ABB S200 MCB 1P (Icu 6 kA)
  ...([16, 20, 25, 32, 40, 50, 63] as const).map((a) => ({
    id: `abb-mcb1-${a}`, category: 'MCB', manufacturer: 'ABB', familyId: 'abb-mcb', familyName: 'S200',
    series: 'S200', model: `S201-C${a}`, ratedCurrent: a, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null,
  })),
  // ABB S200 MCB 3P (Icu 6 kA)
  ...([16, 20, 25, 32, 40, 50, 63] as const).map((a) => ({
    id: `abb-mcb3-${a}`, category: 'MCB', manufacturer: 'ABB', familyId: 'abb-mcb', familyName: 'S200',
    series: 'S200', model: `S203-C${a}`, ratedCurrent: a, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null,
  })),
  // Schneider Acti9 iC60N MCB 3P (Icu 10 kA) — higher-Icu branch alternative
  ...([16, 20, 25, 32, 40, 50, 63] as const).map((a) => ({
    id: `se-mcb3-${a}`, category: 'MCB', manufacturer: 'Schneider Electric', familyId: 'se-mcb', familyName: 'Acti9',
    series: 'Acti9', model: `iC60N C${a}`, ratedCurrent: a, poles: 3, breakingCapacity: 10, tripUnit: null, settingsJson: null,
  })),
  // ABB Tmax XT MCCB 3P (Icu 36 kA)
  ...([16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630] as const).map((a) => ({
    id: `abb-mccb-${a}`, category: 'MCCB', manufacturer: 'ABB', familyId: 'abb-mccb', familyName: 'Tmax XT',
    series: 'Tmax XT', model: `XT${a <= 160 ? '1N' : a <= 250 ? '3N' : a <= 400 ? '5N' : '6N'} ${a}`,
    ratedCurrent: a, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null,
  })),
  // Schneider ComPacT NSX MCCB 3P (Icu 50 kA)
  ...([100, 125, 160, 200, 250, 320, 400, 500, 630] as const).map((a) => ({
    id: `se-mccb-${a}`, category: 'MCCB', manufacturer: 'Schneider Electric', familyId: 'se-mccb', familyName: 'ComPacT NSX',
    series: 'ComPacT NSX', model: `NSX${a}N`, ratedCurrent: a, poles: 3, breakingCapacity: 50, tripUnit: null, settingsJson: null,
  })),
  // ABB Emax 2 ACB 3P (Icu 42 kA)
  ...([800, 1000, 1250, 1600, 2000, 2500] as const).map((a) => ({
    id: `abb-acb-${a}`, category: 'ACB', manufacturer: 'ABB', familyId: 'abb-acb', familyName: 'Emax 2',
    series: 'Emax 2', model: `E${a <= 1000 ? '1.2N' : a <= 1600 ? '2.2N' : '3.2N'} ${a}`,
    ratedCurrent: a, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null,
  })),
  // Schneider MasterPact MTZ ACB 3P (Icu 65 kA)
  ...([800, 1000, 1250, 1600, 2000, 2500] as const).map((a) => ({
    id: `se-acb-${a}`, category: 'ACB', manufacturer: 'Schneider Electric', familyId: 'se-acb', familyName: 'MasterPact MTZ',
    series: 'MasterPact MTZ', model: `MTZ1 ${a}`, ratedCurrent: a, poles: 3, breakingCapacity: 65, tripUnit: null, settingsJson: null,
  })),
];

const findBreaker: FindBreaker = createFindBreaker(
  equipment,
  { ACB: 'abb-acb', MCCB: 'abb-mccb', MCB: 'abb-mcb' },
  'ABB'
);

// ---------------------------------------------------------------------------
// Project — transformer left unset so EACH BUILDING sizes its own transformer
// from its own demand (the per-building path the riser page relies on).
// ---------------------------------------------------------------------------

const project: Project = {
  id: 'proj-mixed-use',
  name: 'Test Project - Mixed Use Complex',
  client: 'ABC Development Corp',
  consultant: 'XYZ Engineering Consultants',
  contractor: 'Build It Construction',
  location: 'Dubai, UAE',
  engineer: 'John Smith',
  date: '2026-07-22',
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  transformerSize: null,
  country: 'UAE',
  calculationStandard: 'IEC',
  preferredManufacturer: 'ABB',
  maxVoltageDropLighting: 3,
  maxVoltageDropPower: 5,
  ambientTemp: 30,
  groupingCount: 1,
  buildings: [],
  apartmentTemplates: [],
  loadLibraryItems: [],
};

// ---------------------------------------------------------------------------
// Loads Layer — replicates the item-creation math in
// src/app/api/floors/[id]/items/route.ts so the chain runs from RAW inputs:
//
//   APARTMENT:  maxDemand = connectedLoad × getApartmentDiversityFactor(building apt count)
//               current   = maxDemand / (√3·V·PF)          (3-phase)
//                           maxDemand / ((V/√3)·PF)        (1-phase)
//   MANUAL:     maxDemand = kw × 0.8 (SERVICE_PANEL), current = maxDemand / (√3·V·PF)
//   LIBRARY:    maxDemand = power × qty × demandFactor
//
// Breaker and cable sizes are then stored via sizeCableAndBreaker exactly as
// the route does (XLPE, 30 °C, install method C; grouping 1 for apartments,
// grouping 2 for library/manual), so the fixture mirrors seeded data.
// ---------------------------------------------------------------------------

const voltageKv = project.voltage / 1000; // 0.4 kV
const powerFactor = project.powerFactor;  // 0.85

function apartmentItem(
  opts: {
    id: string;
    name: string;
    floorDesignId: string;
    connectedKw: number;
    phases: 1 | 3;
    templateId: string;
    templateName: string;
    aptCount: number;
    cableLength: number;
    idx: number; // deterministic phase spread for 1-phase units
  }
): FloorItem {
  const isThreePhase = opts.phases === 3;
  const connected = opts.connectedKw;
  const maxDemand = connected * getApartmentDiversityFactor(opts.aptCount);
  const current = isThreePhase
    ? maxDemand / (Math.sqrt(3) * voltageKv * powerFactor)
    : maxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, installMethod: 'C',
  });
  return {
    id: opts.id,
    name: opts.name,
    type: 'APARTMENT',
    calculatedConnectedLoad: connected,
    calculatedMaxDemand: maxDemand,
    calculatedCurrent: parseFloat(current.toFixed(2)),
    breakerSize: `${sizing.breakerSize}A`,
    cableSize: `${sizing.cableSize} mm²`,
    cableLength: opts.cableLength,
    voltageDrop: 0.1,
    installMethod: 'C',
    cableInsulation: 'XLPE',
    apartmentTemplate: { id: opts.templateId, name: opts.templateName, phases: opts.phases, rooms: [], createdAt: '', updatedAt: '' },
    assignedPhase: isThreePhase ? null : ((opts.idx % 3) + 1),
  };
}

function servicePanelItem(
  opts: { id: string; name: string; floorDesignId: string; kw: number; cableLength: number }
): FloorItem {
  const maxDemand = opts.kw * 0.8; // SERVICE_PANEL df = 0.8 (route)
  const current = maxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
  const sizing = sizeCableAndBreaker(current, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 2, installMethod: 'C',
  });
  return {
    id: opts.id,
    name: opts.name,
    type: 'SERVICE_PANEL',
    calculatedConnectedLoad: opts.kw,
    calculatedMaxDemand: maxDemand,
    calculatedCurrent: parseFloat(current.toFixed(2)),
    breakerSize: `${sizing.breakerSize}A`,
    cableSize: `${sizing.cableSize} mm²`,
    cableLength: opts.cableLength,
    voltageDrop: 0.1,
    installMethod: 'C',
    cableInsulation: 'XLPE',
    apartmentTemplate: null,
    loadLibraryItem: null,
  };
}

function libraryLoad(
  opts: { id: string; lib: LoadLibraryItem; qty: number; cableLength: number; material?: 'copper' | 'aluminum' }
): BuildingLoad {
  const isThreePhase = opts.lib.phase === 3;
  const totalKw = opts.lib.power * opts.qty;
  const current = isThreePhase
    ? totalKw / (Math.sqrt(3) * (opts.lib.voltage / 1000) * opts.lib.powerFactor)
    : totalKw / ((opts.lib.voltage / 1000) * opts.lib.powerFactor);
  const material = opts.material ?? 'copper';
  // feederFromBuildingLoad evaluates the stored cable at
  // groupingCount = load.groupingCount ?? project.groupingCount ?? 1 and the
  // stored material, so the stored cable must be sized with the SAME options
  // to guarantee In <= Iz.
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material, insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, installMethod: 'C',
  });
  return {
    id: opts.id,
    buildingId: 'unused',
    loadLibraryItemId: opts.lib.id,
    loadLibraryItem: opts.lib,
    quantity: opts.qty,
    // formattedCableSize keeps parallel runs ("2 × 120 mm²") — storing only
    // the per-run size would make the downstream evaluation see a single
    // under-sized run (the exact bug the API routes used to have).
    cableSize: sizing.formattedCableSize,
    cableLength: opts.cableLength,
    installMethod: 'C',
    cableInsulation: 'XLPE',
    cableMaterial: material,
    groupingCount: 1,
  };
}

const lib = {
  elevator: { id: 'lib-elev', name: 'Elevator', category: 'Elevator', power: 15, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 0.7, quantity: 1, runningCurrent: 26.9, startingCurrent: 150, notes: null } as LoadLibraryItem,
  firePump: { id: 'lib-fp', name: 'Fire Pump', category: 'Pump', power: 22, voltage: 400, phase: 3, powerFactor: 0.8, demandFactor: 1.0, quantity: 1, runningCurrent: 39.7, startingCurrent: 350, notes: null } as LoadLibraryItem,
  waterPump: { id: 'lib-wp', name: 'Water Pump', category: 'Pump', power: 7.5, voltage: 400, phase: 3, powerFactor: 0.8, demandFactor: 0.8, quantity: 1, runningCurrent: 13.5, startingCurrent: 60, notes: null } as LoadLibraryItem,
  hvac: { id: 'lib-hvac', name: 'HVAC System', category: 'AC', power: 250, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 0.9, quantity: 1, runningCurrent: 424.6, startingCurrent: null, notes: null } as LoadLibraryItem,
  escalator: { id: 'lib-esc', name: 'Escalator', category: 'Elevator', power: 30, voltage: 400, phase: 3, powerFactor: 0.85, demandFactor: 0.9, quantity: 1, runningCurrent: 50.9, startingCurrent: null, notes: null } as LoadLibraryItem,
  emergencyLighting: { id: 'lib-eml', name: 'Emergency Lighting', category: 'Lighting', power: 20, voltage: 400, phase: 3, powerFactor: 0.9, demandFactor: 0.9, quantity: 1, runningCurrent: 32.1, startingCurrent: null, notes: null } as LoadLibraryItem,
};

// ---------------------------------------------------------------------------
// Building 1 — Residential Tower A (8 floors, 28 apartments, 3 building loads)
// Floors 1–4: direct apartment feeders off the MDB.
// Floors 5–8: sub-panels (SMDB riser + apartment branches).
// ---------------------------------------------------------------------------

function buildTowerA(): Building {
  const aptCount = 28; // 4 floors × 3 + 4 floors × 4 → diversity 0.5
  const floorDesigns: FloorDesign[] = [];
  const itemDefs = [
    { name: 'Apt A', connectedKw: 12, phases: 1 as const, template: 'Studio (1Φ)' },
    { name: 'Apt B', connectedKw: 15, phases: 1 as const, template: '1-Bed (1Φ)' },
    { name: 'Apt C', connectedKw: 18, phases: 1 as const, template: '2-Bed (1Φ)' },
    { name: 'Apt D', connectedKw: 20, phases: 3 as const, template: '3-Bed (3Φ)' },
  ];

  for (let f = 1; f <= 8; f++) {
    const sub = f >= 5;
    const count = sub ? 4 : 3;
    const items: FloorItem[] = [];
    for (let i = 0; i < count; i++) {
      const def = itemDefs[i];
      items.push(
        apartmentItem({
          id: `a-f${f}-${i}`,
          name: `Apt ${i + 1} (${f}F)`,
          floorDesignId: `a-fd-${f}`,
          connectedKw: def.connectedKw,
          phases: def.phases,
          templateId: `tpl-${i}`,
          templateName: def.template,
          aptCount,
          cableLength: 10 + f + i,
          idx: i,
        })
      );
    }
    floorDesigns.push({
      id: `a-fd-${f}`,
      floorNumber: f,
      hasFloorSubPanels: sub,
      riserCableLength: sub ? f * 3 : null,
      items,
    });
  }

  return {
    id: 'bldg-tower-a',
    name: 'Residential Tower A',
    floors: 8,
    serviceFloors: 1,
    apartmentsPerFloor: 4,
    supplyVoltage: '400V 3-Phase',
    earthingSystem: 'TN-S',
    lightningProtection: true,
    floorDesigns,
    buildingLoads: [
      libraryLoad({ id: 'a-bl-elev', lib: lib.elevator, qty: 2, cableLength: 45 }),
      libraryLoad({ id: 'a-bl-fp', lib: lib.firePump, qty: 1, cableLength: 25 }),
      libraryLoad({ id: 'a-bl-wp', lib: lib.waterPump, qty: 2, cableLength: 30 }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Building 2 — Residential Tower B (6 floors, 18 apartments, 2 building loads)
// Floors 1–3 direct; floors 4–6 sub-panels.
// ---------------------------------------------------------------------------

function buildTowerB(): Building {
  const aptCount = 18; // 6 floors × 3 → diversity 0.55
  const floorDesigns: FloorDesign[] = [];
  const itemDefs = [
    { name: 'Apt A', connectedKw: 16, phases: 1 as const, template: 'Studio (1Φ)' },
    { name: 'Apt B', connectedKw: 20, phases: 1 as const, template: '2-Bed (1Φ)' },
    { name: 'Apt C', connectedKw: 22, phases: 3 as const, template: '3-Bed (3Φ)' },
  ];

  for (let f = 1; f <= 6; f++) {
    const sub = f >= 4;
    const items: FloorItem[] = itemDefs.map((def, i) =>
      apartmentItem({
        id: `b-f${f}-${i}`,
        name: `Apt ${i + 1} (${f}F)`,
        floorDesignId: `b-fd-${f}`,
        connectedKw: def.connectedKw,
        phases: def.phases,
        templateId: `tpl-${i}`,
        templateName: def.template,
        aptCount,
        cableLength: 12 + f + i,
        idx: i,
      })
    );
    floorDesigns.push({
      id: `b-fd-${f}`,
      floorNumber: f,
      hasFloorSubPanels: sub,
      riserCableLength: sub ? f * 3 : null,
      items,
    });
  }

  return {
    id: 'bldg-tower-b',
    name: 'Residential Tower B',
    floors: 6,
    serviceFloors: 1,
    apartmentsPerFloor: 3,
    supplyVoltage: '400V 3-Phase',
    earthingSystem: 'TN-S',
    lightningProtection: false,
    floorDesigns,
    buildingLoads: [
      libraryLoad({ id: 'b-bl-elev', lib: lib.elevator, qty: 1, cableLength: 40 }),
      libraryLoad({ id: 'b-bl-wp', lib: lib.waterPump, qty: 1, cableLength: 25 }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Building 3 — Shopping Mall (4 floors, all sub-panels, commercial panels +
// HVAC/escalator/lighting building loads). Heaviest building → largest
// transformer and an ACB main incomer.
// ---------------------------------------------------------------------------

function buildMall(): Building {
  const floors = [
    { name: 'Ground Floor - Retail', kw: 150 },
    { name: 'First Floor - Retail', kw: 120 },
    { name: 'Second Floor - Food Court', kw: 180 },
    { name: 'Third Floor - Parking', kw: 80 },
  ];
  const floorDesigns: FloorDesign[] = floors.map((fl, i) => {
    const f = i + 1;
    return {
      id: `m-fd-${f}`,
      floorNumber: f,
      hasFloorSubPanels: true,
      riserCableLength: f * 4,
      items: [
        servicePanelItem({
          id: `m-f${f}-panel`,
          name: fl.name,
          floorDesignId: `m-fd-${f}`,
          kw: fl.kw,
          cableLength: 15,
        }),
      ],
    };
  });

  return {
    id: 'bldg-mall',
    name: 'Shopping Mall',
    floors: 4,
    serviceFloors: 1,
    apartmentsPerFloor: 0,
    supplyVoltage: '400V 3-Phase',
    earthingSystem: 'TN-S',
    lightningProtection: true,
    floorDesigns,
    buildingLoads: [
      // HVAC on ALUMINUM XLPE — the biggest building-load cable, exercising
      // the aluminum path end-to-end (sizing, Iz, fault current, selectivity).
      libraryLoad({ id: 'm-bl-hvac', lib: lib.hvac, qty: 1, cableLength: 60, material: 'aluminum' }),
      libraryLoad({ id: 'm-bl-esc', lib: lib.escalator, qty: 1, cableLength: 40 }),
      libraryLoad({ id: 'm-bl-eml', lib: lib.emergencyLighting, qty: 1, cableLength: 30 }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Expected demand per building, recomputed from the SAME raw inputs the
// fixture builder used — proves the loads layer produced the demand that
// feeds the whole chain (no pre-computed shortcut values).
// ---------------------------------------------------------------------------

function expectedTotalKw(building: Building): number {
  let kw = 0;
  for (const fd of building.floorDesigns) {
    for (const it of fd.items) kw += it.calculatedMaxDemand;
  }
  for (const bl of building.buildingLoads ?? []) {
    kw += (bl.loadLibraryItem?.power ?? 0) * bl.quantity;
  }
  return kw;
}

// ---------------------------------------------------------------------------
// The invariant sweep — run once per building over every feeder in the tree.
// ---------------------------------------------------------------------------

function sweepFeeders(feeders: import('@/types').PanelFeeder[], context: string) {
  for (const f of feeders) {
    // Ib <= In: design current never exceeds the breaker rating.
    expect(f.current, `${context} ${f.name}: Ib<=In`).toBeLessThanOrEqual(f.breakerSize + 1e-6);

    // In <= Iz: breaker never exceeds the derated cable ampacity (fix #4).
    expect(f.breakerSize, `${context} ${f.name}: In<=Iz`).toBeLessThanOrEqual((f.cableIz ?? Infinity) + 1e-6);

    // Icu vs prospective fault: icuOk implies a compliant device.
    expect(typeof f.icuOk, `${context} ${f.name}: icuOk boolean`).toBe('boolean');
    if (f.icuOk) {
      if (f.fallbackType !== 'GENERIC_SPEC') {
        expect(f.breakingCapacityKa, `${context} ${f.name}: Icu>=Isc`).not.toBeNull();
        expect(f.breakingCapacityKa!, `${context} ${f.name}: Icu>=Isc`).toBeGreaterThanOrEqual(f.faultCurrentKa!);
      }
    } else {
      expect(f.breakingCapacityKa ?? 0, `${context} ${f.name}: shortfall visible`).toBeLessThan(f.faultCurrentKa!);
    }

    // Selectivity verdict coherence (fixes #1/#5): status matches the limit.
    expect(['FULL', 'PARTIAL', 'NONE'], `${context} ${f.name}: status`).toContain(f.selectivityStatus);
    expect(f.faultCurrentKa, `${context} ${f.name}: fault defined`).toBeGreaterThan(0);
    if (f.selectivityStatus === 'FULL') {
      expect(f.selectivityLimitKa, `${context} ${f.name}: FULL carries no limit`).toBeNull();
    } else if (f.selectivityStatus === 'PARTIAL') {
      expect(f.selectivityLimitKa, `${context} ${f.name}: PARTIAL carries a limit`).not.toBeNull();
      if (f.selectivityLimitKa! >= f.faultCurrentKa!) {
        // Fix #1: a FULL verdict demoted to PARTIAL keeps the selectivity
        // boundary (which exceeds the fault) and must surface the violation.
        expect(f.selectivityReason, `${context} ${f.name}: demotion reason`).toContain('Grading rules violated');
      } else {
        // Classic partial selectivity: selective only up to the limit.
        expect(f.selectivityReason, `${context} ${f.name}: partial reason`).toContain('Selective up to');
      }
    } else {
      expect(f.selectivityLimitKa, `${context} ${f.name}: NONE carries no limit`).toBeNull();
    }

    // Cable must always survive the downstream clearing time.
    expect(f.cableDamageOk, `${context} ${f.name}: cableDamageOk`).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mixed-Use Multi-Building Integration (loads → breakers → selectivity → cable)', () => {
  const towerA = buildTowerA();
  const towerB = buildTowerB();
  const mall = buildMall();

  const results = {
    'Residential Tower A': computeFeeders(towerA, project, findBreaker),
    'Residential Tower B': computeFeeders(towerB, project, findBreaker),
    'Shopping Mall': computeFeeders(mall, project, findBreaker),
  };

  for (const [name, result] of Object.entries(results)) {
    describe(name, () => {
      it('sweeps the full protection chain over every feeder', () => {
        // MDB feeders + every SMDB branch feeder form the whole tree.
        const allFeeders = [...result.mdbFeeders];
        for (const floor of result.smdbFloorNumbers) {
          allFeeders.push(...result.smdbFeeders(floor));
        }
        expect(allFeeders.length).toBeGreaterThan(0);

        sweepFeeders(result.mdbFeeders, `[${name}] MDB`);
        sweepFeeders(allFeeders, `[${name}] all`);

        // Fault level must only decrease down the tree: branch <= riser <= main.
        for (const floor of result.smdbFloorNumbers) {
          const riser = result.mdbFeeders.find((f) => f.name === `F${floor} – SMDB`);
          expect(riser).toBeDefined();
          for (const bf of result.smdbFeeders(floor)) {
            expect(bf.faultCurrentKa!, `[${name}] branch<=riser F${floor}`).toBeLessThanOrEqual(riser!.faultCurrentKa!);
          }
        }
      });

      it('main incomer: catalog frame with In <= Iz and Ir <= In', () => {
        const { mainIncomerSettings, mainBreakerIn, mainCableIz, mainCableSize, mainParallelRuns, mainIncomerIcuOk } = result;
        // Fix #4: the incomer cable was re-sized to the catalog frame.
        expect(mainCableIz, 'main: Iz >= In').toBeGreaterThanOrEqual(mainBreakerIn);
        expect(mainIncomerSettings.ir, 'main: Ir <= In').toBeLessThanOrEqual(mainBreakerIn);
        expect(mainIncomerSettings.inRating).toBe(mainBreakerIn);
        expect(mainCableSize).toBeGreaterThan(0);
        expect(mainParallelRuns).toBeGreaterThanOrEqual(1);
        expect(mainIncomerIcuOk).toBe(true);
        // A real catalog device, not a generic spec.
        expect(mainIncomerSettings.isGeneric).toBe(false);
        expect(mainIncomerSettings.manufacturer).not.toBeNull();
      });

      it('loads layer: main incomer Ir matches demand derived from raw inputs', () => {
        const expectedKw = expectedTotalKw(
          name === 'Residential Tower A' ? towerA : name === 'Residential Tower B' ? towerB : mall
        );
        const expectedKva = expectedKw / (project.powerFactor || 0.85);
        const expectedCurrent = calculateThreePhaseCurrent(expectedKva, project.voltage);
        expect(result.mainIncomerSettings.ir).toBeCloseTo(expectedCurrent, 0);
        // Sanity: the transformer that drove the fault level was sized from that demand.
        const expectedTransformer = sizeTransformer(expectedKva, 1.2);
        expect(expectedTransformer).toBeGreaterThan(0);
      });
    });
  }

  it('each building sizes its own transformer and main incomer (per-building independence)', () => {
    const a = results['Residential Tower A'];
    const b = results['Residential Tower B'];
    const m = results['Shopping Mall'];

    // Demand order: Mall > Tower A > Tower B → frames must follow.
    const kwA = expectedTotalKw(towerA);
    const kwB = expectedTotalKw(towerB);
    const kwM = expectedTotalKw(mall);
    expect(kwM).toBeGreaterThan(kwA);
    expect(kwA).toBeGreaterThan(kwB);

    const transA = sizeTransformer(kwA / 0.85, 1.2);
    const transB = sizeTransformer(kwB / 0.85, 1.2);
    const transM = sizeTransformer(kwM / 0.85, 1.2);
    expect(transM).toBeGreaterThan(transA);
    expect(transA).toBeGreaterThan(transB);

    // The three buildings resolve to three different main incomer frames
    // (pinned regression values — they differ because each building sizes its
    // own transformer from its own demand).
    const frames = new Set([a.mainBreakerIn, b.mainBreakerIn, m.mainBreakerIn]);
    expect(frames.size).toBe(3);
    expect(m.mainBreakerIn).toBeGreaterThan(a.mainBreakerIn);
    expect(a.mainBreakerIn).toBeGreaterThan(b.mainBreakerIn);

    // Pinned frames: Tower A 500 A MCCB, Tower B 400 A MCCB, Mall 1250 A ACB.
    expect(a.mainBreakerIn).toBe(500);
    expect(b.mainBreakerIn).toBe(400);
    expect(m.mainBreakerIn).toBe(1250);
    // The Mall (largest) must land on an ACB; the towers on MCCBs.
    expect(m.mainIncomerSettings.category).toBe('ACB');
    expect(a.mainIncomerSettings.category).toBe('MCCB');
    expect(b.mainIncomerSettings.category).toBe('MCCB');
    // Main incomer cables are re-sized to their frames (fix #4): Iz >= In,
    // with parallel runs on the ACB. Tower A's 240 mm² single run is exactly
    // Iz = In = 500; Tower B 185 mm² Iz 424 >= 400; the Mall's touching
    // parallel runs join the grouping table (IEC B.52.17), so 3 × 185 mm²
    // (Iz 3×424×0.70 = 890 < 1250) no longer suffices — the engine steps up
    // to 4 × 240 mm² (4×500×0.65 = 1300 >= 1250).
    expect(a.mainCableIz).toBeGreaterThanOrEqual(a.mainBreakerIn);
    expect(b.mainCableIz).toBeGreaterThanOrEqual(b.mainBreakerIn);
    expect(m.mainCableIz).toBeGreaterThanOrEqual(m.mainBreakerIn);
    expect(a.mainParallelRuns).toBe(1);
    expect(b.mainParallelRuns).toBe(1);
    expect(m.mainParallelRuns).toBe(4);
    expect(a.mainCableSize).toBe(240);
    expect(b.mainCableSize).toBe(185);
    expect(m.mainCableSize).toBe(240);

    // SMDB floor sets reflect each building's design.
    expect(a.smdbFloorNumbers).toEqual([5, 6, 7, 8]);
    expect(b.smdbFloorNumbers).toEqual([4, 5, 6]);
    expect(m.smdbFloorNumbers).toEqual([1, 2, 3, 4]);
  });

  it('aluminum building-load cable is sized by the aluminum columns and stays In <= Iz', () => {
    const m = results['Shopping Mall'];
    const hvac = m.mdbFeeders.find((f) => f.name === 'HVAC System');
    expect(hvac).toBeDefined();
    expect(hvac!.breakerSize).toBe(500); // current unchanged by material
    // Aluminum XLPE 3-phase: single 300 mm² = 497 A < 500 A, so the sizing
    // engine drops to parallel runs. Touching runs join the grouping table
    // (IEC B.52.17): 2 × 120 mm² derates to 2×276×0.80 = 442 A < 500 A, so the
    // engine steps up to 2 × 150 mm² (2×319×0.80 = 510 A >= 500 A). The stored
    // cable keeps the "2 ×" prefix so the evaluation sees both runs.
    expect(hvac!.formattedCableSize).toContain('2 × 150 mm²');
    expect(hvac!.parallelRuns).toBe(2);
    expect(hvac!.cableIz!).toBeGreaterThanOrEqual(hvac!.breakerSize);
    expect(hvac!.isUnderProtected).toBe(false);

    // The copper-equivalent HVAC (same current) fits a single 240 mm² run
    // (copper 240 = 500 A) — aluminum needs parallel runs where copper does not.
    const copperSizing = sizeCableAndBreaker(hvac!.current, true, {
      material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1, installMethod: 'C',
    });
    expect(copperSizing.parallelRuns).toBe(1);
    expect(copperSizing.cableSize).toBe(240);
  });

  it('apartment feeder currents match the route formula (loads layer, per-feeder)', () => {
    // Tower A, floor 1, Apt 1 (1Φ, 12 kW connected, 28-apt diversity 0.5).
    const a = results['Residential Tower A'];
    const feeder = a.mdbFeeders.find((f) => f.name === 'F1 – Apt 1 (1F)');
    expect(feeder).toBeDefined();

    const maxDemand = 12 * getApartmentDiversityFactor(28); // 6 kW
    const expectedCurrent = maxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
    expect(feeder!.current).toBeCloseTo(expectedCurrent, 1);
    expect(feeder!.current).toBeLessThan(feeder!.breakerSize); // auto-sized up from Ib
    expect(feeder!.isThreePhase).toBe(false);
  });
});
