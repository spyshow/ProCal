import { generateSLDPages } from '@/lib/sld/generator';
import { buildRiserModel, paginateRiser, type RiserModel } from './riser-model';
import { renderSldPage, sldExportPostprocessBody } from './sld-render';
import { renderDrawingsHtml, type SldSheet } from './drawings-html';
import { withBrowser } from './chromium-pool';
import { createFindBreaker, type EquipmentItem, type FindBreaker } from '@/lib/calculations/feeders';
import type { Project } from '@/types';

/**
 * Server-side drawing pack: every SLD floor as its own landscape A4 sheet, plus
 * one riser sheet per building (Task 4 Step 4/5).
 *
 * One Chromium page, one `page.pdf()` call, so an N-page pack costs a single
 * render pass.
 */

export interface GenerateDrawingsPdfOptions {
  project: Project;
  equipment?: EquipmentItem[];
  breakerSettings?: unknown[];
  /** Restrict the pack to one building. */
  buildingId?: string;
  companyName?: string;
  /** Return raw SVG strings alongside the PDF (for the MCP artifact). */
  includeSvg?: boolean;
}

export interface DrawingsPdfResult {
  pdf: Buffer;
  /** Schematex diagnostics collected while rendering. */
  diagnostics: string[];
  sheetCount: number;
  riserSheetCount: number;
  /** Raw SVG per SLD sheet, when `includeSvg` is set. */
  svgs?: string[];
  riserModels?: RiserModel[];
}

function countPdfPages(buf: Buffer): number {
  const s = buf.toString('latin1');
  const matches = s.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

export async function generateDrawingsPdf(
  options: GenerateDrawingsPdfOptions
): Promise<DrawingsPdfResult> {
  const { project, equipment = [], buildingId } = options;

  const findBreaker: FindBreaker = createFindBreaker(
    equipment,
    {
      ACB: project.defaultAcbFamilyId ?? undefined,
      MCCB: project.defaultMccbFamilyId ?? undefined,
      MCB: project.defaultMcbFamilyId ?? undefined,
    },
    project.preferredManufacturer
  );

  // ---- SLD sheets -----------------------------------------------------------
  const pages = generateSLDPages(project);
  const diagnostics: string[] = [];
  const sldSheets: SldSheet[] = pages.map((page) => {
    const { svg, diagnostics: d } = renderSldPage(page);
    diagnostics.push(...d.map((x) => `${page.title}: ${x}`));
    return {
      heading: `${page.buildingName ?? project.name} — ${page.title}`,
      subtitle: page.floors,
      svg,
    };
  });

  // ---- Riser sheets ---------------------------------------------------------
  const buildings = buildingId
    ? project.buildings.filter((b) => b.id === buildingId)
    : project.buildings;
  const riserModels = buildings
    .map((b) => buildRiserModel(project, b.id, findBreaker))
    .filter((m): m is RiserModel => m !== null);

  // A tall riser paginates across several sheets so the annotations stay legible.
  const riserSheetCount = riserModels.reduce(
    (sum, m) => sum + paginateRiser(m).length,
    0
  );

  const html = renderDrawingsHtml({
    projectName: project.name,
    sheetKind: 'DRAWINGS',
    sldSheets,
    riserModels,
    companyName: options.companyName,
  });

  const pdf = await withBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
      // String form, not a function: tsx/esbuild wraps named inner functions in a
      // `__name()` helper, and the serialized function body then throws
      // "__name is not defined" inside the browser.
      await page.evaluate('document.fonts.ready');

      // Post-process the SLD sheets only. Riser sheets are already final.
      await page.evaluate(sldExportPostprocessBody());

      const uint8 = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      return Buffer.from(uint8);
    } finally {
      await page.close();
    }
  });

  return {
    pdf,
    diagnostics,
    sheetCount: countPdfPages(pdf),
    riserSheetCount,
    svgs: options.includeSvg ? sldSheets.map((s) => s.svg) : undefined,
    riserModels,
  };
}
