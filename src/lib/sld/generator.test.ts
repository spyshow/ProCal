import { describe, it, expect } from 'vitest';
import { generateSLD, generateSLDPages } from './generator';

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
});
