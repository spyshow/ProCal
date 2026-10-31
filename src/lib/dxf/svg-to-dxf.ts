import {
  DxfWriter,
  Units,
  Colors,
  LWPolylineFlags,
  TextHorizontalAlignment,
  TextVerticalAlignment,
  point2d,
  point3d,
} from '@tarikjabiri/dxf';

export type CadLayerName =
  | 'E-SLD-BUS'
  | 'E-SLD-BRKR'
  | 'E-SLD-CABL'
  | 'E-SLD-SYMB'
  | 'E-SLD-TEXT'
  | 'E-SLD-BORD'
  | 'E-SLD-WARN';

export interface DxfExportOptions {
  /** Reject export if project is in Free Trial mode */
  isTrial?: boolean;
  /** Optional project/drawing title metadata */
  title?: string;
  /** Override canvas height used for Y-axis inversion (y_cad = height - y_svg) */
  canvasHeight?: number;
  /** Number of segments used when tessellating curves/arcs in <path> (default: 12) */
  curveSegments?: number;
  /** Skip internal .lt-sld-title text when outer CAD sheet frame already renders the title */
  skipInternalTitle?: boolean;
  /** Number of sheets per row in multi-sheet grid layout (default: 4) */
  sheetsPerRow?: number;
}

export interface DxfSheetElementInput {
  title: string;
  subtitle?: string;
  svgEl: Element;
}

export interface DxfSheetStringInput {
  title: string;
  subtitle?: string;
  svgMarkup: string;
}

export const CAD_LAYERS: ReadonlyArray<{
  name: CadLayerName;
  color: number;
  description: string;
}> = [
  { name: 'E-SLD-BUS', color: Colors.Yellow, description: 'Main & Sub-Distribution Busbars' },
  { name: 'E-SLD-BRKR', color: Colors.Cyan, description: 'Circuit Breakers & Protective Devices' },
  { name: 'E-SLD-CABL', color: Colors.Green, description: 'Feeder & Branch Circuit Cables' },
  { name: 'E-SLD-SYMB', color: Colors.Magenta, description: 'Transformers, Earthing & Electrical Symbols' },
  { name: 'E-SLD-TEXT', color: Colors.White, description: 'Annotations, Ratings & Schedule Text' },
  { name: 'E-SLD-BORD', color: Colors.Blue, description: 'Enclosures, Panels & Sheet Borders' },
  { name: 'E-SLD-WARN', color: Colors.Red, description: 'Warning / Overload / High Voltage Drop Indicators' },
];

/** 2D affine matrix [a, b, c, d, e, f] representing:
 *  x' = a*x + c*y + e
 *  y' = b*x + d*y + f
 */
export type Matrix2D = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

