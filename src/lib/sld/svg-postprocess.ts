/**
 * SLD SVG post-processors.
 *
 * These are pure DOM transforms on a rendered schematex SVG. They live in their
 * own module (rather than inside the SLD page component) for two reasons:
 *
 *  1. The interactive page and the server-side print path must produce identical
 *     geometry, so both call the same code.
 *  2. The server path runs them inside headless Chromium via
 *     `page.evaluate(fn.toString())`, which requires each function to be fully
 *     self-contained — no imports, no closure over module scope. If you edit
 *     these, keep them self-contained or the print path breaks.
 *
 * Originally inline in `src/app/(app)/sld/page.tsx`; moved verbatim in Task 4
 * Step 1. Behaviour is unchanged.
 */

/**
 * Stubs hanging off a bus are too short to read, so lengthen short verticals
 * that touch a bus line, then grow the viewBox to fit the extra room.
 */
export function extendCables(svg: SVGSVGElement) {
  const allLines = svg.querySelectorAll('line');
  const allPaths = svg.querySelectorAll('path');
  const EXTRA = 80;

  const busLines: number[] = [];
  allLines.forEach((line) => {
    const y1 = parseFloat(line.getAttribute('y1') || '0');
    const y2 = parseFloat(line.getAttribute('y2') || '0');
    const x1 = parseFloat(line.getAttribute('x1') || '0');
    const x2 = parseFloat(line.getAttribute('x2') || '0');
    if (y1 === y2 && Math.abs(x2 - x1) > 200) {
      busLines.push(y1);
    }
  });

  allLines.forEach((line) => {
    const x1 = parseFloat(line.getAttribute('x1') || '0');
    const y1 = parseFloat(line.getAttribute('y1') || '0');
    const x2 = parseFloat(line.getAttribute('x2') || '0');
    const y2 = parseFloat(line.getAttribute('y2') || '0');
    if (x1 === x2 && y1 !== y2) {
      const topY = Math.min(y1, y2);
      const botY = Math.max(y1, y2);
      if (busLines.some((b) => Math.abs(b - topY) < 5) && botY - topY < 100) {
        line.setAttribute('y2', String(botY + EXTRA));
      }
    }
  });

  allPaths.forEach((path) => {
    const d = path.getAttribute('d') || '';
    const match = d.match(/^M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)$/);
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number);
      if (x1 === x2 && Math.abs(y2 - y1) < 100) {
        const topY = Math.min(y1, y2);
        if (busLines.some((b) => Math.abs(b - topY) < 5)) {
          path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${Math.max(y1, y2) + EXTRA}`);
        }
      }
    }
  });

  const bbox = svg.getBBox();
  svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height + EXTRA * 2}`);
  svg.style.height = 'auto';
}

/**
 * Schematex centres device labels under the symbol; engineers expect the breaker
 * rating beside the symbol, so move each label to the right of its nearest
 * diagonal breaker glyph.
 */
export function repositionLabels(svg: SVGSVGElement) {
  const texts = svg.querySelectorAll('text');
  if (texts.length === 0) return;

  const mcbSymbols: { cx: number; cy: number; topY: number; botY: number; rightX: number }[] = [];
  svg.querySelectorAll('line').forEach((line) => {
    const x1 = parseFloat(line.getAttribute('x1') || '0');
    const y1 = parseFloat(line.getAttribute('y1') || '0');
    const x2 = parseFloat(line.getAttribute('x2') || '0');
    const y2 = parseFloat(line.getAttribute('y2') || '0');
    if (x1 !== x2 && y1 !== y2 && Math.abs(y2 - y1) > 5 && Math.abs(x2 - x1) > 5) {
      mcbSymbols.push({
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2,
        topY: Math.min(y1, y2),
        botY: Math.max(y1, y2),
        rightX: Math.max(x1, x2),
      });
    }
  });

  if (mcbSymbols.length === 0) return;

  texts.forEach((text) => {
    const bbox = text.getBBox();
    const tx = bbox.x + bbox.width / 2;
    const ty = bbox.y + bbox.height / 2;
    const content = text.textContent?.trim() || '';

    if (
      content.includes('Single Line') ||
      content.includes('MDB Bus') ||
      content.includes('Utility') ||
      content.includes('400V') ||
      content.includes('Sub-Panel') ||
      content === 'DB'
    )
      return;

    let nearestMCB: (typeof mcbSymbols)[0] | null = null;
    let minDist = Infinity;
    for (const mcb of mcbSymbols) {
      const dx = Math.abs(tx - mcb.cx);
      const dy = Math.abs(ty - mcb.cy);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100 && dist < minDist) {
        minDist = dist;
        nearestMCB = mcb;
      }
    }

    if (nearestMCB) {
      text.setAttribute('x', String(nearestMCB.rightX + 14));
      text.setAttribute('text-anchor', 'start');
    }
  });
}
