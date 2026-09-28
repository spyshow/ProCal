import { render, renderResult } from 'schematex';
import type { SLDPage } from '@/lib/sld/generator';

/**
 * SLD DSL → SVG for the server-side print path (Task 4 Step 4).
 *
 * The interactive page renders `<SchematexDiagram>` in the browser. The print
 * path cannot: schematex's `render()` is a pure string→string function, so we
 * call it directly and post-process the result inside headless Chromium.
 *
 * Everything in here is print-only. The interactive page is untouched.
 */

export interface SldRenderResult {
  svg: string;
  /** Non-fatal notes from schematex (e.g. unknown node options). */
  diagnostics: string[];
}

/**
 * `generateSLDPages` emits every branch MCB as
 *   `mcb [label: "20A", rating: "20A"]`
 * because the label and the rating are the same value. Schematex therefore
 * draws the ampacity twice, and once `repositionLabels` has moved one copy
 * beside the glyph a grey ghost is left at the original spot.
 *
 * For print we drop the redundant `rating` and keep the `label`, which already
 * carries the value. (Dropping the `label` instead is wrong: schematex falls
 * back to rendering a literal "MCB" placeholder as the node name.)
 *
 * Only lines where the two values are literally identical are touched, so the
 * floor / MDB / transformer breakers — whose label is a tag like "F1" rather
 * than an ampacity — keep both and are unaffected.
 */
export function stripDuplicateMcbLabels(dsl: string): string {
  return dsl
    .split('\n')
    .map((line) => {
      const m = line.match(
        /^(\s*\w+\s*=\s*mcb\s*\[)label:\s*"([^"]*)",\s*(rating:\s*"[^"]*")\s*\](\s*)$/
      );
      if (!m) return line;
      const [, head, label, , tail] = m;
      const ratingValue = m[3].match(/rating:\s*"([^"]*)"/)?.[1];
      if (ratingValue !== label) return line;
      return `${head}label: "${label}"]${tail}`;
    })
    .join('\n');
}

export function renderSldPage(page: SLDPage): SldRenderResult {
  const dsl = stripDuplicateMcbLabels(page.dsl);
  const result = renderResult(dsl);

  const diagnostics: string[] = [];
  const raw = result as unknown as {
    ok?: boolean;
    status?: string;
    diagnostics?: Array<{ severity?: string; message?: string }>;
  };
  if (raw.diagnostics?.length) {
    for (const d of raw.diagnostics) {
      const sev = d.severity ?? 'info';
      const msg = d.message ?? String(d);
      diagnostics.push(`${sev}: ${msg}`);
    }
  }

  const svg = render(dsl);
  if (!svg || !svg.includes('<svg')) {
    throw new Error(
      `schematex produced no SVG for SLD page "${page.title}" (status: ${raw.status ?? 'unknown'}). ${diagnostics.join('; ')}`
    );
  }
  return { svg, diagnostics };
}

/**
 * Browser-side post-processor for the print path.
 *
 * MUST stay fully self-contained — it is serialised with
 * `Function.prototype.toString()` and evaluated inside headless Chromium, so it
 * cannot close over anything from this module. That is why `extendCables` and
 * `repositionLabels` are inlined here as literal bodies rather than imported.
 *
 * Differences from the interactive version, both print-only:
 *  - labels are nudged up off the cable-tag row, which `repositionLabels` alone
 *    drops them onto (they sit at `rightX + 14`, exactly where the `Wf1a / 6 mm²`
 *    annotations are);
 *  - the extra headroom needed by that nudge is added to the viewBox.
 */
