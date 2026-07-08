import { describe, it, expect } from 'vitest';
import { generateSLD } from './generator';

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
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('sld');
    expect(dsl).toContain('transformer');
    expect(dsl).toContain('bus');
    expect(dsl).toContain('breaker');
  });

  it('includes transformer with project voltage', () => {
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('1000 kVA');
  });

  it('generates sub-panel nodes for floors with sub-panels', () => {
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('distribution_board');
  });

  it('generates load nodes with F-floor-letter naming', () => {
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('F1-A');
    expect(dsl).toContain('F1-B');
    expect(dsl).toContain('F2-A');
  });

  it('generates cable names with W prefix', () => {
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('Wf1a');
    expect(dsl).toContain('Wf1b');
    expect(dsl).toContain('Wf2a');
  });

  it('generates load nodes connected to breakers', () => {
    const dsl = generateSLD(mockProject as any);
    expect(dsl).toContain('= load');
  });
});
