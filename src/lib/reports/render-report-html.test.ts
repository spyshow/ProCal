import { describe, it, expect } from 'vitest';
import { renderReportHtml, wrapReportMarkup } from './render-report-html';
import type { Project, Building, FloorItem } from '@/types';
import type { EquipmentItem } from '@/lib/calculations/feeders';

const mockEquipment: EquipmentItem[] = [
  { id: 'm1', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T1', ratedCurrent: 16, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm2', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T2', ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm3', category: 'MCCB', manufacturer: 'ABB', series: 'Tmax', model: 'T4', ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'm4', category: 'ACB', manufacturer: 'ABB', series: 'Emax', model: 'E1', ratedCurrent: 800, poles: 3, breakingCapacity: 50, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc1', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S201', ratedCurrent: 16, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
  { id: 'mc2', category: 'MCB', manufacturer: 'ABB', series: 'S200', model: 'S202', ratedCurrent: 32, poles: 1, breakingCapacity: 10, tripUnit: null, settingsJson: null, familyId: null, familyName: null },
];

function createSampleProject(): Project {
  return {
    id: 'proj-pdf-123',
    name: 'Al-Noor Horizon Complex',
    client: 'Horizon Holdings',
    consultant: 'Apex Engineering',
    contractor: 'Gulf Builders',
    location: 'Riyadh, KSA',
    engineer: 'Eng. Jihad',
    date: '2026-09-13',
    country: 'SA',
    voltage: 400,
    frequency: 60,
    powerFactor: 0.85,
    ambientTemp: 45,
    groupingCount: 1,
    maxVoltageDropLighting: 3,
    maxVoltageDropPower: 5,
    preferredManufacturer: 'ABB',
    buildings: [
      {
        id: 'bldg-1',
        name: 'Residential Tower 1',
        floors: 5,
        serviceFloors: 1,
        apartmentsPerFloor: 4,
        supplyVoltage: '400',
        earthingSystem: 'TN-S',
        lightningProtection: false,
        floorDesigns: [
          {
            id: 'fd-1',
            floorNumber: 1,
            hasFloorSubPanels: false,
            items: [
              {
                id: 'fi-1',
                name: 'Apartment 101',
                type: 'APARTMENT',
                calculatedConnectedLoad: 25,
                calculatedMaxDemand: 12.5,
                calculatedCurrent: 22.6,
                cableSize: '10 mm²',
                breakerSize: '32A',
                cableLength: 25,
              } as FloorItem,
              {
                id: 'fi-2',
                name: 'Apartment 102',
                type: 'APARTMENT',
                calculatedConnectedLoad: 25,
                calculatedMaxDemand: 12.5,
                calculatedCurrent: 22.6,
                cableSize: '10 mm²',
                breakerSize: '32A',
                cableLength: 25,
              } as FloorItem,
            ],
          },
        ],
        buildingLoads: [
          {
            id: 'bl-1',
            name: 'Passenger Elevator 1',
            quantity: 1,
            cableLength: 40,
            loadLibraryItem: {
              id: 'lib-1',
              name: 'Passenger Elevator 15kW',
              category: 'ELEVATOR',
              power: 15,
              powerFactor: 0.85,
              loadType: 'MOTOR',
              voltage: 400,
              phase: 3,
            } as any,
          } as any,
        ],
      } as Building,
    ],
    apartmentTemplates: [],
    loadLibraryItems: [],
  };
}

const mockRevisions = [
  {
    id: 'rev-0',
    projectId: 'proj-pdf-123',
    rev: '0',
    description: 'Initial Engineering Issue',
    createdById: 'usr-1',
    createdByUsername: 'Chief Engineer',
    snapshotJson: '{}',
    createdAt: '2026-09-13T00:00:00.000Z',
  },
];

describe('renderReportHtml', () => {
  it('generates a complete self-contained HTML document with all 8 engineering schedules', () => {
    const project = createSampleProject();
    const html = renderReportHtml({
      project,
      equipment: mockEquipment,
      revisions: mockRevisions,
      companyName: 'Apex Engineering Consultants',
    });

    // Valid HTML5 document structure
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('Al-Noor Horizon Complex - Engineering Package');

    // Covers standalone CSS and page format rules
    expect(html).toContain('@page');
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('Consolas, "Courier New", Courier, monospace');

    // Page 1: Cover Page
    expect(html).toContain('Executive Engineering Report');
    expect(html).toContain('Al-Noor Horizon Complex');
    expect(html).toContain('Apex Engineering Consultants');
    expect(html).toContain('Initial Engineering Issue');

    // Page 2: Load Analysis
    expect(html).toContain('LOAD ANALYSIS &amp; PHASE BALANCING SCHEDULE');

    // Page 3: MDB Schedule
    expect(html).toContain('MAIN DISTRIBUTION BOARD (MDB) FEEDER SCHEDULE');

    // Page 4: Cable Schedule
    expect(html).toContain('CABLE SIZING &amp; INSTALLATION SCHEDULE');

    // Page 5: Breakers Schedule
    expect(html).toContain('CIRCUIT BREAKERS &amp; SELECTIVITY PROTECTION SCHEDULE');

    // Page 6: Voltage Drop Schedule
    expect(html).toContain('VOLTAGE DROP &amp; COMPLIANCE ANALYSIS SCHEDULE');

    // Page 7: Short Circuit Schedule
    expect(html).toContain('SHORT-CIRCUIT FAULT ANALYSIS SCHEDULE');

    // Page 8: BOM Schedule
    expect(html).toContain('BILL OF MATERIALS &amp; PROCUREMENT SCHEDULE');
  });

  it('renders correctly when filtering by buildingId', () => {
    const project = createSampleProject();
    const html = renderReportHtml({
      project,
      buildingId: 'bldg-1',
      equipment: mockEquipment,
    });

    expect(html).toContain('Residential Tower 1');
    expect(html).toContain('Apartment 101');
  });

  it('wraps arbitrary markup into an A4 landscape HTML document with TrueType fonts', () => {
    const output = wrapReportMarkup('<div id="print-all-tabs"><h2>Test Schedule</h2></div>', 'Custom Title');
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<title>Custom Title</title>');
    expect(output).toContain('size: A4 landscape');
    expect(output).toContain('Test Schedule');
    expect(output).toContain('#print-all-tabs');
  });
});