export function sldExportPostprocessBody(): string {
  return `
function __procalExtendCables(svg) {
  var allLines = svg.querySelectorAll('line');
  var allPaths = svg.querySelectorAll('path');
  var EXTRA = 80;
  var busLines = [];
  allLines.forEach(function (line) {
    var y1 = parseFloat(line.getAttribute('y1') || '0');
    var y2 = parseFloat(line.getAttribute('y2') || '0');
    var x1 = parseFloat(line.getAttribute('x1') || '0');
    var x2 = parseFloat(line.getAttribute('x2') || '0');
    if (y1 === y2 && Math.abs(x2 - x1) > 200) busLines.push(y1);
  });
  allLines.forEach(function (line) {
    var x1 = parseFloat(line.getAttribute('x1') || '0');
    var y1 = parseFloat(line.getAttribute('y1') || '0');
    var x2 = parseFloat(line.getAttribute('x2') || '0');
    var y2 = parseFloat(line.getAttribute('y2') || '0');
    if (x1 === x2 && y1 !== y2) {
      var topY = Math.min(y1, y2);
      var botY = Math.max(y1, y2);
      if (busLines.some(function (b) { return Math.abs(b - topY) < 5; }) && botY - topY < 100) {
        line.setAttribute('y2', String(botY + EXTRA));
      }
    }
  });
  allPaths.forEach(function (path) {
    var d = path.getAttribute('d') || '';
    var m = d.match(/^M\\s*([\\d.]+)\\s+([\\d.]+)\\s+L\\s*([\\d.]+)\\s+([\\d.]+)$/);
    if (m) {
      var x1 = Number(m[1]), y1 = Number(m[2]), x2 = Number(m[3]), y2 = Number(m[4]);
      if (x1 === x2 && Math.abs(y2 - y1) < 100) {
        var topY = Math.min(y1, y2);
        if (busLines.some(function (b) { return Math.abs(b - topY) < 5; })) {
          path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + Math.max(y1, y2) + EXTRA);
        }
      }
    }
  });
  var bbox = svg.getBBox();
  svg.setAttribute('viewBox', '0 0 ' + bbox.width + ' ' + (bbox.height + EXTRA * 2));
  svg.style.height = 'auto';
}

function __procalRepositionLabels(svg) {
  var texts = svg.querySelectorAll('text');
  if (texts.length === 0) return;
  var symbols = [];
  svg.querySelectorAll('line').forEach(function (line) {
    var x1 = parseFloat(line.getAttribute('x1') || '0');
    var y1 = parseFloat(line.getAttribute('y1') || '0');
    var x2 = parseFloat(line.getAttribute('x2') || '0');
    var y2 = parseFloat(line.getAttribute('y2') || '0');
    if (x1 !== x2 && y1 !== y2 && Math.abs(y2 - y1) > 5 && Math.abs(x2 - x1) > 5) {
      symbols.push({ cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rightX: Math.max(x1, x2) });
    }
  });
  if (symbols.length === 0) return;
  texts.forEach(function (text) {
    var bbox = text.getBBox();
    var tx = bbox.x + bbox.width / 2;
    var ty = bbox.y + bbox.height / 2;
    var content = text.textContent ? text.textContent.trim() : '';
    if (
      content.indexOf('Single Line') !== -1 ||
      content.indexOf('MDB Bus') !== -1 ||
      content.indexOf('Utility') !== -1 ||
      content.indexOf('400V') !== -1 ||
      content.indexOf('Sub-Panel') !== -1 ||
      content === 'DB'
    ) return;
    var nearest = null, minDist = Infinity;
    symbols.forEach(function (s) {
      var dx = Math.abs(tx - s.cx), dy = Math.abs(ty - s.cy);
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100 && dist < minDist) { minDist = dist; nearest = s; }
    });
    if (nearest) {
      // Print-only: lift the label clear of the cable-tag annotation row.
      text.setAttribute('x', String(nearest.rightX + 14));
      text.setAttribute('y', String(ty - 10));
      text.setAttribute('text-anchor', 'start');
    }
  });
}

function __procalProcessSheets() {
  var out = [];
  document.querySelectorAll('[data-sld-sheet] svg').forEach(function (svg, i) {
    __procalExtendCables(svg);
    __procalRepositionLabels(svg);
    var bbox = svg.getBBox();
    // Extra headroom so the lifted labels are not clipped by the viewBox.
    svg.setAttribute('viewBox', '0 0 ' + bbox.width + ' ' + (bbox.height + 30));
    out.push({ index: i, viewBox: svg.getAttribute('viewBox') });
  });
  return out;
}
`;
}
