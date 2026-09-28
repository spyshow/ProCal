import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import React from 'react';
import { buildRiserModel, paginateRiser, riserBand, RISER_BAND_COLOR } from './riser-model';
import { RiserSvg, PRINT_RISER_THEME } from './riser-svg';
import { createFindBreaker } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

const requireModule = createRequire(import.meta.url);
const ReactDOMServer = requireModule('react-dom/server');

/**
 * Task 4 Step 3 guard: the riser drawing must be renderable on the server, and
 * its geometry must not drift from the model that feeds the interactive page.
 */

function makeProject(floors: number, aptsPerFloor: number, hasSubPanels: boolean): Project {
  return {
    id: 'p1',
    name: 'Test Tower',
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxDemandFactor: 0.8,
    calculationStandard: 'IEC',
    preferredManufacturer: 'MIXED',
    maxVoltageDropPower: 5,
    transformerSize: null,
    buildings: [
      {
        id: 'b1',
        name: 'Tower A',
        floors,
        serviceFloors: 0,
        apartmentsPerFloor: aptsPerFloor,
        supplyVoltage: '400V 3-Phase',
        earthingSystem: 'TN-S',
        lightningProtection: false,
        transformer: null,
        buildingLoads: [],
        floorDesigns: Array.from({ length: floors }, (_, i) => {
          const n = i + 1;
          return {
            id: `fd${n}`,
            buildingId: 'b1',
            floorNumber: n,
            hasFloorSubPanels: hasSubPanels,
            riserCableSize: hasSubPanels ? '95 mm²' : null,
            riserCableLength: hasSubPanels ? 10 + (n - 1) * 5 : null,
            riserBreakerSize: hasSubPanels ? '125A' : null,
            riserInstallMethod: 'C',
            riserCableInsulation: 'XLPE',
            riserCableMaterial: 'copper',
            riserAmbientTemp: 30,
            riserGroupingCount: 1,
            items: Array.from({ length: aptsPerFloor }, (_, j) => {
              const current = 14 + j * 3.5 + (n % 5);
              return {
                id: `it${n}_${j}`,
                floorDesignId: `fd${n}`,
                type: 'APARTMENT',
                name: `Apt ${n}-${j + 1}`,
                calculatedConnectedLoad: +(current * 0.23).toFixed(2),
                calculatedMaxDemand: +(current * 0.18).toFixed(2),
                calculatedCurrent: current,
                breakerSize: `${Math.ceil(current / 5) * 5}A`,
                cableSize: '6 mm²',
                cableLength: 25,
                installMethod: 'C',
                cableInsulation: 'XLPE',
                cableMaterial: 'copper',
                ambientTemp: 30,
                groupingCount: 1,
                assignedPhase: j + 1,
              };
            }),
          };
        }),
      },
    ],
  } as unknown as Project;
}

const findBreaker = createFindBreaker([], {}, undefined);

