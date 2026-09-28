import React from 'react';
import { createRequire } from 'module';
import { wrapReportMarkup } from '@/lib/reports/render-report-html';
import { RiserSvg, PRINT_RISER_THEME } from './riser-svg';
import { paginateRiser, type RiserModel } from './riser-model';

const requireModule = createRequire(import.meta.url);
const ReactDOMServer = requireModule('react-dom/server');

/**
 * Landscape A4 drawing sheets — one page per SLD floor, one per riser building
 * (Task 4 Step 4).
 *
 * Styling is inherited from `wrapReportMarkup()`, the same function the executive
 * engineering package uses, so the drawings carry the report's typography, zebra
 * striping and print rules verbatim rather than a parallel stylesheet.
 */

export interface SldSheet {
  /** Shown in the sheet header, e.g. "Tower A — F12". */
  heading: string;
  subtitle?: string;
  /** Raw schematex SVG, already cleaned by stripDuplicateMcbLabels(). */
  svg: string;
}

export interface RenderDrawingsHtmlOptions {
  projectName: string;
  /** Which drawing pack this is, used in the header strip. */
  sheetKind: string;
  sldSheets?: SldSheet[];
  riserModels?: RiserModel[];
  /** Same shape the report renderer accepts. */
  companyName?: string;
  companyLogoUrl?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

const DASH = '—';

export function renderDrawingsHtml(options: RenderDrawingsHtmlOptions): string {
  const {
    projectName,
    sheetKind,
    sldSheets = [],
    riserModels = [],
    companyName,
  } = options;

  const footerLeft = escapeXml(
    companyName ? `${companyName} ${DASH} ${projectName}` : projectName
  );

  const sldMarkup = sldSheets
    .map(
      (sheet, i) => `
      <div
        class="drawing-sheet print-page-container"
        style={{ pageBreakBefore: ${i === 0 ? "'avoid'" : "'always'"}, breakBefore: ${i === 0 ? "'avoid'" : "'page'"} }}
        data-sld-sheet
      >
        <div class="drawing-head">
          <div>
            <div class="drawing-title">${escapeXml(sheet.heading)}</div>
            ${sheet.subtitle ? `<div class="drawing-sub">${escapeXml(sheet.subtitle)}</div>` : ''}
          </div>
          <div class="drawing-sheetno">Sheet ${i + 1} of ${sldSheets.length}</div>
        </div>
        <div class="drawing-body">${sheet.svg}</div>
        <div class="drawing-foot">
          <span>${footerLeft} ${DASH} ${escapeXml(sheetKind)}</span>
          <span>IEC 60364-5-52 / IEC 60909</span>
        </div>
      </div>`
    )
    .join('');

  const riserMarkup = riserModels
    .flatMap((model) =>
      paginateRiser(model).map((sheet, i, arr) => {
        const label =
          arr.length > 1
            ? `${model.building.name} ${DASH} RISER DIAGRAM (${i + 1}/${arr.length})`
            : `${model.building.name} ${DASH} RISER DIAGRAM`;
        return `
      <div
        class="drawing-sheet print-page-container"
        style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
        data-riser-sheet
      >
        <div class="drawing-head">
          <div>
            <div class="drawing-title">${escapeXml(label)}</div>
            <div class="drawing-sub">${escapeXml(
              `${model.floors.length} floors · ${model.project.voltage}V · ${model.project.calculationStandard || 'IEC'}`
            )}</div>
          </div>
          <div class="drawing-sheetno">Floors ${sheet.firstFloorNumber}${
            sheet.lastFloorNumber !== sheet.firstFloorNumber
              ? `-${sheet.lastFloorNumber}`
              : ''
          }</div>
        </div>
        <div class="drawing-body">
          ${ReactDOMServer.renderToStaticMarkup(
            React.createElement(RiserSvg, {
              model,
              sheet,
              theme: PRINT_RISER_THEME,
              idPrefix: `riser-${model.building.id}-${i}`,
              className: 'drawing-svg',
            })
          )}
        </div>
        <div class="drawing-foot">
          <span>${footerLeft} ${DASH} ${escapeXml(sheetKind)}</span>
          <span>Transformer ${model.transformer.kva ?? '-'} kVA · MDB ${model.mdb.mainBreakerIn}A</span>
        </div>
      </div>`;
      })
    )
    .join('');

  const body = sldMarkup + riserMarkup;

  const empty =
    sldSheets.length === 0 && riserModels.length === 0
      ? `<div class="drawing-sheet"><div class="drawing-body"><p style="font-size:13px;color:#64748b">No drawings could be generated for this project. Add buildings and floors, then recalculate.</p></div></div>`
      : body;

  // Extra rules layered on top of wrapReportMarkup's stylesheet. Kept small and
  // scoped to .drawing-* so the shared report CSS stays authoritative.
  const drawingsCss = `
  .drawing-sheet {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .drawing-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    border-bottom: 2px solid #f97316;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .drawing-title {
    font-weight: 700;
    font-size: 14px;
    color: #0f172a;
  }
  .drawing-sub {
    font-size: 10px;
    color: #64748b;
    font-family: Consolas, "Courier New", monospace;
  }
  .drawing-sheetno {
    font-size: 10px;
    color: #64748b;
    font-family: Consolas, "Courier New", monospace;
    white-space: nowrap;
  }
  .drawing-body {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow: hidden;
  }
  .drawing-body svg,
  .drawing-svg {
    max-width: 100%;
    max-height: 158mm;
    height: auto;
    width: auto;
  }
  .drawing-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    margin-top: 6px;
    font-size: 9px;
    color: #94a3b8;
    font-family: Consolas, "Courier New", monospace;
  }
  `;

  // `wrapReportMarkup` already emits `@page { size: A4 landscape; margin: 10mm }`,
  // which is what the drawings pack wants, so no page-rule override is needed.
  return wrapReportMarkup(
    `<style>${drawingsCss}</style>${body || empty}`,
    `${projectName} - ${sheetKind}`
  );
}