export function multiplyMatrix2D(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMatrix2D(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

export function getMatrixScale(m: Matrix2D): number {
  return Math.hypot(m[0], m[1]) || 1;
}

/**
 * Parse an SVG transform attribute string into a 2D affine matrix.
 * Supports translate, scale, rotate, and matrix transforms.
 */
export function parseSvgTransform(transformStr: string | null | undefined): Matrix2D {
  if (!transformStr || !transformStr.trim()) return IDENTITY_MATRIX;

  let current: Matrix2D = IDENTITY_MATRIX;
  const regex = /(matrix|translate|scale|rotate)\s*\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(transformStr)) !== null) {
    const fn = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));

    let next: Matrix2D = IDENTITY_MATRIX;
    if (fn === 'translate') {
      const tx = args[0] ?? 0;
      const ty = args[1] ?? 0;
      next = [1, 0, 0, 1, tx, ty];
    } else if (fn === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (fn === 'rotate') {
      const deg = args[0] ?? 0;
      const cx = args[1] ?? 0;
      const cy = args[2] ?? 0;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (cx !== 0 || cy !== 0) {
        next = multiplyMatrix2D(
          multiplyMatrix2D([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
          [1, 0, 0, 1, -cx, -cy]
        );
      } else {
        next = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'matrix' && args.length >= 6) {
      next = [args[0], args[1], args[2], args[3], args[4], args[5]];
    }

    current = multiplyMatrix2D(current, next);
  }

  return current;
}

function getNumAttr(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveGroupLayer(el: Element, inherited?: CadLayerName): CadLayerName | undefined {
  const explicitLayer = el.getAttribute('data-cad-layer') || el.getAttribute('data-layer');
  if (
    explicitLayer === 'E-SLD-BUS' ||
    explicitLayer === 'E-SLD-BRKR' ||
    explicitLayer === 'E-SLD-CABL' ||
    explicitLayer === 'E-SLD-SYMB' ||
    explicitLayer === 'E-SLD-TEXT' ||
    explicitLayer === 'E-SLD-BORD' ||
    explicitLayer === 'E-SLD-WARN'
  ) {
    return explicitLayer;
  }

  const dataType = (el.getAttribute('data-type') || '').toLowerCase();
  if (dataType === 'breaker' || dataType === 'mcb' || dataType === 'acb' || dataType === 'mccb') {
    return 'E-SLD-BRKR';
  }
  if (
    dataType === 'load' ||
    dataType === 'transformer' ||
    dataType === 'transformer_dy' ||
    dataType === 'utility' ||
    dataType === 'generator'
  ) {
    return 'E-SLD-SYMB';
  }
  if (dataType === 'bus' || dataType === 'distribution_board') {
    return 'E-SLD-BUS';
  }

  return inherited;
}

function classifyLayer(
  el: Element,
  tagName: string,
  inheritedLayer?: CadLayerName
): CadLayerName {
  if (tagName === 'text' || tagName === 'tspan') {
    return 'E-SLD-TEXT';
  }

  const groupLayer = resolveGroupLayer(el, inheritedLayer);
  if (groupLayer) {
    return groupLayer;
  }

  const stroke = (el.getAttribute('stroke') || '').toLowerCase();
  const fill = (el.getAttribute('fill') || '').toLowerCase();
  const className = (el.getAttribute('class') || '').toLowerCase();
  const strokeWidth = getNumAttr(el, 'stroke-width', 1);

  if (
    stroke.includes('#ef4444') ||
    stroke.includes('#dc2626') ||
    fill.includes('#ef4444') ||
    className.includes('red') ||
    className.includes('danger')
  ) {
    return 'E-SLD-WARN';
  }

  if (className.includes('lt-sld-bus')) {
    return 'E-SLD-BUS';
  }
  if (className.includes('lt-sld-wire')) {
    return 'E-SLD-CABL';
  }

  if (tagName === 'line') {
    const x1 = getNumAttr(el, 'x1');
    const y1 = getNumAttr(el, 'y1');
    const x2 = getNumAttr(el, 'x2');
    const y2 = getNumAttr(el, 'y2');
    const isHorizontal = Math.abs(y1 - y2) < 0.5 && Math.abs(x2 - x1) >= 20;
    if (strokeWidth >= 3 && (isHorizontal || stroke.includes('#f97316') || stroke.includes('#fb923c'))) {
      return 'E-SLD-BUS';
    }
    return 'E-SLD-CABL';
  }

  if (tagName === 'rect') {
    const w = getNumAttr(el, 'width');
    const h = getNumAttr(el, 'height');
    if (h > 0 && h <= 6 && w >= 40) {
      return 'E-SLD-BUS';
    }
    if (w >= 45 || h >= 45) {
      return 'E-SLD-BORD';
    }
    return 'E-SLD-BRKR';
  }

  if (tagName === 'circle' || tagName === 'ellipse') {
    const r = getNumAttr(el, 'r', getNumAttr(el, 'rx', 5));
    if (r >= 8) {
      return 'E-SLD-SYMB';
    }
    return 'E-SLD-BRKR';
  }

  if (tagName === 'path') {
    if (strokeWidth >= 3) return 'E-SLD-BUS';
    return 'E-SLD-CABL';
  }

  return 'E-SLD-CABL';
}

function cubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

function quadBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * Sample an SVG elliptical arc (A/a command) into polyline points per SVG 1.1 F.6.5.
 */
function sampleSvgArc(
  x1: number,
  y1: number,
  rxInput: number,
  ryInput: number,
  phiDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number,
  segments: number
): Array<{ x: number; y: number }> {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
    return [{ x: x2, y: y2 }];
  }

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;

  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const coef = den === 0 ? 0 : sign * Math.sqrt(num / den);

  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const vectorAngle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const cos = len === 0 ? 1 : Math.min(1, Math.max(-1, dot / len));
    const angle = Math.acos(cos);
    return ux * vy - uy * vx < 0 ? -angle : angle;
  };

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (sweepFlag === 0 && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  } else if (sweepFlag === 1 && dTheta < 0) {
    dTheta += 2 * Math.PI;
  }

  const pts: Array<{ x: number; y: number }> = [];
  const steps = Math.max(4, segments);
  for (let i = 1; i <= steps; i++) {
    const theta = theta1 + (dTheta * i) / steps;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    pts.push({
      x: cosPhi * rx * cosT - sinPhi * ry * sinT + cx,
      y: sinPhi * rx * cosT + cosPhi * ry * sinT + cy,
    });
  }
  return pts;
}

export interface ParsedSubpath {
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

/**
 * Parse an SVG <path d="..."> attribute into one or more polyline subpaths.
 */
export function parseSvgPathData(d: string, curveSegments = 12): ParsedSubpath[] {
  const subpaths: ParsedSubpath[] = [];
  if (!d || !d.trim()) return subpaths;

  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tokens) return subpaths;

  let i = 0;
  let cmd = '';
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let currentSubpath: ParsedSubpath | null = null;

  const ensureSubpath = () => {
    if (!currentSubpath) {
      currentSubpath = { points: [{ x: curX, y: curY }], closed: false };
      subpaths.push(currentSubpath);
    }
    return currentSubpath;
  };

  const isCommand = (tok: string) => /^[a-zA-Z]$/.test(tok);
  const nextNum = (): number => {
    if (i >= tokens.length) return 0;
    const val = parseFloat(tokens[i++]);
    return Number.isFinite(val) ? val : 0;
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      cmd = tokens[i++];
    } else if (!cmd) {
      break;
    }

    switch (cmd) {
      case 'M':
      case 'm': {
        const dx = nextNum();
        const dy = nextNum();
        curX = cmd === 'm' ? curX + dx : dx;
        curY = cmd === 'm' ? curY + dy : dy;
        startX = curX;
        startY = curY;
        currentSubpath = { points: [{ x: curX, y: curY }], closed: false };
        subpaths.push(currentSubpath);
        prevCtrlX = curX;
        prevCtrlY = curY;
        cmd = cmd === 'm' ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'l': {
        const dx = nextNum();
        const dy = nextNum();
        curX = cmd === 'l' ? curX + dx : dx;
        curY = cmd === 'l' ? curY + dy : dy;
        ensureSubpath().points.push({ x: curX, y: curY });
        prevCtrlX = curX;
        prevCtrlY = curY;
        break;
      }
      case 'H':
      case 'h': {
        const dx = nextNum();
        curX = cmd === 'h' ? curX + dx : dx;
        ensureSubpath().points.push({ x: curX, y: curY });
        prevCtrlX = curX;
        prevCtrlY = curY;
        break;
      }
      case 'V':
      case 'v': {
        const dy = nextNum();
        curY = cmd === 'v' ? curY + dy : dy;
        ensureSubpath().points.push({ x: curX, y: curY });
        prevCtrlX = curX;
        prevCtrlY = curY;
        break;
      }
      case 'C':
      case 'c': {
        const x1 = cmd === 'c' ? curX + nextNum() : nextNum();
        const y1 = cmd === 'c' ? curY + nextNum() : nextNum();
        const x2 = cmd === 'c' ? curX + nextNum() : nextNum();
        const y2 = cmd === 'c' ? curY + nextNum() : nextNum();
        const x = cmd === 'c' ? curX + nextNum() : nextNum();
        const y = cmd === 'c' ? curY + nextNum() : nextNum();
        const sub = ensureSubpath();
        const p0 = { x: curX, y: curY };
        const p1 = { x: x1, y: y1 };
        const p2 = { x: x2, y: y2 };
        const p3 = { x, y };
        for (let s = 1; s <= curveSegments; s++) {
          sub.points.push(cubicBezier(p0, p1, p2, p3, s / curveSegments));
        }
        prevCtrlX = x2;
        prevCtrlY = y2;
        curX = x;
        curY = y;
        break;
      }
      case 'S':
      case 's': {
        const x1 = 2 * curX - prevCtrlX;
        const y1 = 2 * curY - prevCtrlY;
        const x2 = cmd === 's' ? curX + nextNum() : nextNum();
        const y2 = cmd === 's' ? curY + nextNum() : nextNum();
        const x = cmd === 's' ? curX + nextNum() : nextNum();
        const y = cmd === 's' ? curY + nextNum() : nextNum();
        const sub = ensureSubpath();
        const p0 = { x: curX, y: curY };
        const p1 = { x: x1, y: y1 };
        const p2 = { x: x2, y: y2 };
        const p3 = { x, y };
        for (let s = 1; s <= curveSegments; s++) {
          sub.points.push(cubicBezier(p0, p1, p2, p3, s / curveSegments));
        }
        prevCtrlX = x2;
        prevCtrlY = y2;
        curX = x;
        curY = y;
        break;
      }
      case 'Q':
      case 'q': {
        const x1 = cmd === 'q' ? curX + nextNum() : nextNum();
        const y1 = cmd === 'q' ? curY + nextNum() : nextNum();
        const x = cmd === 'q' ? curX + nextNum() : nextNum();
        const y = cmd === 'q' ? curY + nextNum() : nextNum();
        const sub = ensureSubpath();
        const p0 = { x: curX, y: curY };
        const p1 = { x: x1, y: y1 };
        const p2 = { x, y };
        for (let s = 1; s <= curveSegments; s++) {
          sub.points.push(quadBezier(p0, p1, p2, s / curveSegments));
        }
        prevCtrlX = x1;
        prevCtrlY = y1;
        curX = x;
        curY = y;
        break;
      }
      case 'T':
      case 't': {
        const x1 = 2 * curX - prevCtrlX;
        const y1 = 2 * curY - prevCtrlY;
        const x = cmd === 't' ? curX + nextNum() : nextNum();
        const y = cmd === 't' ? curY + nextNum() : nextNum();
        const sub = ensureSubpath();
        const p0 = { x: curX, y: curY };
        const p1 = { x: x1, y: y1 };
        const p2 = { x, y };
        for (let s = 1; s <= curveSegments; s++) {
          sub.points.push(quadBezier(p0, p1, p2, s / curveSegments));
        }
        prevCtrlX = x1;
        prevCtrlY = y1;
        curX = x;
        curY = y;
        break;
      }
      case 'A':
      case 'a': {
        const rx = nextNum();
        const ry = nextNum();
        const xAxisRotation = nextNum();
        const largeArcFlag = nextNum();
        const sweepFlag = nextNum();
        const x = cmd === 'a' ? curX + nextNum() : nextNum();
        const y = cmd === 'a' ? curY + nextNum() : nextNum();
        const sub = ensureSubpath();
        const arcPts = sampleSvgArc(
          curX,
          curY,
          rx,
          ry,
          xAxisRotation,
          largeArcFlag,
          sweepFlag,
          x,
          y,
          curveSegments
        );
        sub.points.push(...arcPts);
        curX = x;
        curY = y;
        prevCtrlX = curX;
        prevCtrlY = curY;
        break;
      }
      case 'Z':
      case 'z': {
        if (currentSubpath) {
          currentSubpath.closed = true;
        }
        curX = startX;
        curY = startY;
        prevCtrlX = curX;
        prevCtrlY = curY;
        cmd = '';
        break;
      }
      default: {
        i++;
        break;
      }
    }
  }

  return subpaths;
}

function normalizeCadText(raw: string): string {
  return raw
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u00b7/g, '.')
    .replace(/\u00b2/g, '2')
    .replace(/\u03a9/g, 'Ohm')
    .replace(/\u0394/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePointPairs(pointsAttr: string): Array<{ x: number; y: number }> {
  const nums = pointsAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

function resolveCanvasDimensions(
  svgEl: Element,
  overrideHeight?: number
): { width: number; height: number } {
  const wAttr = getNumAttr(svgEl, 'width', 0);
  const hAttr = getNumAttr(svgEl, 'height', 0);

  let width = wAttr > 100 ? wAttr : 1200;
  let height = hAttr > 100 ? hAttr : 1000;

  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4) {
      // Only trust viewBox dimensions if they were not clobbered by a 0x0 detached getBBox()
      if (Number.isFinite(parts[2]) && parts[2] > 100) {
        width = Math.max(wAttr, parts[2]);
      }
      if (Number.isFinite(parts[3]) && parts[3] > 200) {
        height = Math.max(hAttr, parts[3]);
      }
    }
  }

  if (overrideHeight && Number.isFinite(overrideHeight) && overrideHeight > 0) {
    height = overrideHeight;
  }

  return { width, height };
}

function createInitializedDxfWriter(): DxfWriter {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  for (const layer of CAD_LAYERS) {
    dxf.addLayer(layer.name, layer.color, 'Continuous');
  }
  return dxf;
}

interface SheetBounds {
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function collectDuplicateIdLabelsToSkip(svgEl: Element): Set<Element> {
  const toSkip = new Set<Element>();
  const idTexts = Array.from(svgEl.querySelectorAll('text.lt-sld-id'));
  const ratingTexts = Array.from(svgEl.querySelectorAll('text.lt-sld-rating'));

  for (const idEl of idTexts) {
    const idVal = (idEl.textContent || '').trim();
    const idX = getNumAttr(idEl, 'x');
    const idY = getNumAttr(idEl, 'y');
    if (!idVal) continue;

    // When an MCB has identical .lt-sld-id (at y=300) and .lt-sld-rating (at y=372) on the same X column,
    // skip the upper .lt-sld-id so it does not collide with the cable size label (at y=291).
    const hasMatchingRating = ratingTexts.some((rEl) => {
      const rVal = (rEl.textContent || '').trim();
      const rX = getNumAttr(rEl, 'x');
      const rY = getNumAttr(rEl, 'y');
      return rVal === idVal && Math.abs(rX - idX) < 6 && Math.abs(rY - idY) > 10 && Math.abs(rY - idY) < 95;
    });

    if (hasMatchingRating) {
      toSkip.add(idEl);
    }
  }

  return toSkip;
}

function appendSvgElementToDxf(
  dxf: DxfWriter,
  svgEl: Element,
  offset: { x: number; y: number },
  options?: DxfExportOptions
): SheetBounds {
  const { width: canvasWidth, height: canvasHeight } = resolveCanvasDimensions(
    svgEl,
    options?.canvasHeight
  );
  const curveSegments = options?.curveSegments ?? 12;
  const skipDuplicateTexts = collectDuplicateIdLabelsToSkip(svgEl);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const trackPoint = (localX: number, localY: number) => {
    if (localX < minX) minX = localX;
    if (localX > maxX) maxX = localX;
    if (localY < minY) minY = localY;
    if (localY > maxY) maxY = localY;
  };

  const toCadPoint2D = (m: Matrix2D, x: number, y: number) => {
    const pt = applyMatrix2D(m, x, y);
    const localCadX = pt.x;
    const localCadY = canvasHeight - pt.y;
    trackPoint(localCadX, localCadY);
    return point2d(
      Number((offset.x + localCadX).toFixed(4)),
      Number((offset.y + localCadY).toFixed(4))
    );
  };

  const toCadPoint3D = (m: Matrix2D, x: number, y: number) => {
    const pt = applyMatrix2D(m, x, y);
    const localCadX = pt.x;
    const localCadY = canvasHeight - pt.y;
    trackPoint(localCadX, localCadY);
    return point3d(
      Number((offset.x + localCadX).toFixed(4)),
      Number((offset.y + localCadY).toFixed(4)),
      0
    );
  };

  const resolveTextFormatting = (
    el: Element,
    rawText: string,
    x: number,
    y: number
  ): {
    fontSize: number;
    anchor: string | null;
    adjustedX: number;
    adjustedY: number;
  } => {
    const className = (el.getAttribute('class') || '').toLowerCase();
    const explicitAnchor = el.getAttribute('text-anchor');
    const explicitFontSize = el.hasAttribute('font-size')
      ? getNumAttr(el, 'font-size', 9)
      : null;

    if (className.includes('lt-sld-title')) {
      return {
        fontSize: explicitFontSize ?? 11,
        anchor: explicitAnchor || 'start',
        adjustedX: x,
        adjustedY: y,
      };
    }

    if (className.includes('lt-sld-bus-label')) {
      return {
        fontSize: explicitFontSize ?? 8.5,
        anchor: explicitAnchor || 'start',
        adjustedX: x,
        adjustedY: y - 2,
      };
    }

    if (className.includes('lt-sld-cable')) {
      const isCableTag = /^Wf\d+[a-z]$/i.test(rawText.trim());
      return {
        fontSize: explicitFontSize ?? 6.5,
        anchor: 'middle',
        adjustedX: x,
        // Nudge cable tag slightly above the horizontal feeder line and cable size cleanly below it
        adjustedY: isCableTag ? y - 5 : y + 4,
      };
    }

    if (className.includes('lt-sld-id')) {
      return {
        fontSize: explicitFontSize ?? 8,
        anchor: explicitAnchor || 'middle',
        adjustedX: x,
        adjustedY: y,
      };
    }

    if (className.includes('lt-sld-rating')) {
      return {
        fontSize: explicitFontSize ?? 7.5,
        anchor: explicitAnchor || 'middle',
        adjustedX: x,
        adjustedY: y + 2,
      };
    }

    return {
      fontSize: explicitFontSize ?? 9,
      anchor: explicitAnchor,
      adjustedX: x,
      adjustedY: y,
    };
  };

  const emitText = (
    el: Element,
    m: Matrix2D,
    textValue: string,
    x: number,
    y: number
  ) => {
    const cleaned = normalizeCadText(textValue);
    if (!cleaned || cleaned === '-') return;

    const { fontSize, anchor, adjustedX, adjustedY } = resolveTextFormatting(
      el,
      cleaned,
      x,
      y
    );

    const scale = getMatrixScale(m);
    const height = Math.max(2, Number((fontSize * scale * 0.65).toFixed(2)));
    const pos = toCadPoint3D(m, adjustedX, adjustedY);

    const estTextWidth = cleaned.length * height * 0.75;
    const pt = applyMatrix2D(m, adjustedX, adjustedY);
    if (anchor === 'middle') {
      trackPoint(pt.x - estTextWidth / 2, canvasHeight - pt.y);
      trackPoint(pt.x + estTextWidth / 2, canvasHeight - pt.y + height);
    } else if (anchor === 'end') {
      trackPoint(pt.x - estTextWidth, canvasHeight - pt.y);
    } else {
      trackPoint(pt.x + estTextWidth, canvasHeight - pt.y + height);
    }

    const angleRad = Math.atan2(-m[1], m[0]);
    const rotationDeg = Number(((angleRad * 180) / Math.PI).toFixed(2));

    let horizontalAlignment = TextHorizontalAlignment.Left;
    if (anchor === 'middle') {
      horizontalAlignment = TextHorizontalAlignment.Center;
    } else if (anchor === 'end') {
      horizontalAlignment = TextHorizontalAlignment.Right;
    }

    dxf.addText(pos, height, cleaned, {
      layerName: 'E-SLD-TEXT',
      rotation: rotationDeg,
      horizontalAlignment,
      verticalAlignment: TextVerticalAlignment.BaseLine,
      secondAlignmentPoint: pos,
    });
  };

  const walk = (
    node: Element,
    parentMatrix: Matrix2D,
    inheritedLayer?: CadLayerName
  ) => {
    const tag = node.tagName.toLowerCase();

    if (
      tag === 'defs' ||
      tag === 'pattern' ||
      tag === 'clippath' ||
      tag === 'mask' ||
      tag === 'style' ||
      tag === 'script' ||
      tag === 'title' ||
      tag === 'desc'
    ) {
      return;
    }

    if (
      node.getAttribute('display') === 'none' ||
      node.getAttribute('visibility') === 'hidden' ||
      node.getAttribute('opacity') === '0'
    ) {
      return;
    }

    const className = (node.getAttribute('class') || '').toLowerCase();
    // Skip Schematex zebra background bands & redundant band voltage labels
    if (
      className.includes('lt-sld-band-odd') ||
      className.includes('lt-sld-band-even') ||
      className.includes('lt-sld-band-label')
    ) {
      return;
    }

    if (options?.skipInternalTitle && className.includes('lt-sld-title')) {
      return;
    }

    if (skipDuplicateTexts.has(node)) {
      return;
    }

    const localMatrix = parseSvgTransform(node.getAttribute('transform'));
    const matrix = multiplyMatrix2D(parentMatrix, localMatrix);
    const nextInheritedLayer = resolveGroupLayer(node, inheritedLayer);
    const layerName = classifyLayer(node, tag, nextInheritedLayer);

    switch (tag) {
      case 'svg':
      case 'g':
      case 'a': {
        for (let i = 0; i < node.children.length; i++) {
          walk(node.children[i], matrix, nextInheritedLayer);
        }
        break;
      }

      case 'line': {
        const x1 = getNumAttr(node, 'x1');
        const y1 = getNumAttr(node, 'y1');
        const x2 = getNumAttr(node, 'x2');
        const y2 = getNumAttr(node, 'y2');
        const p1 = toCadPoint3D(matrix, x1, y1);
        const p2 = toCadPoint3D(matrix, x2, y2);
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1e-4) {
          dxf.addLine(p1, p2, { layerName });
        }
        break;
      }

      case 'rect': {
        const fill = (node.getAttribute('fill') || '').toLowerCase();
        if (fill.startsWith('url(#grid')) {
          break;
        }
        const x = getNumAttr(node, 'x');
        const y = getNumAttr(node, 'y');
        const w = getNumAttr(node, 'width');
        const h = getNumAttr(node, 'height');
        if (w <= 0 || h <= 0) break;

        const corners = [
          { point: toCadPoint2D(matrix, x, y) },
          { point: toCadPoint2D(matrix, x + w, y) },
          { point: toCadPoint2D(matrix, x + w, y + h) },
          { point: toCadPoint2D(matrix, x, y + h) },
        ];
        dxf.addLWPolyline(corners, {
          layerName,
          flags: LWPolylineFlags.Closed,
        });
        break;
      }

      case 'circle': {
        const cx = getNumAttr(node, 'cx');
        const cy = getNumAttr(node, 'cy');
        const r = getNumAttr(node, 'r');
        if (r <= 0) break;
        const center = toCadPoint3D(matrix, cx, cy);
        const scaledR = Number((r * getMatrixScale(matrix)).toFixed(4));
        dxf.addCircle(center, scaledR, { layerName });
        break;
      }

      case 'ellipse': {
        const cx = getNumAttr(node, 'cx');
        const cy = getNumAttr(node, 'cy');
        const rx = getNumAttr(node, 'rx');
        const ry = getNumAttr(node, 'ry');
        if (rx <= 0 || ry <= 0) break;
        const center = toCadPoint3D(matrix, cx, cy);
        const scale = getMatrixScale(matrix);
        if (Math.abs(rx - ry) < 1e-4) {
          dxf.addCircle(center, Number((rx * scale).toFixed(4)), { layerName });
        } else {
          const majorIsX = rx >= ry;
          const majorLen = (majorIsX ? rx : ry) * scale;
          const minorLen = (majorIsX ? ry : rx) * scale;
          const ratio = Number((minorLen / majorLen).toFixed(4));
          const majorVec = majorIsX
            ? point3d(Number(majorLen.toFixed(4)), 0, 0)
            : point3d(0, Number(majorLen.toFixed(4)), 0);
          dxf.addEllipse(center, majorVec, ratio, 0, Math.PI * 2, { layerName });
        }
        break;
      }

      case 'polyline':
      case 'polygon': {
        const pointsAttr = node.getAttribute('points') || '';
        const rawPoints = parsePointPairs(pointsAttr);
        if (rawPoints.length < 2) break;
        const vertices = rawPoints.map((p) => ({
          point: toCadPoint2D(matrix, p.x, p.y),
        }));
        dxf.addLWPolyline(vertices, {
          layerName,
          flags: tag === 'polygon' ? LWPolylineFlags.Closed : LWPolylineFlags.None,
        });
        break;
      }

      case 'path': {
        const d = node.getAttribute('d') || '';
        const subpaths = parseSvgPathData(d, curveSegments);
        for (const sub of subpaths) {
          if (sub.points.length < 2) continue;
          if (sub.points.length === 2 && !sub.closed) {
            const p1 = toCadPoint3D(matrix, sub.points[0].x, sub.points[0].y);
            const p2 = toCadPoint3D(matrix, sub.points[1].x, sub.points[1].y);
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1e-4) {
              dxf.addLine(p1, p2, { layerName });
            }
          } else {
            const vertices = sub.points.map((p) => ({
              point: toCadPoint2D(matrix, p.x, p.y),
            }));
            dxf.addLWPolyline(vertices, {
              layerName,
              flags: sub.closed ? LWPolylineFlags.Closed : LWPolylineFlags.None,
            });
          }
        }
        break;
      }

      case 'text': {
        const baseX = getNumAttr(node, 'x');
        const baseY = getNumAttr(node, 'y');

        const tspans = Array.from(node.children).filter(
          (c) => c.tagName.toLowerCase() === 'tspan'
        );

        if (tspans.length === 0) {
          emitText(node, matrix, node.textContent || '', baseX, baseY);
        } else {
          let curY = baseY;
          for (const tspan of tspans) {
            const tx = tspan.hasAttribute('x') ? getNumAttr(tspan, 'x', baseX) : baseX;
            const dy = getNumAttr(tspan, 'dy', 0);
            curY = tspan.hasAttribute('y') ? getNumAttr(tspan, 'y', curY) : curY + dy;
            emitText(tspan, matrix, tspan.textContent || '', tx, curY);
          }
        }
        break;
      }

      default: {
        for (let i = 0; i < node.children.length; i++) {
          walk(node.children[i], matrix, nextInheritedLayer);
        }
        break;
      }
    }
  };

  walk(svgEl, IDENTITY_MATRIX, undefined);

  return {
    width: canvasWidth,
    height: canvasHeight,
    minX: Number.isFinite(minX) ? minX : 0,
    maxX: Number.isFinite(maxX) ? maxX : canvasWidth,
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : canvasHeight,
  };
}

