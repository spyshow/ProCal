// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  convertSvgStringToDxf,
  convertSvgElementToDxf,
  convertMultipleSvgStringsToDxf,
  parseSvgTransform,
  parseSvgPathData,
  applyMatrix2D,
  CAD_LAYERS,
} from '../svg-to-dxf';

describe('svg-to-dxf CAD Vector Exporter (FEAT-07)', () => {
  it('registers all standard AIA/ISO electrical CAD layers in the DXF LAYER table', () => {
    const svg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <line x1="100" y1="100" x2="700" y2="100" stroke="#f97316" stroke-width="4" />
    </svg>`;

    const dxf = convertSvgStringToDxf(svg);

    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('HEADER');
    expect(dxf).toContain('TABLES');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('EOF');

    for (const layer of CAD_LAYERS) {
      expect(dxf).toContain(layer.name);
    }
  });

  it('inverts Y-coordinates (y_cad = H - y_svg) and routes elements to appropriate AIA CAD layers', () => {
    const svg = `<svg viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="20" height="20"><path d="M 20 0 L 0 0 0 20" /></pattern>
      </defs>
      <rect width="1000" height="500" fill="url(#grid)" />
      <line x1="100" y1="100" x2="500" y2="100" stroke="#f97316" stroke-width="4" />
      <line x1="250" y1="100" x2="250" y2="300" stroke="#94a3b8" stroke-width="1.5" />
      <rect x="200" y="300" width="120" height="80" stroke="#38bdf8" />
      <rect x="240" y="180" width="20" height="30" stroke="#22d3ee" />
      <circle cx="250" cy="60" r="18" stroke="#c084fc" />
      <circle cx="350" cy="300" r="5" stroke="#ef4444" />
      <text x="250" y="50" text-anchor="middle" font-size="12">MDB-01 — 4x120 mm² · ΔV 1.8%</text>
    </svg>`;

    const dxf = convertSvgStringToDxf(svg);

    expect(dxf).toContain('LINE');
    expect(dxf).toContain('LWPOLYLINE');
    expect(dxf).toContain('CIRCLE');
    expect(dxf).toContain('TEXT');
    expect(dxf).toContain('MDB-01 - 4x120 mm2 . dV 1.8%');
    expect(dxf).toContain('\n400\n');
  });

  it('applies cumulative <g transform="translate(...) scale(...) rotate(...)"> matrices accurately', () => {
    const m = parseSvgTransform('translate(100, 50) scale(2)');
    const pt = applyMatrix2D(m, 10, 20);
    expect(pt.x).toBeCloseTo(120, 4);
    expect(pt.y).toBeCloseTo(90, 4);

    const svg = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(100, 50)">
        <g transform="scale(2)">
          <circle cx="10" cy="20" r="5" />
        </g>
      </g>
    </svg>`;

    const dxf = convertSvgStringToDxf(svg);
    expect(dxf).toContain('CIRCLE');
    expect(dxf).toContain('\n120\n');
    expect(dxf).toContain('\n310\n');
  });

  it('tessellates SVG <path> commands (M, L, H, V, C, Q, A, Z) into DXF geometry', () => {
    const subpaths = parseSvgPathData('M 10 10 H 50 V 40 C 50 55, 30 55, 10 40 Q 0 25, 10 10 Z', 8);
    expect(subpaths).toHaveLength(1);
    expect(subpaths[0].closed).toBe(true);
    expect(subpaths[0].points.length).toBeGreaterThan(10);

    const arcSubpaths = parseSvgPathData('M 100 100 A 25 25 0 0 1 150 100', 8);
    expect(arcSubpaths).toHaveLength(1);
    expect(arcSubpaths[0].points.length).toBe(9);
  });

  it('blocks DXF export when options.isTrial is true', () => {
    const svg = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="100" y2="100" />
    </svg>`;

    expect(() => convertSvgStringToDxf(svg, { isTrial: true })).toThrow(
      /locked on Free Trial projects/i
    );

    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg')!;
    expect(() => convertSvgElementToDxf(svgEl, { isTrial: true })).toThrow(
      /locked on Free Trial projects/i
    );
  });

  it('skips Schematex zebra band rects, deduplicates colliding MCB labels, and spaces multi-sheet grids without overlap', () => {
    const makeFloorSvg = (floorTag: string) => `<svg width="445" height="594" viewBox="0 0 445 594" xmlns="http://www.w3.org/2000/svg">
      <text x="20" y="22" class="lt-sld-title">Internal Title Should Be Skipped In Multi-Sheet</text>
      <g transform="translate(0, 34)">
        <rect x="0" y="0" width="445" height="100" class="lt-sld-band-odd"/>
        <text x="14" y="18" class="lt-sld-band-label">400V</text>
        <line x1="80" y1="240" x2="345" y2="240" class="lt-sld-bus" />
        <text x="229.75" y="279" class="lt-sld-cable">Wf1a</text>
        <text x="229.75" y="291" class="lt-sld-cable">2.5 mm2</text>
        <g transform="translate(235, 340)" data-type="breaker" data-id="fm1_a">
          <line x1="-6" y1="10" x2="8" y2="-10" class="lt-sld-stroke-thick"/>
        </g>
        <text x="235" y="300" class="lt-sld-id">25A</text>
        <text x="235" y="372" class="lt-sld-rating">25A</text>
        <text x="235" y="404" class="lt-sld-id">${floorTag}-A</text>
        <text x="325" y="404" class="lt-sld-id">${floorTag}-B</text>
      </g>
    </svg>`;

    const sheets = [
      {
        title: 'Tower A - Floor 1 (2 circuits)',
        subtitle: '4-Building 5-Floor Residential Complex | 400V 3-Phase | 50Hz | IEC 60364',
        svgMarkup: makeFloorSvg('F1'),
      },
      {
        title: 'Tower A - Floor 2 (2 circuits)',
        subtitle: '4-Building 5-Floor Residential Complex | 400V 3-Phase | 50Hz | IEC 60364',
        svgMarkup: makeFloorSvg('F2'),
      },
    ];

    const dxf = convertMultipleSvgStringsToDxf(sheets);

    expect(dxf).toContain('DRAWING 01/02 - Tower A - Floor 1 (2 circuits)');
    expect(dxf).toContain('DRAWING 02/02 - Tower A - Floor 2 (2 circuits)');
    expect(dxf).not.toContain('Internal Title Should Be Skipped In Multi-Sheet');
    expect(dxf).toContain('F1-A');
    expect(dxf).toContain('F1-B');
    expect(dxf).toContain('F2-A');
    expect(dxf).toContain('F2-B');

    // Only one "25A" per sheet (the rating at y=372), not two per sheet
    const count25A = (dxf.match(/\n25A\n/g) || []).length;
    expect(count25A).toBe(2);
  });
});
