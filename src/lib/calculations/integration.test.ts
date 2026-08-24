import { describe, it, expect } from 'vitest';
import { computeFeeders, createFindBreaker, isThreePhaseForItem, pfForFloorItem, type EquipmentItem } from './feeders';
import { phaseBalance } from './phaseBalance';
import { computeFloorRiserVd } from './riser';
import { calculateVoltageDrop, parseMm2 } from './cables';
import { CABLE_CATALOG, temperatureDeratingFactor, groupingDeratingFactor } from './cablesData';
import { calculateThreePhaseCurrent } from './loads';
import type { Building, FloorDesign, FloorItem, Project } from '@/types';

// ---------------------------------------------------------------------------
// Equipment Catalog Fixture (ABB breakers covering MCB, MCCB, ACB)
// ---------------------------------------------------------------------------

const equipment: EquipmentItem[] = [
  // 1P MCB (16A – 63A)
  { id: 'mcb1-16', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C16', ratedCurrent: 16, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-20', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C20', ratedCurrent: 20, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-25', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C25', ratedCurrent: 25, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-32', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C32', ratedCurrent: 32, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-40', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C40', ratedCurrent: 40, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-50', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C50', ratedCurrent: 50, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb1-63', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S201-C63', ratedCurrent: 63, poles: 1, breakingCapacity: 6, tripUnit: null, settingsJson: null },

  // 3P MCB (16A – 63A)
  { id: 'mcb3-16', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C16', ratedCurrent: 16, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-20', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C20', ratedCurrent: 20, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-25', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C25', ratedCurrent: 25, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-32', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C32', ratedCurrent: 32, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-40', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C40', ratedCurrent: 40, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-50', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C50', ratedCurrent: 50, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },
  { id: 'mcb3-63', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200', series: 'S200', model: 'S203-C63', ratedCurrent: 63, poles: 3, breakingCapacity: 6, tripUnit: null, settingsJson: null },

  // 3P MCCB (16A – 630A)
  { id: 'mccb-16', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 16', ratedCurrent: 16, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-25', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 25', ratedCurrent: 25, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-32', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 32', ratedCurrent: 32, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-40', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 40', ratedCurrent: 40, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-50', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 50', ratedCurrent: 50, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-63', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 63', ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-80', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 80', ratedCurrent: 80, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-100', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 100', ratedCurrent: 100, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-125', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 125', ratedCurrent: 125, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-160', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT1N 160', ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-200', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT2N 200', ratedCurrent: 200, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-250', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT3N 250', ratedCurrent: 250, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-320', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT4N 320', ratedCurrent: 320, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-400', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT5N 400', ratedCurrent: 400, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-500', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT5N 500', ratedCurrent: 500, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },
  { id: 'mccb-630', category: 'MCCB', manufacturer: 'ABB', familyId: 'mccb-fam', familyName: 'Tmax XT', series: 'Tmax XT', model: 'XT6N 630', ratedCurrent: 630, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null },

  // 3P ACB (800A – 1600A)
  { id: 'acb-800', category: 'ACB', manufacturer: 'ABB', familyId: 'acb-fam', familyName: 'Emax 2', series: 'Emax 2', model: 'E1.2N 800', ratedCurrent: 800, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null },
  { id: 'acb-1000', category: 'ACB', manufacturer: 'ABB', familyId: 'acb-fam', familyName: 'Emax 2', series: 'Emax 2', model: 'E1.2N 1000', ratedCurrent: 1000, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null },
  { id: 'acb-1250', category: 'ACB', manufacturer: 'ABB', familyId: 'acb-fam', familyName: 'Emax 2', series: 'Emax 2', model: 'E2.2N 1250', ratedCurrent: 1250, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null },
  { id: 'acb-1600', category: 'ACB', manufacturer: 'ABB', familyId: 'acb-fam', familyName: 'Emax 2', series: 'Emax 2', model: 'E2.2N 1600', ratedCurrent: 1600, poles: 3, breakingCapacity: 42, tripUnit: null, settingsJson: null },
];

const findBreaker = createFindBreaker(equipment, { MCB: 'mcb-fam', MCCB: 'mccb-fam', ACB: 'acb-fam' }, 'ABB');

// ---------------------------------------------------------------------------
// Golden Path 10-Floor Building Fixture
// ---------------------------------------------------------------------------

const project: Project = {
  id: 'proj-golden',
  name: 'Golden Path High-Rise',
  client: 'Global Properties',
  consultant: 'Apex Engineering',
  contractor: 'Prime Construction',
  location: 'Metropolis',
  engineer: 'Lead Electrical Eng',
  date: '2026-08-11',
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  country: 'US',
  preferredManufacturer: 'ABB',
  logoUrl: null,
  maxVoltageDropLighting: 3,
  maxVoltageDropPower: 5,
  ambientTemp: 30,
  groupingCount: 1,
  buildings: [],
  apartmentTemplates: [],
  loadLibraryItems: [],
};

function createGoldenBuilding(): Building {
  const floorDesigns: FloorDesign[] = [];

  // Floors 1 to 5: Direct floors (hasFloorSubPanels: false) with mixed 1-phase apartments
  for (let f = 1; f <= 5; f++) {
    const items: FloorItem[] = [
      {
        id: `f${f}-apt-a`,
        name: `Apt ${f}01`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 6,
        calculatedMaxDemand: 3.5,
        calculatedCurrent: 15 + f * 2, // 17A, 19A, 21A, 23A, 25A
        breakerSize: '32A',
        cableSize: '10 mm²',
        cableLength: 10 + f * 3,
        voltageDrop: 0.5,
        apartmentTemplate: { id: 't1', name: '1-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-apt-b`,
        name: `Apt ${f}02`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 9,
        calculatedMaxDemand: 5.5,
        calculatedCurrent: 24 + f * 1.5, // 25.5A, 27A, 28.5A, 30A, 31.5A
        breakerSize: '32A',
        cableSize: '10 mm²',
        cableLength: 12 + f * 3,
        voltageDrop: 0.7,
        apartmentTemplate: { id: 't2', name: '2-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-apt-c`,
        name: `Apt ${f}03`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 12,
        calculatedMaxDemand: 7.0,
        calculatedCurrent: 30 + f * 1, // 31A, 32A, 33A, 34A, 35A
        breakerSize: '40A',
        cableSize: '16 mm²',
        cableLength: 15 + f * 3,
        voltageDrop: 0.8,
        apartmentTemplate: { id: 't3', name: '3-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
    ];

    floorDesigns.push({
      id: `floor-${f}`,
      floorNumber: f,
      hasFloorSubPanels: false,
      items,
    });
  }

  // Floors 6 to 10: SDB floors (hasFloorSubPanels: true), each with 4 1-phase apartments + 3-phase pump panel
  for (let f = 6; f <= 10; f++) {
    const items: FloorItem[] = [
      {
        id: `f${f}-apt-1`,
        name: `Apt ${f}01`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 7,
        calculatedMaxDemand: 4.0,
        calculatedCurrent: 18,
        breakerSize: '25A',
        cableSize: '10 mm²',
        cableLength: 12,
        voltageDrop: 0.3,
        apartmentTemplate: { id: 't1', name: '1-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-apt-2`,
        name: `Apt ${f}02`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 8,
        calculatedMaxDemand: 4.8,
        calculatedCurrent: 21,
        breakerSize: '25A',
        cableSize: '10 mm²',
        cableLength: 15,
        voltageDrop: 0.4,
        apartmentTemplate: { id: 't2', name: '2-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-apt-3`,
        name: `Apt ${f}03`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 8,
        calculatedMaxDemand: 5.0,
        calculatedCurrent: 22,
        breakerSize: '32A',
        cableSize: '10 mm²',
        cableLength: 18,
        voltageDrop: 0.5,
        apartmentTemplate: { id: 't2', name: '2-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-apt-4`,
        name: `Apt ${f}04`,
        type: 'APARTMENT',
        calculatedConnectedLoad: 10,
        calculatedMaxDemand: 6.2,
        calculatedCurrent: 27,
        breakerSize: '32A',
        cableSize: '10 mm²',
        cableLength: 20,
        voltageDrop: 0.6,
        apartmentTemplate: { id: 't3', name: '3-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
      },
      {
        id: `f${f}-pump`,
        name: `Booster Pump F${f}`,
        type: 'PUMP_PANEL',
        calculatedConnectedLoad: 11,
        calculatedMaxDemand: 9.0,
        calculatedCurrent: 15.3, // 3-phase pump
        breakerSize: '20A',
        cableSize: '10 mm²',
        cableLength: 10,
        voltageDrop: 0.2,
        apartmentTemplate: null,
        loadLibraryItem: null,
      },
    ];

    floorDesigns.push({
      id: `floor-${f}`,
      floorNumber: f,
      hasFloorSubPanels: true,
      riserCableLength: 15 + (f - 5) * 3.5, // 18.5m, 22m, 25.5m, 29m, 32.5m
      riserCableSize: '50 mm²',
      riserCableInsulation: 'XLPE',
      riserInstallMethod: 'C',
      items,
    });
  }

  // 2 Building Loads (3-phase Elevator + 3-phase Fire Pump)
  const buildingLoads = [
    {
      id: 'bl-elevator',
      buildingId: 'bldg-1',
      loadLibraryItemId: 'lib-elevator',
      quantity: 1,
      cableLength: 45,
      cableSize: '25 mm²',
      loadLibraryItem: {
        id: 'lib-elevator',
        name: 'Passenger Elevator',
        category: 'Elevator',
        power: 22, // kW
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 1.0,
        quantity: 1,
        runningCurrent: 37.4,
        startingCurrent: 180,
        notes: 'Main passenger lift',
      },
    },
    {
      id: 'bl-firepump',
      buildingId: 'bldg-1',
      loadLibraryItemId: 'lib-firepump',
      quantity: 1,
      cableLength: 25,
      cableSize: '35 mm²',
      loadLibraryItem: {
        id: 'lib-firepump',
        name: 'Fire Protection Pump',
        category: 'Pump',
        power: 37, // kW
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 1.0,
        quantity: 1,
        runningCurrent: 62.8,
        startingCurrent: 350,
        notes: 'Emergency sprinkler booster',
      },
    },
  ];

  return {
    id: 'bldg-1',
    name: 'Metropolis Tower',
    floors: 10,
    serviceFloors: 0,
    apartmentsPerFloor: 4,
    supplyVoltage: '400',
    earthingSystem: 'TN-S',
    lightningProtection: true,
    floorDesigns,
    buildingLoads,
  };
}

// ---------------------------------------------------------------------------
// Golden Path Cross-Module Integration Tests
// ---------------------------------------------------------------------------

describe('Golden Path Cross-Module Integration Test', () => {
  const building = createGoldenBuilding();

  it('verifies cross-module consistency and completes execution in under 2 seconds', () => {
    const startTime = performance.now();

    // 1. Run computeFeeders across the whole building
    const result = computeFeeders(building, project, findBreaker);
    const { mdbFeeders, smdbFeeders, smdbFloorNumbers } = result;

    expect(mdbFeeders.length).toBeGreaterThan(0);
    expect(smdbFloorNumbers).toEqual([6, 7, 8, 9, 10]);

    // -------------------------------------------------------------------------
    // Assertion 1: Phase balance consistency across all MDB feeders
    // The sum of phaseCurrent across all mdbFeeders (grouped by phase) must equal
    // the sum of individual phaseBalance calls per floor + building loads.
    // -------------------------------------------------------------------------
    let mdbL1 = 0;
    let mdbL2 = 0;
    let mdbL3 = 0;

    for (const f of mdbFeeders) {
      if (f.phaseCurrent) {
        mdbL1 += f.phaseCurrent[0];
        mdbL2 += f.phaseCurrent[1];
        mdbL3 += f.phaseCurrent[2];
      }
    }

    let expectedL1 = 0;
    let expectedL2 = 0;
    let expectedL3 = 0;

    // Sum from each individual floor's phaseBalance
    for (const fd of building.floorDesigns) {
      const fb = phaseBalance(fd.items, project);
      expectedL1 += fb.phaseCurrent[0];
      expectedL2 += fb.phaseCurrent[1];
      expectedL3 += fb.phaseCurrent[2];
    }

    // Sum from building loads' phaseBalance
    const blBalance = phaseBalance(building.buildingLoads, project);
    expectedL1 += blBalance.phaseCurrent[0];
    expectedL2 += blBalance.phaseCurrent[1];
    expectedL3 += blBalance.phaseCurrent[2];

    expect(mdbL1).toBeCloseTo(expectedL1, 2);
    expect(mdbL2).toBeCloseTo(expectedL2, 2);
    expect(mdbL3).toBeCloseTo(expectedL3, 2);

    // -------------------------------------------------------------------------
    // Assertion 2: SDB floor riserCurrent matches maxPhaseCurrent from phaseBalance
    // For each SDB floor, riserCurrent from computeFloorRiserVd must equal
    // maxPhaseCurrent from phaseBalance(fd.items, project) and match SMDB feeder.
    // -------------------------------------------------------------------------
    const sdbFloors = building.floorDesigns.filter((fd) => fd.hasFloorSubPanels);
    expect(sdbFloors).toHaveLength(5); // Floors 6 to 10

    for (const fd of sdbFloors) {
      const riserVd = computeFloorRiserVd(fd, project);
      const floorBal = phaseBalance(fd.items, project);

      // computeFloorRiserVd agrees with phaseBalance
      expect(riserVd.riserCurrent).toBe(floorBal.maxPhaseCurrent);

      // computeFeeders SMDB feeder agrees with phaseBalance
      const smdb = mdbFeeders.find((f) => f.name === `F${fd.floorNumber} – SMDB`);
      expect(smdb).toBeDefined();
      expect(smdb!.current).toBe(floorBal.maxPhaseCurrent);
      expect(smdb!.phaseCurrent).toEqual(floorBal.phaseCurrent);
    }

    // -------------------------------------------------------------------------
    // Assertion 3: Total Voltage Drop is a PERCENTAGE sum, never raw volts.
    // The riser leg drops against 400V (line-line) and a 1-phase branch against
    // 230V (line-neutral); each leg's dropPercent is already referenced to its
    // own base, so total = riser% + branch%. Converting raw branch volts to the
    // 400V base understates them by √3 and can flip FAIL to PASS.
    // -------------------------------------------------------------------------
    for (const fd of sdbFloors) {
      const riserVd = computeFloorRiserVd(fd, project);
      expect(riserVd.hasRiser).toBe(true);

      const riserDrop = calculateVoltageDrop(
        riserVd.riserCurrent,
        fd.riserCableLength!,
        parseMm2(fd.riserCableSize)!,
        project.powerFactor,
        true,
        project.voltage
      );

      const worstItem = fd.items.find((i) => i.name === riserVd.worstItemName)!;
      expect(worstItem).toBeDefined();

      const is3ph = isThreePhaseForItem(worstItem);
      const branchVoltage = is3ph ? project.voltage : project.voltage / Math.sqrt(3);
      const worstBranchDrop = calculateVoltageDrop(
        worstItem.calculatedCurrent,
        worstItem.cableLength!,
        parseMm2(worstItem.cableSize)!,
        pfForFloorItem(worstItem, project),
        is3ph,
        branchVoltage
      );

      const expectedTotalVd = riserDrop.dropPercent + worstBranchDrop.dropPercent;
      expect(riserVd.totalVdPercent).toBeCloseTo(expectedTotalVd, 3);

      // Cross-check via phase-referred volts (2dp — calculateVoltageDrop rounds):
      // total L-N drop = riser/√3 + branch, over the L-N base. Algebraically
      // identical to the percent sum; raw-volts-over-400 would understate it.
      const vLN = project.voltage / Math.sqrt(3);
      const phaseReferred =
        (((riserDrop.dropVolts / Math.sqrt(3)) + worstBranchDrop.dropVolts) / vLN) * 100;
      expect(riserVd.totalVdPercent).toBeCloseTo(phaseReferred, 2);
    }

    // -------------------------------------------------------------------------
    // Assertion 4: Every feeder's breakerSize <= its cableSize's derated ampacity
    // Verifies coordination protection rule across all MDB and SDB branch feeders.
    // -------------------------------------------------------------------------
    const allFeeders = [...mdbFeeders];
    for (const fd of sdbFloors) {
      allFeeders.push(...smdbFeeders(fd.floorNumber));
    }

    for (const feeder of allFeeders) {
      const cableSize = feeder.cableSize;
      const spec = CABLE_CATALOG.find((c) => c.size === cableSize) ?? CABLE_CATALOG[CABLE_CATALOG.length - 1];

      const ambientTemp = project.ambientTemp ?? 30;
      const groupingCount = project.groupingCount ?? 1;
      const tempFactor = temperatureDeratingFactor('XLPE', ambientTemp);
      const groupFactor = groupingDeratingFactor(groupingCount);
      const totalDerating = tempFactor * groupFactor;

      const baseAmpacity = feeder.isThreePhase ? spec.copperXlpe3Ph : spec.copperXlpe1Ph;
      const deratedAmpacity = baseAmpacity * totalDerating;

      // In <= Iz: the breaker size must never exceed the cable's derated current-carrying capacity
      expect(feeder.breakerSize).toBeLessThanOrEqual(deratedAmpacity);
    }

    // -------------------------------------------------------------------------
    // Assertion 5: Protection Hierarchy Tree, Terminal Isc & Selectivity
    // -------------------------------------------------------------------------
    for (const f of mdbFeeders) {
      expect(f.parentFeederName).toBe('Main Incomer');
      expect(f.faultCurrentKa).toBeDefined();
      expect(f.faultCurrentKa).toBeGreaterThan(0);
      expect(['FULL', 'PARTIAL', 'NONE']).toContain(f.selectivityStatus);
      expect(f.cableDamageOk).toBe(true);
    }

    for (const fd of sdbFloors) {
      const branchFeeders = smdbFeeders(fd.floorNumber);
      for (const bf of branchFeeders) {
        expect(bf.parentFeederName).toBe(`F${fd.floorNumber} – SMDB`);
        expect(bf.faultCurrentKa).toBeDefined();
        expect(bf.faultCurrentKa).toBeGreaterThan(0);
        // Terminal fault current at the apartment branch must be lower than the SMDB riser fault current
        const riserFeeder = mdbFeeders.find((f) => f.name === `F${fd.floorNumber} – SMDB`)!;
        expect(bf.faultCurrentKa!).toBeLessThanOrEqual(riserFeeder.faultCurrentKa!);
        expect(['FULL', 'PARTIAL', 'NONE']).toContain(bf.selectivityStatus);
        expect(bf.cableDamageOk).toBe(true);
      }
    }

    // -------------------------------------------------------------------------
    // Assertion 6: Main incomer demand includes building loads.
    // Regression guard: BuildingLoads used to contribute 0 kW to the overall
    // (mixed) balance, collapsing the main incomer Ir to the 16 A clamp.
    // -------------------------------------------------------------------------
    const expectedTotalKw =
      building.floorDesigns.reduce(
        (s, fd) => s + fd.items.reduce((si, it) => si + it.calculatedMaxDemand, 0),
        0
      ) +
      building.buildingLoads.reduce(
        (s, bl) => s + (bl.loadLibraryItem?.power ?? 0) * bl.quantity,
        0
      );
    const expectedMainIr = calculateThreePhaseCurrent(
      expectedTotalKw / (project.powerFactor || 0.85),
      project.voltage
    );
    expect(result.mainIncomerSettings.ir).toBeCloseTo(expectedMainIr, 1);

    const elapsed = performance.now() - startTime;
    // Execution must complete well under 2 seconds (typically < 50ms)
    expect(elapsed).toBeLessThan(2000);
  });
});

// ---------------------------------------------------------------------------
// Icu Breaking-Capacity Verification (IEC 60947-2: Icu >= prospective Isc)
// ---------------------------------------------------------------------------

describe('Icu breaking-capacity verification', () => {
  const mcbLow: EquipmentItem = {
    id: 'x-32-low', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200',
    series: 'S200', model: 'S203-C32', ratedCurrent: 32, poles: 3, breakingCapacity: 6,
    tripUnit: null, settingsJson: null,
  };
  const mcbHigh: EquipmentItem = {
    id: 'x-32-high', category: 'MCB', manufacturer: 'SCHNEIDER', familyId: 'se-fam', familyName: 'Acti9',
    series: 'Acti9', model: 'iC60N C32', ratedCurrent: 32, poles: 3, breakingCapacity: 10,
    tripUnit: null, settingsJson: null,
  };
  // 2-pole variant: 1-phase feeders search with poles = 1, which matches poles <= 2.
  const mcbHighDp: EquipmentItem = {
    id: 'x-32-high-dp', category: 'MCB', manufacturer: 'SCHNEIDER', familyId: 'se-fam', familyName: 'Acti9',
    series: 'Acti9', model: 'iDPN C32', ratedCurrent: 32, poles: 2, breakingCapacity: 10,
    tripUnit: null, settingsJson: null,
  };
  // Device with NO recorded breaking capacity — the case that used to dead-end
  // enforceFeederIcu: it flagged icuOk = false without ever retrying the catalog
  // for a compliant device, unlike an explicitly insufficient Icu.
  const mcbNullIcu: EquipmentItem = {
    id: 'x-32-null', category: 'MCB', manufacturer: 'ABB', familyId: 'mcb-fam', familyName: 'S200',
    series: 'S200', model: 'S201-C32-N', ratedCurrent: 32, poles: 1, breakingCapacity: null,
    tripUnit: null, settingsJson: null,
  };

  it('prefers a compliant device when requiredIcuKa is given', () => {
    const find = createFindBreaker([mcbLow, mcbHigh], undefined, 'ABB');
    const unrestricted = find(30, 'MCB', 3);
    expect(unrestricted.breakingCapacity).toBe(6);

    const compliant = find(30, 'MCB', 3, { requiredIcuKa: 8 });
    expect(compliant.ratedCurrent).toBe(32);
    expect(compliant.breakingCapacity).toBeGreaterThanOrEqual(8);
  });

  it('keeps the shortfall visible when no compliant device exists', () => {
    const find = createFindBreaker([mcbLow], undefined, 'ABB');
    const match = find(30, 'MCB', 3, { requiredIcuKa: 25 });
    expect(match.ratedCurrent).toBe(32);
    expect(match.breakingCapacity).toBe(6); // still below the required 25 kA
  });

  it('generic spec self-requires the prospective fault level', () => {
    const find = createFindBreaker([], undefined, 'ABB');
    const match = find(30, 'MCB', 3, { requiredIcuKa: 15 });
    expect(match.fallbackType).toBe('GENERIC_SPEC');
    expect(match.breakingCapacity).toBeNull();
    expect(match.genericSpec!.requiredIcuKa).toBeGreaterThanOrEqual(15);
  });

  const icuProject: Project = { ...project, id: 'proj-icu', transformerSize: 500 };

  function createIcuBuilding(): Building {
    return {
      id: 'bldg-icu',
      name: 'Icu Test Building',
      floors: 1,
      serviceFloors: 0,
      apartmentsPerFloor: 1,
      supplyVoltage: '400',
      earthingSystem: 'TN-S',
      lightningProtection: false,
      floorDesigns: [
        {
          id: 'fd-icu-1',
          floorNumber: 1,
          hasFloorSubPanels: false,
          items: [
            {
              id: 'icu-apt-1',
              name: 'Apt 101',
              type: 'APARTMENT',
              calculatedConnectedLoad: 5,
              calculatedMaxDemand: 4,
              calculatedCurrent: 20,
              breakerSize: '32A',
              cableSize: '10 mm²',
              cableLength: 6, // keeps the far-end fault in the (6, 10] kA window (vector Z sum, audit M5)
              voltageDrop: 0.3,
              apartmentTemplate: { id: 't1', name: '1-Bed', phases: 1, rooms: [], createdAt: '', updatedAt: '' },
            },
          ],
        },
      ],
      buildingLoads: [],
    } as Building;
  }

  it('upgrades a feeder device to a compliant Icu when one exists in the catalog', () => {
    const findWithHighMcb = createFindBreaker(
      [...equipment, mcbHighDp],
      { MCB: 'mcb-fam', MCCB: 'mccb-fam', ACB: 'acb-fam' },
      'ABB'
    );
    const result = computeFeeders(createIcuBuilding(), icuProject, findWithHighMcb);
    expect(result.mainIncomerIcuOk).toBe(true);

    const feeder = result.mdbFeeders.find((f) => f.name === 'F1 – Apt 101')!;
    // Precondition: the fault at this feeder sits between the 6 kA and 10 kA devices
    expect(feeder.faultCurrentKa!).toBeGreaterThan(6);
    expect(feeder.faultCurrentKa!).toBeLessThanOrEqual(10);

    expect(feeder.icuOk).toBe(true);
    expect(feeder.breakingCapacityKa).toBe(10);
    expect(feeder.manufacturer).toBe('SCHNEIDER');
  });

  it('flags icuOk false when no compliant device exists in the catalog', () => {
    const result = computeFeeders(createIcuBuilding(), icuProject, findBreaker);
    const feeder = result.mdbFeeders.find((f) => f.name === 'F1 – Apt 101')!;
    expect(feeder.faultCurrentKa!).toBeGreaterThan(6);

    expect(feeder.icuOk).toBe(false);
    expect(feeder.breakingCapacityKa).toBe(6);
    expect(feeder.manufacturer).toBe('ABB'); // original device kept, shortfall surfaced
  });

  it('retries the catalog and upgrades when the selected device has no recorded Icu', () => {
    const findWithNullIcu = createFindBreaker([mcbNullIcu, mcbHighDp], { MCB: 'mcb-fam' }, 'ABB');

    // Precondition: without an Icu filter, sizing selects the null-Icu device
    // (the default-family match), not the compliant Schneider backup.
    const sizingMatch = findWithNullIcu(32, 'MCB', 1);
    expect(sizingMatch.model).toContain('S201-C32-N');
    expect(sizingMatch.breakingCapacity).toBeNull();

    const result = computeFeeders(createIcuBuilding(), icuProject, findWithNullIcu);
    const feeder = result.mdbFeeders.find((f) => f.name === 'F1 – Apt 101')!;
    expect(feeder.faultCurrentKa!).toBeGreaterThan(6);
    expect(feeder.faultCurrentKa!).toBeLessThanOrEqual(10);

    // Null Icu must not dead-end the check: the catalog retry finds the
    // compliant device and upgrades the feeder to it.
    expect(feeder.icuOk).toBe(true);
    expect(feeder.breakingCapacityKa).toBe(10);
    expect(feeder.manufacturer).toBe('SCHNEIDER');
    expect(feeder.fallbackType).toBe('OTHER_BRAND');
  });

  it('keeps the shortfall visible when the only same-rating device has no recorded Icu', () => {
    const findWithNullIcu = createFindBreaker([mcbNullIcu], { MCB: 'mcb-fam' }, 'ABB');
    const result = computeFeeders(createIcuBuilding(), icuProject, findWithNullIcu);
    const feeder = result.mdbFeeders.find((f) => f.name === 'F1 – Apt 101')!;

    expect(feeder.faultCurrentKa!).toBeGreaterThan(6);

    // No compliant device anywhere: original kept and the shortfall surfaced,
    // exactly like the insufficient-but-recorded Icu case.
    expect(feeder.icuOk).toBe(false);
    expect(feeder.breakingCapacityKa).toBeNull();
    expect(feeder.manufacturer).toBe('ABB');
    expect(feeder.breakerModel).toContain('S201-C32-N');
  });

  it('reports a boolean icuOk for every feeder on the golden building', () => {
    const result = computeFeeders(createGoldenBuilding(), project, findBreaker);
    for (const f of result.mdbFeeders) {
      expect(typeof f.icuOk).toBe('boolean');
      if (f.icuOk && f.breakingCapacityKa != null) {
        expect(f.breakingCapacityKa).toBeGreaterThanOrEqual(f.faultCurrentKa!);
      }
      if (f.icuOk === false) {
        expect(f.breakingCapacityKa!).toBeLessThan(f.faultCurrentKa!);
      }
    }
    expect(typeof result.mainIncomerIcuOk).toBe('boolean');
  });
});
