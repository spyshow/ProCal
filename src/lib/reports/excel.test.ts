import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildReportWorkbook } from './excel';
import type { FindBreaker } from '@/lib/calculations/feeders';
import type { Building, FloorItem, Project } from '@/types';

const findBreaker: FindBreaker = (currentRating, category) => {
  const match =
    category === 'MCCB'
      ? [{ ratedCurrent: 16 }, { ratedCurrent: 25 }, { ratedCurrent: 63 }].find((e) => e.ratedCurrent >= currentRating)
      : [{ ratedCurrent: 16 }, { ratedCurrent: 32 }].find((e) => e.ratedCurrent >= currentRating);
  return {
    model: match ? `ABB Tmax ${match.ratedCurrent}` : null,
    manufacturer: match ? 'ABB' : null,
    familyName: null,
    ratedCurrent: match?.ratedCurrent ?? null,
    fallback: !match,
    fallbackType: match ? 'SAME_FAMILY' : 'GENERIC_SPEC',
  };
};

const baseProject: Project = {
  id: 'p1', name: 'Test Tower', client: 'ACME', consultant: 'ConsultCo', contractor: 'BuildCo',
  location: 'Damascus', engineer: 'Eng A', date: '2026-08-01',
  voltage: 400, frequency: 50, powerFactor: 0.85, country: 'Syria', preferredManufacturer: 'ABB',
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
    floorDesigns: [], buildingLoads: [],
    ...overrides,
  };
}

function projectWith(buildings: Building[]): Project {
  return { ...baseProject, buildings };
}

describe('buildReportWorkbook', () => {
  it('creates the eight expected sheets', () => {
    const bldg = building({
      floorDesigns: [{ id: 'f1', floorNumber: 1, hasFloorSubPanels: false, items: [item()] }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);

    expect(wb.SheetNames).toEqual([
      'Project',
      'Load Analysis',
      'MDB Schedule',
      'Cable Schedule',
      'Breaker Schedule',
      'Voltage Drop',
      'Short-Circuit',
      'BOM',
    ]);
  });

  it('writes project metadata to the Project sheet', () => {
    const bldg = building({ floorDesigns: [] });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['Project']);

    const projRow = rows.find((r) => r['Field'] === 'Project');
    expect(projRow?.Value).toBe('Test Tower');
    const clientRow = rows.find((r) => r['Field'] === 'Client');
    expect(clientRow?.Value).toBe('ACME');
  });

  it('includes a BOM sheet with cable rows', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ cableSize: '4 mm²', breakerSize: '16A' }), item({ cableSize: '6 mm²', breakerSize: '25A' })],
      }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['BOM']);

    const cable4 = rows.find((r) => r['Conductor Size'] === 4);
    expect(cable4?.Circuits).toBe(1);
    const cable6 = rows.find((r) => r['Conductor Size'] === 6);
    expect(cable6?.Circuits).toBe(1);
  });

  it('writes MDB feeder rows with building name and breaker model', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ name: 'Apt A', calculatedCurrent: 12 })],
      }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['MDB Schedule']);

    expect(rows).toHaveLength(1);
    expect(rows[0]['Building']).toBe('Tower A');
    expect(rows[0]['Feeder']).toContain('Apt A');
    expect(rows[0]['Breaker Model']).toContain('ABB');
  });

  it('writes cable schedule rows with material and insulation', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ cableMaterial: 'aluminum', cableInsulation: 'PVC' })],
      }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['Cable Schedule']);

    expect(rows[0]['Material']).toBe('Aluminum');
    expect(rows[0]['Insulation']).toBe('PVC');
    expect(rows[0]['Circuit']).toBe('F1-A');
  });

  it('writes breaker schedule rows', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 20, breakerSize: '25A' })],
      }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['Breaker Schedule']);

    expect(rows).toHaveLength(2);
    expect(rows[0]['Feeder']).toBe('Main Incomer');
    expect(rows[1]['Breaker']).toBe(25);
  });

  it('writes voltage-drop rows with a status', () => {
    const bldg = building({
      floorDesigns: [{
        id: 'f1', floorNumber: 1, hasFloorSubPanels: false,
        items: [item({ calculatedCurrent: 10, cableSize: '4 mm²', cableLength: 20 })],
      }],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets['Voltage Drop']);

    expect(rows).toHaveLength(1);
    expect(['OK', 'WARNING', 'FAIL']).toContain(rows[0]['Status']);
  });

  it('includes complete breaker BOM and cable BOQ in a single BOM sheet without duplicate tabs', () => {
    const bldg = building({
      floorDesigns: [
        {
          id: 'f1',
          floorNumber: 1,
          hasFloorSubPanels: true,
          items: [
            item({ id: 'i1', name: 'Apt 101', calculatedCurrent: 14, breakerSize: '16A', cableSize: '4 mm²' }),
            item({ id: 'i2', name: 'Apt 102', calculatedCurrent: 22, breakerSize: '25A', cableSize: '6 mm²' }),
          ],
        },
      ],
    });
    const wb = buildReportWorkbook(projectWith([bldg]), findBreaker);

    // Verify exactly 8 sheets — no duplicate BOM tabs
    expect(wb.SheetNames).toEqual([
      'Project',
      'Load Analysis',
      'MDB Schedule',
      'Cable Schedule',
      'Breaker Schedule',
      'Voltage Drop',
      'Short-Circuit',
      'BOM',
    ]);

    // Inspect the single consolidated BOM sheet
    const aoaRows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['BOM'], { header: 1 });

    // 1. Cable table check
    expect(aoaRows[0]).toEqual([
      'Cable Specification',
      'Cores / System',
      'Conductor Size',
      'Circuits',
      'Total Length (m)',
    ]);
    const hasCable4 = aoaRows.some((row) => row[2] === 4 && row[3] === 1);
    expect(hasCable4).toBe(true);

    // 2. Breakers table check
    const breakerHeaderIdx = aoaRows.findIndex((row) => row[0] === 'Rating (In)');
    expect(breakerHeaderIdx).toBeGreaterThan(0);
    expect(aoaRows[breakerHeaderIdx]).toEqual([
      'Rating (In)',
      'Category',
      'Poles',
      'Model & Manufacturer',
      'Sourcing Status',
      'Quantity',
    ]);

    // Check presence of branch breakers & incomer/riser switchgear tiers
    const has16AMcb = aoaRows.some((row) => row[0] === '16A' && row[1] === 'MCB');
    expect(has16AMcb).toBe(true);

    const hasIncomerOrRiser = aoaRows.some(
      (row) => row[1] === 'ACB' || row[1] === 'MCCB'
    );
    expect(hasIncomerOrRiser).toBe(true);

    // Check total protective units row
    const totalRow = aoaRows.find((row) => row[0] === 'Total Protective Switchgear Units');
    expect(totalRow).toBeDefined();
    expect(Number(totalRow?.[5])).toBeGreaterThan(0);
  });
});
