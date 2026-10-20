import { describe, it, expect } from 'vitest';
import { generateSLD, generateSLDPages, resolveBreakerRating, consolidateFloorDesigns } from './generator';

describe('SLD Generator', () => {
  const mockProject = {
    name: 'Test Building',
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    transformerSize: 1000,
    buildings: [{
      name: 'Block A',
      floors: 2,
      floorDesigns: [
        {
          floorNumber: 1,
          hasFloorSubPanels: true,
          items: [
            { name: 'Apt 1', type: 'APARTMENT', calculatedMaxDemand: 5, calculatedCurrent: 21.74, breakerSize: '25A', cableSize: '4 mm²' },
            { name: 'Apt 2', type: 'APARTMENT', calculatedMaxDemand: 5, calculatedCurrent: 21.74, breakerSize: '25A', cableSize: '4 mm²' },
          ],
        },
        {
          floorNumber: 2,
          hasFloorSubPanels: true,
          items: [
            { name: 'Apt 3', type: 'APARTMENT', calculatedMaxDemand: 5, calculatedCurrent: 21.74, breakerSize: '25A', cableSize: '4 mm²' },
          ],
        },
      ],
    }],
  };

  it('generates valid Schematex DSL', () => {
    const dsl = generateSLD(mockProject as Parameters<typeof generateSLD>[0]);
    expect(dsl).toContain('sld');
    expect(dsl).toContain('transformer');
    expect(dsl).toContain('bus');
    expect(dsl).toContain('breaker');
  });

  it('includes transformer with project voltage', () => {
    const dsl = generateSLD(mockProject as Parameters<typeof generateSLD>[0]);
    expect(dsl).toContain('1000 kVA');
  });

  it('generates one page per floor', () => {
    const pages = generateSLDPages(mockProject as Parameters<typeof generateSLDPages>[0]);
    expect(pages.length).toBe(2); // 2 floors with items
  });

  it('each page has its own DSL with floor-specific nodes', () => {
    const pages = generateSLDPages(mockProject as Parameters<typeof generateSLDPages>[0]);
    expect(pages[0].title).toBe('F1');
    expect(pages[0].dsl).toContain('f1_bus');
    expect(pages[0].dsl).toContain('F1-A');
    expect(pages[0].dsl).toContain('F1-B');
  });

  it('each page is a standalone diagram with MDB bus', () => {
    const pages = generateSLDPages(mockProject as Parameters<typeof generateSLDPages>[0]);
    for (const page of pages) {
      expect(page.dsl).toContain('sld');
      expect(page.dsl).toContain('mdb = bus');
    }
  });

  it('generates load nodes with F-floor-letter naming', () => {
    const dsl = generateSLD(mockProject as Parameters<typeof generateSLD>[0]);
    expect(dsl).toContain('F1-A');
    expect(dsl).toContain('F1-B');
    expect(dsl).toContain('F2-A');
  });

  it('generates cable names with W prefix', () => {
    const dsl = generateSLD(mockProject as Parameters<typeof generateSLD>[0]);
    expect(dsl).toContain('Wf1a');
    expect(dsl).toContain('Wf1b');
    expect(dsl).toContain('Wf2a');
  });

  it('generates load nodes connected to breakers', () => {
    const dsl = generateSLD(mockProject as Parameters<typeof generateSLD>[0]);
    expect(dsl).toContain('= load');
  });

  it('dynamically sizes transformer from project loads when transformerSize is null', () => {
    const projectWithoutTx = {
      ...mockProject,
      transformerSize: null,
    };
    const dsl = generateSLD(projectWithoutTx as Parameters<typeof generateSLD>[0]);
    // 3 apartments of 5kW = 15kW total demand / 0.85 * 1.2 = 21.2 kVA -> sizes to standard 100 kVA
    expect(dsl).toContain('rating: "100 kVA"');
  });

  describe('resolveBreakerRating', () => {
    it('preserves existing non-empty breaker size strings', () => {
      expect(resolveBreakerRating('63A', 45)).toBe('63A');
      expect(resolveBreakerRating('160', 120)).toBe('160A');
      expect(resolveBreakerRating(' 32A ', 20)).toBe('32A');
    });

    it('sizes null/empty breaker sizes to next standard breaker rating', () => {
      // IEC ratings: [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, ...]
      expect(resolveBreakerRating(null, 21.74, 'IEC')).toBe('25A');
      expect(resolveBreakerRating(undefined, 43.48, 'IEC')).toBe('50A');
      expect(resolveBreakerRating('', 135.8, 'IEC')).toBe('160A');
      expect(resolveBreakerRating('null', 18, 'IEC')).toBe('20A');
    });

    it('sizes null/empty breaker sizes to NEC ratings when code is NEC', () => {
      // NEC ratings: [..., 50, 60, 70, 80, 90, 100, ...]
      expect(resolveBreakerRating(null, 56, 'NEC')).toBe('60A');
    });
  });

  describe('SLD Breaker Amps vs Load Current', () => {
    it('floor breaker displays standard CB rating instead of raw load current sum', () => {
      // Floor 1 has 2 loads of 21.74A (43.48A total load current)
      // The breaker rating should be standard CB amps (25A max phase or 50A), NOT raw 44A
      const pages = generateSLDPages(mockProject as Parameters<typeof generateSLDPages>[0]);
      expect(pages[0].dsl).not.toContain('rating: "44A"');
      expect(pages[0].dsl).toMatch(/f1_bkr = breaker \[label: "F1", rating: "(25|50)A"\]/);
    });

    it('honors manual riserBreakerSize on the floor design', () => {
      const projectWithCustomRiser = {
        ...mockProject,
        buildings: [{
          ...mockProject.buildings[0],
          floorDesigns: [
            {
              ...mockProject.buildings[0].floorDesigns[0],
              riserBreakerSize: '160A',
            },
          ],
        }],
      };
      const pages = generateSLDPages(projectWithCustomRiser as Parameters<typeof generateSLDPages>[0]);
      expect(pages[0].dsl).toContain('rating: "160A"');

      const fullDsl = generateSLD(projectWithCustomRiser as Parameters<typeof generateSLD>[0]);
      expect(fullDsl).toContain('rating: "160A"');
    });

    it('branch MCBs with null breakerSize display standard CB rating instead of "null"', () => {
      const projectWithNullItemBreakers = {
        ...mockProject,
        buildings: [{
          ...mockProject.buildings[0],
          floorDesigns: [{
            floorNumber: 1,
            hasFloorSubPanels: true,
            items: [
              { name: 'Load 1', type: 'APARTMENT', calculatedMaxDemand: 5, calculatedCurrent: 46.53, breakerSize: null, cableSize: null },
            ],
          }],
        }],
      };
      const pages = generateSLDPages(projectWithNullItemBreakers as Parameters<typeof generateSLDPages>[0]);
      expect(pages[0].dsl).not.toContain('rating: "null"');
      expect(pages[0].dsl).toContain('rating: "50A"');
    });
  });

  describe('BuildingLoad Common Services Feeders', () => {
    const projectWithBuildingLoads = {
      name: 'Commercial Plaza',
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      calculationStandard: 'IEC',
      buildings: [
        {
          name: 'Main Tower',
          floors: 1,
          buildingLoads: [
            {
              id: 'load-elevator-1',
              quantity: 1,
              breakerSize: '63A',
              cableSize: '16 mm²',
              loadLibraryItem: {
                name: 'Passenger Elevator',
                power: 15,
                voltage: 400,
                phase: 3,
                powerFactor: 0.85,
              },
            },
            {
              id: 'load-firepump-1',
              quantity: 1,
              breakerSize: '160A',
              cableSize: '70 mm²',
              loadLibraryItem: {
                name: 'Fire Pump',
                power: 45,
                voltage: 400,
                phase: 3,
                powerFactor: 0.85,
              },
            },
          ],
          floorDesigns: [
            {
              floorNumber: 1,
              hasFloorSubPanels: false,
              items: [
                { name: 'Office 1', type: 'APARTMENT', calculatedMaxDemand: 10, calculatedCurrent: 17.0, breakerSize: '25A', cableSize: '4 mm²' },
              ],
            },
          ],
        },
      ],
    };

    it('emits MDB feeders for buildingLoads in generateSLD', () => {
      const dsl = generateSLD(projectWithBuildingLoads as Parameters<typeof generateSLD>[0]);
      expect(dsl).toContain('mdb_bus -> bkr_bload_load_elevator_1 [label: "Passenger Elevator"]');
      expect(dsl).toContain('mdb_bus -> bkr_bload_load_firepump_1 [label: "Fire Pump"]');
      expect(dsl).toContain('bkr_bload_load_elevator_1 = breaker [label: "63A", rating: "63A"]');
      expect(dsl).toContain('bkr_bload_load_firepump_1 = breaker [label: "160A", rating: "160A"]');
    });

    it('generates a dedicated Common Services page in generateSLDPages', () => {
      const pages = generateSLDPages(projectWithBuildingLoads as Parameters<typeof generateSLDPages>[0]);
      // 1 floor page + 1 common services page = 2 pages
      expect(pages.length).toBe(2);

      const servicesPage = pages.find((p) => p.title.includes('Services'));
      expect(servicesPage).toBeDefined();
      expect(servicesPage?.floors).toContain('Common Services (2 loads)');
      expect(servicesPage?.dsl).toContain('mdb -> bload_bkr_1 [label: "Passenger Elevator"]');
      expect(servicesPage?.dsl).toContain('mdb -> bload_bkr_2 [label: "Fire Pump"]');
    });

    it('generates an SLD page for a building with only building loads and no floor items', () => {
      const buildingOnlyServices = {
        ...projectWithBuildingLoads,
        buildings: [
          {
            name: 'Utility Plant',
            floors: 0,
            buildingLoads: projectWithBuildingLoads.buildings[0].buildingLoads,
            floorDesigns: [],
          },
        ],
      };

      const pages = generateSLDPages(buildingOnlyServices as Parameters<typeof generateSLDPages>[0]);
      expect(pages.length).toBe(1);
      expect(pages[0].title).toBe('Utility Plant - Services');
    });
  });
  describe('consolidateFloorDesigns & duplicate floorNumber handling', () => {
    it('consolidates multiple floorDesign records on the same floorNumber into one', () => {
      const duplicateFloorsProject = {
        name: 'Twin Apartment Floor',
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        buildings: [
          {
            id: 'bldg-1',
            name: 'Tower 1',
            floors: 1,
            floorDesigns: [
              {
                floorNumber: 1,
                hasFloorSubPanels: false,
                items: [
                  { name: 'Apartment 1', type: 'APARTMENT', calculatedMaxDemand: 23, calculatedCurrent: 100, breakerSize: '125A', cableSize: '25 mm²' },
                ],
              },
              {
                floorNumber: 1,
                hasFloorSubPanels: false,
                items: [
                  { name: 'Apartment 2', type: 'APARTMENT', calculatedMaxDemand: 23, calculatedCurrent: 100, breakerSize: '125A', cableSize: '25 mm²' },
                ],
              },
            ],
          },
        ],
      };

      const dsl = generateSLD(duplicateFloorsProject as Parameters<typeof generateSLD>[0]);
      const busMatches = dsl.match(/floor_bus_bldg_1_1 = bus/g);
      expect(busMatches).toHaveLength(1);
      expect(dsl).toContain('F1-A');
      expect(dsl).toContain('F1-B');

      const pages = generateSLDPages(duplicateFloorsProject as Parameters<typeof generateSLDPages>[0]);
      expect(pages).toHaveLength(1);
      expect(pages[0].title).toBe('F1');
      expect(pages[0].dsl).toContain('F1-A');
      expect(pages[0].dsl).toContain('F1-B');
    });
  });
});
