import { describe, it, expect } from 'vitest';
import { computeFeeders, createFindBreaker, isThreePhaseForItem, pfForFloorItem, type EquipmentItem } from './feeders';
import { phaseBalance } from './phaseBalance';
import { computeFloorRiserVd } from './riser';
import { calculateVoltageDrop, parseMm2 } from './cables';
import { CABLE_CATALOG, TEMP_DERATING, GROUP_DERATING } from './cablesData';
import { METHOD_AMPACITY_FACTORS } from './installationMethods';
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
    // Assertion 3: Total Voltage Drop Math is absolute volts, NOT percentage sum
    // For each SDB floor, totalVdPercent must equal the absolute-volt combination
    // ((riserDropVolts + worstBranchDropVolts) / project.voltage) * 100.
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

      const expectedTotalVd = ((riserDrop.dropVolts + worstBranchDrop.dropVolts) / project.voltage) * 100;
      expect(riserVd.totalVdPercent).toBeCloseTo(expectedTotalVd, 3);

      // Because the worst branch is a 1-phase apartment at 230V, naive percentage addition would fail
      const naivePercentSum = riserVd.riserVdPercent + riserVd.branchVdPercent;
      expect(riserVd.totalVdPercent).not.toBeCloseTo(naivePercentSum, 1);
      expect(riserVd.totalVdPercent).toBeLessThan(naivePercentSum);
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
      const tempFactor = (TEMP_DERATING['XLPE'] && TEMP_DERATING['XLPE'][ambientTemp]) ?? 1.0;
      const groupFactor = GROUP_DERATING[groupingCount] ?? 1.0;
      const installFactor = METHOD_AMPACITY_FACTORS['C'] ?? 1.0;
      const totalDerating = tempFactor * groupFactor * installFactor;

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

    const elapsed = performance.now() - startTime;
    // Execution must complete well under 2 seconds (typically < 50ms)
    expect(elapsed).toBeLessThan(2000);
  });
});