/**
 * Convert an in-DOM SVGSVGElement (or parsed Element) into an AutoCAD ASCII DXF string.
 */
export function convertSvgElementToDxf(
  svgEl: Element,
  options?: DxfExportOptions
): string {
  if (options?.isTrial) {
    throw new Error(
      'AutoCAD DXF export is locked on Free Trial projects. Upgrade project to unlock CAD exports.'
    );
  }

  const dxf = createInitializedDxfWriter();
  appendSvgElementToDxf(dxf, svgEl, { x: 0, y: 0 }, options);
  return dxf.stringify();
}

/**
 * Parse an SVG markup string using DOMParser and convert it into an AutoCAD ASCII DXF string.
 */
export function convertSvgStringToDxf(
  svgMarkup: string,
  options?: DxfExportOptions
): string {
  if (options?.isTrial) {
    throw new Error(
      'AutoCAD DXF export is locked on Free Trial projects. Upgrade project to unlock CAD exports.'
    );
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('Invalid SVG markup: no root <svg> element found.');
  }
  return convertSvgElementToDxf(svgEl, options);
}

/**
 * Combine multiple SLD SVG elements into a single AutoCAD ASCII DXF file,
 * arranging each drawing sheet in a clean, non-overlapping ModelSpace grid with CAD title blocks.
 */