describe('buildRiserModel', () => {
  it('produces one entry per floor with a band verdict', () => {
    const model = buildRiserModel(makeProject(8, 4, false), 'b1', findBreaker);
    expect(model).not.toBeNull();
    expect(model!.floors).toHaveLength(8);
    expect(model!.floors.map((f) => f.floorNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const f of model!.floors) {
      expect(['ok', 'warning', 'danger', 'nodata']).toContain(f.band);
    }
  });

  it('stacks floors upward with non-overlapping bands', () => {
    const model = buildRiserModel(makeProject(12, 6, false), 'b1', findBreaker)!;
    // cy decreases as the floor number rises, so ascending cy = top of stack first.
    const topDown = [...model.floors].sort((a, b) => a.cy - b.cy);
    for (let i = 1; i < topDown.length; i++) {
      const above = topDown[i - 1];
      const below = topDown[i];
      expect(below.cy - below.height / 2).toBeGreaterThanOrEqual(above.cy + above.height / 2);
    }
  });

  it('derives svgHeight from total floor height, growing with floor count', () => {
    const short = buildRiserModel(makeProject(4, 4, false), 'b1', findBreaker)!;
    const tall = buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!;
    expect(tall.layout.svgHeight).toBeGreaterThan(short.layout.svgHeight);
    expect(short.layout.svgHeight).toBeGreaterThanOrEqual(700); // floor clamp
  });

  it('reads the voltage-drop limit from the project, not a hardcoded 4%', () => {
    const strict = makeProject(4, 4, false);
    strict.maxVoltageDropPower = 3;
    expect(buildRiserModel(strict, 'b1', findBreaker)!.totalVdLimit).toBe(3);
    expect(buildRiserModel(makeProject(4, 4, false), 'b1', findBreaker)!.totalVdLimit).toBe(5);
  });

  it('builds one circuit row per floor item', () => {
    const model = buildRiserModel(makeProject(3, 4, true), 'b1', findBreaker)!;
    for (const f of model.floors) {
      expect(f.circuits).toHaveLength(f.items.length);
      for (const c of f.circuits) {
        expect(c.cableLabel).toBeTruthy();
        expect(Number.isFinite(c.demandKw)).toBe(true);
      }
    }
  });

  it('returns null for a project with no buildings', () => {
    const empty = makeProject(2, 2, false);
    empty.buildings = [];
    expect(buildRiserModel(empty, null, findBreaker)).toBeNull();
  });
});

describe('riserBand', () => {
  it('maps pct/limit/hasData to the documented band', () => {
    expect(riserBand(1, 5, false)).toBe('nodata');
    expect(riserBand(1, 5, true)).toBe('ok');
    expect(riserBand(4.1, 5, true)).toBe('warning'); // > 80% of limit
    expect(riserBand(5.1, 5, true)).toBe('danger');
    // At exactly the limit the original page still coloured the cell amber:
    // `pct > limit` is false, `pct > limit * 0.8` is true. Preserved deliberately.
    expect(riserBand(5, 5, true)).toBe('warning');
  });

  it('has a distinct colour per band', () => {
    const colors = Object.values(RISER_BAND_COLOR);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('paginateRiser', () => {
  it('keeps a short riser on a single sheet', () => {
    const model = buildRiserModel(makeProject(3, 4, false), 'b1', findBreaker)!;
    const sheets = paginateRiser(model);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].showSupplyBlock).toBe(true);
    expect(sheets[0].firstFloorNumber).toBe(1);
    expect(sheets[0].lastFloorNumber).toBe(3);
  });

  it('splits a tall riser into several legible sheets', () => {
    const model = buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!;
    const sheets = paginateRiser(model);
    expect(sheets.length).toBeGreaterThan(1);
    // Every floor appears exactly once, in order, with no gaps or duplicates.
    const seen = sheets.flatMap((s) => s.floors.map((f) => f.floorNumber));
    expect(seen).toEqual(model.floors.map((f) => f.floorNumber));
  });

  it('draws the supply block on the first sheet only', () => {
    const sheets = paginateRiser(buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!);
    expect(sheets[0].showSupplyBlock).toBe(true);
    for (const s of sheets.slice(1)) expect(s.showSupplyBlock).toBe(false);
  });

  it('numbers sheets and labels them 1..total', () => {
    const sheets = paginateRiser(buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!);
    sheets.forEach((s, i) => {
      expect(s.index).toBe(i + 1);
      expect(s.total).toBe(sheets.length);
    });
  });

  it('keeps each sheet within the readable unit budget', () => {
    const budget = 880;
    const sheets = paginateRiser(buildRiserModel(makeProject(20, 6, false), 'b1', findBreaker)!);
    for (const s of sheets) {
      const used = s.floors.reduce((sum, f) => sum + f.height, 0);
      // A sheet may exceed the budget only when it holds a single very tall floor.
      expect(used <= budget || s.floors.length === 1).toBe(true);
    }
  });

  it('stacks each sheet upward from its own base so floors never sit off-canvas', () => {
    const sheets = paginateRiser(buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!);
    for (const s of sheets) {
      for (const f of s.floors) {
        expect(f.cy - f.height / 2).toBeGreaterThanOrEqual(0);
        expect(f.cy + f.height / 2).toBeLessThanOrEqual(s.svgHeight);
      }
    }
  });

  it('never splits a floor across two sheets', () => {
    const sheets = paginateRiser(buildRiserModel(makeProject(14, 8, false), 'b1', findBreaker)!);
    const ids = sheets.flatMap((s) => s.floors.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('RiserSvg server rendering', () => {
  it('renders to static markup with no DOM and no theme leakage', () => {
    const model = buildRiserModel(makeProject(6, 4, false), 'b1', findBreaker)!;
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model, theme: PRINT_RISER_THEME, idPrefix: 'test' })
    );

    expect(html).toContain('<svg');
    expect(html).toContain('RISER DIAGRAM');
    expect(html).toContain('Tower A');
    // print theme must not reference CSS custom properties
    expect(html).not.toContain('var(--');
    // the pattern id must be namespaced so multiple sheets can coexist
    expect(html).toContain('url(#test-grid)');
  });

  it('emits one floor group per model floor', () => {
    const model = buildRiserModel(makeProject(9, 3, false), 'b1', findBreaker)!;
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model, theme: PRINT_RISER_THEME })
    );
    // Each floor draws its "FL n" label.
    for (const f of model.floors) {
      expect(html).toContain(`>FL ${f.floorNumber}<`);
    }
  });

  it('carries the viewBox that matches the computed layout', () => {
    const model = buildRiserModel(makeProject(5, 4, false), 'b1', findBreaker)!;
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model, theme: PRINT_RISER_THEME })
    );
    expect(html).toContain(`viewBox="0 0 ${model.layout.svgWidth} ${model.layout.svgHeight}"`);
  });

  it('renders sub-panel floors with an SDB block and direct floors without', () => {
    const sdb = buildRiserModel(makeProject(2, 3, true), 'b1', findBreaker)!;
    const sdbHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model: sdb, theme: PRINT_RISER_THEME })
    );
    expect(sdbHtml).toContain('SDB-1');
    expect(sdbHtml).toContain('SDB-2');

    const direct = buildRiserModel(makeProject(2, 3, false), 'b1', findBreaker)!;
    const directHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model: direct, theme: PRINT_RISER_THEME })
    );
    expect(directHtml).not.toContain('SDB-');
  });

  it('omits the supply block on continuation sheets but keeps it on sheet 1', () => {
    const model = buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!;
    const sheets = paginateRiser(model);
    expect(sheets.length).toBeGreaterThan(1);

    const first = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model, sheet: sheets[0], theme: PRINT_RISER_THEME })
    );
    expect(first).toContain('MDB');
    expect(first).toContain('kVA');

    const second = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RiserSvg, { model, sheet: sheets[1], theme: PRINT_RISER_THEME })
    );
    expect(second).not.toContain('Main Distribution Board');
    // Still a real drawing: title, bus and floors present.
    expect(second).toContain('RISER DIAGRAM');
    expect(second).toContain('MAIN BUS');
  });

  it('namespaces the grid pattern per sheet so several sheets can coexist', () => {
    const model = buildRiserModel(makeProject(20, 4, false), 'b1', findBreaker)!;
    const sheets = paginateRiser(model);
    const ids = sheets.map((s) => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RiserSvg, { model, sheet: s, theme: PRINT_RISER_THEME, idPrefix: `p${s.index}` })
      );
      return html.match(/id="(p\d+-grid)"/)?.[1];
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});
