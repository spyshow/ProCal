import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { generateDrawingsPdf } from '../src/lib/drawings/drawings-pdf';
import { renderDrawingsHtml } from '../src/lib/drawings/drawings-html';
import { generateSLDPages } from '../src/lib/sld/generator';
import { renderSldPage, sldExportPostprocessBody } from '../src/lib/drawings/sld-render';
import { buildRiserModel } from '../src/lib/drawings/riser-model';
import { createFindBreaker } from '../src/lib/calculations/feeders';
import { getBrowser, closeBrowser } from '../src/lib/drawings/chromium-pool';
import type { Project } from '../src/types';

/**
 * Task 4 Step 6 verification (throwaway). Renders a 20-floor tower's drawing
 * pack, asserts the page count, and screenshots sheets so the print-only
 * post-processing can be eyeballed.
 */

const FLOORS = 20;
const APTS = 4;

function buildTower(floors: number, aptsPerFloor: number): Project {
  return {
    id: 'p1',
    name: 'Verification Tower',
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxDemandFactor: 0.8,
    calculationStandard: 'IEC',
    preferredManufacturer: 'MIXED',
    maxVoltageDropPower: 5,
    maxVoltageDropLighting: 3,
    transformerSize: null,
    buildings: [
      {
        id: 'bldg_1',
        name: 'Tower A',
        floors,
        serviceFloors: 0,
        apartmentsPerFloor: aptsPerFloor,
        supplyVoltage: '400V 3-Phase',
        earthingSystem: 'TN-S',
        lightningProtection: true,
        transformer: null,
        generator: null,
        mechanicalLoads: '[]',
        buildingLoads: [],
        floorDesigns: Array.from({ length: floors }, (_, i) => {
          const n = i + 1;
          const hasSubPanels = n % 3 === 0;
          return {
            id: `fd_${n}`,
            buildingId: 'bldg_1',
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
                id: `item_${n}_${j}`,
                floorDesignId: `fd_${n}`,
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

function countPdfPages(buf: Buffer): number {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}

async function main() {
  const project = buildTower(FLOORS, APTS);
  const outDir = path.join(process.cwd(), 'scratch');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('=== generateDrawingsPdf (pooled Chromium) ===');
  const t0 = Date.now();
  const result = await generateDrawingsPdf({ project, includeSvg: true });
  const elapsed = Date.now() - t0;

  const pdfPath = path.join(outDir, 'drawings.pdf');
  fs.writeFileSync(pdfPath, result.pdf);

  console.log(`  SLD sheets:      ${result.svgs?.length ?? 0}`);
  console.log(`  riser sheets:    ${result.riserSheetCount}`);
  console.log(`  PDF pages:       ${result.sheetCount} (expected ${FLOORS + result.riserSheetCount})`);
  console.log(`  PDF size:        ${(result.pdf.length / 1024).toFixed(0)} KB`);
  console.log(`  elapsed:         ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  schematex diags: ${result.diagnostics.length}`);
  for (const d of result.diagnostics.slice(0, 5)) console.log(`    - ${d}`);

  const expected = FLOORS + result.riserSheetCount;
  const ok = result.sheetCount === expected;
  console.log(`\n  ${ok ? 'PASS' : 'FAIL'} — ${result.sheetCount} pages, expected ${expected}`);

  // Second run must reuse the pooled browser and be clearly faster.
  console.log('\n=== pooled browser reuse ===');
  const t1 = Date.now();
  await generateDrawingsPdf({ project });
  const second = Date.now() - t1;
  console.log(`  first  call: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  second call: ${(second / 1000).toFixed(1)}s (reused browser)`);

  // Screenshot sheets for eyeballing.
  console.log('\n=== sheet screenshots ===');
  const pages = generateSLDPages(project);
  const sldSheets = pages.map((p) => {
    const { svg } = renderSldPage(p);
    return { heading: `${p.buildingName} - ${p.title}`, subtitle: p.floors, svg };
  });
  const findBreaker = createFindBreaker([], {}, undefined);
  const riserModels = [buildRiserModel(project, 'bldg_1', findBreaker)!].filter(Boolean);
  const html = renderDrawingsHtml({
    projectName: project.name,
    sheetKind: 'DRAWINGS',
    sldSheets,
    riserModels,
  });
  const htmlPath = path.join(outDir, 'drawings.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1060, height: 720, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(sldExportPostprocessBody());

  const shots: Array<[string, string]> = [
    ['[data-sld-sheet]:nth-of-type(1)', 'drawings-sld-direct'],
    ['[data-sld-sheet]:nth-of-type(3)', 'drawings-sld-subpanel'],
    ['[data-riser-sheet]', 'drawings-riser'],
  ];
  for (const [sel, name] of shots) {
    const el = await page.$(sel);
    if (!el) {
      console.log(`  ${name}: SELECTOR NOT FOUND (${sel})`);
      continue;
    }
    const p = path.join(outDir, `${name}.png`);
    await el.screenshot({ path: p as `${string}.png` });
    console.log(`  wrote ${p}`);
  }
  await page.close();
  await closeBrowser();

  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exitCode = 1;
});