export function convertMultipleSvgElementsToDxf(
  sheets: DxfSheetElementInput[],
  options?: DxfExportOptions
): string {
  if (options?.isTrial) {
    throw new Error(
      'AutoCAD DXF export is locked on Free Trial projects. Upgrade project to unlock CAD exports.'
    );
  }
  if (!sheets || sheets.length === 0) {
    throw new Error('No SLD sheets provided for multi-sheet DXF export.');
  }

  const dxf = createInitializedDxfWriter();
  const sheetsPerRow = Math.max(1, options?.sheetsPerRow ?? 4);
  const colGap = 160;
  const rowGap = 200;
  const borderPad = 32;
  const headerBandHeight = 44;

  let currentOffsetX = 0;
  let currentOffsetY = 0;
  let rowMaxHeight = 0;

  sheets.forEach((sheet, idx) => {
    const colIdx = idx % sheetsPerRow;
    if (colIdx === 0 && idx > 0) {
      currentOffsetX = 0;
      currentOffsetY -= rowMaxHeight + rowGap;
      rowMaxHeight = 0;
    }

    const cleanTitle = normalizeCadText(
      `DRAWING ${String(idx + 1).padStart(2, '0')}/${String(sheets.length).padStart(2, '0')} - ${sheet.title}`
    );
    const cleanSub = sheet.subtitle ? normalizeCadText(sheet.subtitle) : '';

    const rawDims = resolveCanvasDimensions(sheet.svgEl, options?.canvasHeight);
    const titleCharWidth = 7 * 0.72;
    const subCharWidth = 5.5 * 0.72;
    const minTitleBoxWidth = Math.ceil(
      Math.max(cleanTitle.length * titleCharWidth, cleanSub.length * subCharWidth) + 48
    );

    const preliminaryFrameWidth = Math.max(rawDims.width, minTitleBoxWidth, 520);
    // Center narrower diagrams horizontally within the sheet frame
    const diagramInsetX = Math.max(0, Math.round((preliminaryFrameWidth - rawDims.width) / 2));

    const bounds = appendSvgElementToDxf(
      dxf,
      sheet.svgEl,
      { x: currentOffsetX + diagramInsetX, y: currentOffsetY },
      { ...options, skipInternalTitle: true }
    );

    const actualContentRight = Math.max(
      rawDims.width + diagramInsetX,
      bounds.maxX + diagramInsetX + 20
    );
    const actualSheetWidth = Math.max(preliminaryFrameWidth, actualContentRight);
    const actualSheetHeight = Math.max(rawDims.height, bounds.maxY + 20);

    const frameLeft = currentOffsetX - borderPad;
    const frameRight = currentOffsetX + actualSheetWidth + borderPad;
    const frameBottom = currentOffsetY - borderPad;
    const frameTop = currentOffsetY + actualSheetHeight + borderPad + headerBandHeight;
    const headerDividerY = currentOffsetY + actualSheetHeight + borderPad;

    // Outer CAD Sheet Frame on E-SLD-BORD
    dxf.addLWPolyline(
      [
        { point: point2d(frameLeft, frameBottom) },
        { point: point2d(frameRight, frameBottom) },
        { point: point2d(frameRight, frameTop) },
        { point: point2d(frameLeft, frameTop) },
      ],
      {
        layerName: 'E-SLD-BORD',
        flags: LWPolylineFlags.Closed,
      }
    );

    // Header band divider line
    dxf.addLine(
      point3d(frameLeft, headerDividerY, 0),
      point3d(frameRight, headerDividerY, 0),
      { layerName: 'E-SLD-BORD' }
    );

    // Sheet Title & Drawing Index on E-SLD-TEXT
    dxf.addText(
      point3d(frameLeft + 16, headerDividerY + 24, 0),
      7,
      cleanTitle,
      { layerName: 'E-SLD-TEXT' }
    );

    if (cleanSub) {
      dxf.addText(
        point3d(frameLeft + 16, headerDividerY + 9, 0),
        5.5,
        cleanSub,
        { layerName: 'E-SLD-TEXT' }
      );
    }

    const totalFrameHeight = frameTop - frameBottom;
    if (totalFrameHeight > rowMaxHeight) {
      rowMaxHeight = totalFrameHeight;
    }

    currentOffsetX = frameRight + colGap;
  });

  return dxf.stringify();
}

/**
 * Combine multiple SVG markup strings into a single AutoCAD ASCII DXF file.
 */
export function convertMultipleSvgStringsToDxf(
  sheets: DxfSheetStringInput[],
  options?: DxfExportOptions
): string {
  if (options?.isTrial) {
    throw new Error(
      'AutoCAD DXF export is locked on Free Trial projects. Upgrade project to unlock CAD exports.'
    );
  }
  const parser = new DOMParser();
  const parsedSheets: DxfSheetElementInput[] = sheets.map((s, idx) => {
    const doc = parser.parseFromString(s.svgMarkup, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      throw new Error(`Invalid SVG markup in sheet ${idx + 1}: no root <svg> element found.`);
    }
    return {
      title: s.title,
      subtitle: s.subtitle,
      svgEl,
    };
  });

  return convertMultipleSvgElementsToDxf(parsedSheets, options);
}

/**
 * Trigger a browser download of a generated AutoCAD .dxf string.
 */
export function downloadDxfFile(dxfContent: string, filename: string): void {
  const safeName = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}
