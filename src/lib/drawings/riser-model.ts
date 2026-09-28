import { formatCableSizeFor } from '@/lib/calculations/cables';
import { calculateThreePhaseCurrent, sizeTransformer } from '@/lib/calculations/loads';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { computeFeeders, type FindBreaker } from '@/lib/calculations/feeders';
import { computeFloorRiserVd, type RiserFloorVd } from '@/lib/calculations/riser';
import type { FloorDesign, Project } from '@/types';

/**
 * Pure geometry + engineering summary for one building's riser diagram.
 *
 * Lifted out of `src/app/(app)/riser/page.tsx` in Task 4 Step 2 so the identical
 * model can drive both the interactive page and the server-side print path.
 * Nothing here touches the DOM, i18next, or React.
 *
 * Every number is still derived from `src/lib/calculations/` — this module only
 * arranges what those pure functions already return.
 */

const ITEM_SPACING = 28;
const HEADER_HEIGHT = 100;
const FOOTER_HEIGHT = 220;
const MDB_HEIGHT = 72;
const SVG_WIDTH = 1100;
const BUS_X = 460;

export type RiserBand = 'ok' | 'warning' | 'danger' | 'nodata';

/** Texts that appear inside the drawing. English defaults; the page localises. */
export interface RiserLabels {
  title: string;
  floors: string;
  mdb: string;
  mainBus: string;
  floor: string;
  circuits: string;
  legend: string;
  normal: string;
  warning: string;
  danger: string;
  noData: string;
  iecNote: (totalLimit: number) => string;
  lvIncomer: string;
  transformer: string;
  subPanelPrefix: string;
}

export const DEFAULT_RISER_LABELS: RiserLabels = {
  title: 'RISER DIAGRAM',
  floors: 'Floors',
  mdb: 'MDB — Main Distribution Board',
  mainBus: 'MAIN BUS',
  floor: 'FL',
  circuits: 'apt feeders',
  legend: 'Legend',
  normal: 'Normal',
  warning: 'Warning',
  danger: 'Danger',
  noData: 'no data',
  iecNote: (totalLimit: number) =>
    `| IEC 60364: Sub-main <1%, Final <3%, Total <${totalLimit}%`,
  lvIncomer: 'LV Incomer',
  transformer: 'TR',
  subPanelPrefix: 'SDB',
};

export interface RiserCircuit {
  id: string;
  name: string;
  cableLabel: string;
  demandKw: number;
}

export interface RiserFloorModel extends Omit<FloorDesign, 'riserCableSize' | 'riserCableLength'>, RiserFloorVd {
  floorDemand: number;
  floorConnectedLoad: number;
  floorCurrent: number;
  floorKva: number;
  diversityPct: number;
  actualVoltage: number;
  isWarning: boolean;
  isDanger: boolean;
  /** Dynamic vertical extent so apartment stacks never clip or overlap. */
  height: number;
  /** Vertical centre line, stacked upward from the ground floor above the MDB. */
  cy: number;
  band: RiserBand;
  /** Apartment/circuit rows tapped off the floor rail, in draw order. */
  circuits: RiserCircuit[];
}

export interface RiserModel {
  projectName: string;
  project: Project;
  building: Project['buildings'][number];
  floors: RiserFloorModel[];
  layout: {
    svgWidth: number;
    svgHeight: number;
    busX: number;
    itemSpacing: number;
    headerHeight: number;
    footerHeight: number;
    mdbHeight: number;
  };
  /** Total path ΔV budget, taken from the project's power limit (default 5%). */
  totalVdLimit: number;
  mdb: {
    mainBreakerIn: number;
    settingsCategory: string;
    mainIncomerCurrent: number;
    mainCableLabel: string;
    mainParallelRuns: number;
  };
  transformer: {
    kva: number | null;
    impedance: number;
  };
  buildingTotal: {
    connectedLoadKw: number;
    demandKw: number;
    demandKva: number;
    current: number;
  };
}

export function riserBand(
  pct: number,
  limit: number,
  hasData: boolean
): RiserBand {
  if (!hasData) return 'nodata';
  if (pct > limit) return 'danger';
  if (pct > limit * 0.8) return 'warning';
  return 'ok';
}

export const RISER_BAND_COLOR: Record<RiserBand, string> = {
  nodata: '#6b7280',
  ok: '#3b82f6',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export function buildRiserModel(
  project: Project,
  buildingId: string | null,
  findBreaker: FindBreaker
): RiserModel | null {
  if (!project || !project.buildings || project.buildings.length === 0) return null;

  const bldg =
    project.buildings.find((b) => b.id === buildingId) || project.buildings[0];
  const sortedFloors = [...bldg.floorDesigns].sort(
    (a, b) => a.floorNumber - b.floorNumber
  );
  const feedersData = computeFeeders(
    bldg as never,
    project as never,
    findBreaker
  );

  const totalConnectedLoad = sortedFloors.reduce(
    (sum, fd) =>
      sum + fd.items.reduce((s, item) => s + (item.calculatedConnectedLoad || 0), 0),
    0
  );
  const totalDemandKw = sortedFloors.reduce(
    (sum, fd) => sum + fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0),
    0
  );

  const buildingLoadsDemandKw = (bldg.buildingLoads || []).reduce((sum, bl) => {
    const lib = bl.loadLibraryItem;
    if (!lib || lib.power <= 0 || bl.quantity <= 0) return sum;
    return sum + lib.power * bl.quantity;
  }, 0);

  const totalDemandKwWithBuildingLoads = totalDemandKw + buildingLoadsDemandKw;
  const totalDemandKva = totalDemandKwWithBuildingLoads / project.powerFactor;
  const totalCurrent = calculateThreePhaseCurrent(totalDemandKva, project.voltage);

  // NB: the page this was extracted from also ran a `sizeCableAndBreaker()` call
  // here and then rendered the MDB box from `computeFeeders` output instead, so
  // the sizing result was never displayed. Dropped rather than carried forward.

  // Auto-size on the worst-loaded winding so an unbalanced building is not
  // under-provisioned — same rule as the panel page and computeFeeders.
  const transformerPf = project.powerFactor || 0.85;
  const overallBalance = phaseBalance(
    [...sortedFloors.flatMap((fd) => fd.items), ...(bldg.buildingLoads || [])],
    project as never
  );
  const perPhaseKva: [number, number, number] = [
    overallBalance.phaseKw[0] / transformerPf,
    overallBalance.phaseKw[1] / transformerPf,
    overallBalance.phaseKw[2] / transformerPf,
  ];
  const transformerKva =
    bldg.transformer ||
    (project.buildings.length === 1 && project.transformerSize
      ? project.transformerSize
      : null) ||
    sizeTransformer(totalDemandKva, 1.2, perPhaseKva);

  // Aligned with the project's power ΔV limit (default 5%, IEC 60364-5-52
  // Annex G) so the riser verdict matches the cable schedule.
  const totalVdLimit = project.maxVoltageDropPower ?? 4;

  const floors: RiserFloorModel[] = sortedFloors.map((fd) => {
    const floorDemand = fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0);
    const floorConnectedLoad = fd.items.reduce(
      (s, item) => s + (item.calculatedConnectedLoad || 0),
      0
    );
    const vd = computeFloorRiserVd(fd, project);
    const floorCurrent = vd.riserCurrent; // maxPhaseCurrent — the sizing current
    const floorKva = floorDemand / project.powerFactor; // ΣkVA (demand already diversified)
    const diversityPct =
      floorConnectedLoad > 0 ? (floorDemand / floorConnectedLoad) * 100 : 0;
    const actualVoltage = project.voltage * (1 - vd.totalVdPercent / 100);

    // Per-circuit cable label: prefer the stored value, fall back to the feeder's
    // computed one. Ported from the inline IIFE this replaced.
    const circuits: RiserCircuit[] = fd.items.map((item) => {
      const matchingFeeder = fd.hasFloorSubPanels
        ? feedersData
            .smdbFeeders(fd.floorNumber)
            .find(
              (f) =>
                (f.itemId && f.itemId === item.id) ||
                f.name.includes(item.name)
            )
        : (feedersData.mdbFeeders.find(
            (f) =>
              (f.itemId && f.itemId === item.id) ||
              (f.floorDesignId === fd.id && f.name.includes(item.name))
          ) ||
            feedersData.mdbFeeders.find(
              (f) => f.name.includes(`F${fd.floorNumber}`) && f.name.includes(item.name)
            ));
      return {
        id: item.id,
        name: item.name,
        cableLabel:
          item.cableSize || matchingFeeder?.formattedCableSize || '4 mm²',
        demandKw: item.calculatedMaxDemand || 0,
      };
    });

    return {
      ...fd,
      ...vd,
      floorDemand,
      floorConnectedLoad,
      floorCurrent,
      floorKva,
      diversityPct,
      actualVoltage,
      isWarning: vd.totalVdPercent > totalVdLimit * 0.8,
      isDanger: vd.totalVdPercent > totalVdLimit,
      height: 0, // filled below, once svgHeight is known
      cy: 0, // filled below
      band: riserBand(vd.totalVdPercent, totalVdLimit, !vd.totalNoData),
      circuits,
    };
  });

  const floorHeights = floors.map((fd) =>
    Math.max(120, (fd.items.length - 1) * ITEM_SPACING + 64)
  );
  const totalFloorsHeight = floorHeights.reduce((sum, h) => sum + h, 0);
  const svgHeight = Math.max(
    700,
    totalFloorsHeight + HEADER_HEIGHT + FOOTER_HEIGHT + MDB_HEIGHT + 40
  );

  const floorsBaseY = svgHeight - FOOTER_HEIGHT - MDB_HEIGHT - 20;
  let currentFloorOffset = 0;
  floors.forEach((fd, i) => {
    fd.cy = floorsBaseY - currentFloorOffset - floorHeights[i] / 2;
    fd.height = floorHeights[i];
    currentFloorOffset += floorHeights[i];
  });

  const mainCableLabel =
    feedersData.mainParallelRuns > 1
      ? `${feedersData.mainParallelRuns} × ${formatCableSizeFor(feedersData.mainCableSize, project.calculationStandard)}`
      : formatCableSizeFor(feedersData.mainCableSize, project.calculationStandard);

  return {
    projectName: project.name,
    project,
    building: bldg,
    floors,
    layout: {
      svgWidth: SVG_WIDTH,
      svgHeight,
      busX: BUS_X,
      itemSpacing: ITEM_SPACING,
      headerHeight: HEADER_HEIGHT,
      footerHeight: FOOTER_HEIGHT,
      mdbHeight: MDB_HEIGHT,
    },
    totalVdLimit,
    mdb: {
      mainBreakerIn: feedersData.mainBreakerIn,
      // `category` is optional on the feeder settings; coalesce so the MDB box
      // never prints a literal "undefined" into a drawing.
      settingsCategory: feedersData.mainIncomerSettings.category ?? '',
      mainIncomerCurrent: feedersData.mainIncomerCurrent,
      mainCableLabel: mainCableLabel,
      mainParallelRuns: feedersData.mainParallelRuns,
    },
    transformer: { kva: transformerKva, impedance: 5 },
    buildingTotal: {
      connectedLoadKw: totalConnectedLoad,
      demandKw: totalDemandKw,
      demandKva: totalDemandKva,
      current: totalCurrent,
    },
  };
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Vertical room each sheet has for floors, in SVG user units.
 *
 * A landscape A4 sheet gives the drawing body ~1047px wide and ~597px tall at
 * 96dpi. A single sheet holds this many user units before the scale factor drops
 * below roughly 2/3 and the annotation text stops being legible. A whole 20-floor
 * riser is ~4400 units tall, which would scale to ~14% — one landscape sheet per
 * 4-5 floors is the difference between a drawing and a smudge.
 */
const DEFAULT_FLOOR_UNITS_PER_SHEET = 880;
const LEGEND_HEIGHT = 60;
const BOTTOM_MARGIN = 24;

export interface RiserSheet {
  /** 1-based. */
  index: number;
  total: number;
  /** Geometry recomputed for this sheet, so the bus and floors land correctly. */
  floors: RiserFloorModel[];
  svgWidth: number;
  svgHeight: number;
  /** True only on the first sheet: draws the transformer, incomer and MDB. */
  showSupplyBlock: boolean;
  /** Continuous vertical offset within the parent drawing, for a "continued" tag. */
  firstFloorNumber: number;
  lastFloorNumber: number;
}

/**
 * Split a riser into readable sheets. The supply block (transformer → MDB) is
 * drawn once on the first sheet; later sheets continue the bus and say so.
 */
export function paginateRiser(
  model: RiserModel,
  maxFloorUnitsPerSheet: number = DEFAULT_FLOOR_UNITS_PER_SHEET
): RiserSheet[] {
  const { layout } = model;
  const { svgWidth, headerHeight, footerHeight, mdbHeight, itemSpacing } = layout;

  const sheets: Array<{ floors: RiserFloorModel[]; showSupplyBlock: boolean }> = [];
  let current: RiserFloorModel[] = [];
  let used = 0;

  const flush = () => {
    if (current.length === 0) return;
    sheets.push({ floors: current, showSupplyBlock: sheets.length === 0 });
    current = [];
    used = 0;
  };

  for (const fd of model.floors) {
    const h = fd.height || Math.max(120, (fd.items.length - 1) * itemSpacing + 64);
    // Always place at least one floor per sheet, however tall it is.
    if (current.length > 0 && used + h > maxFloorUnitsPerSheet) flush();
    current.push(fd);
    used += h;
  }
  flush();

  return sheets.map((sheet, i) => {
    const chunkHeight = sheet.floors.reduce((sum, f) => sum + f.height, 0);
    const supplyHeight = sheet.showSupplyBlock
      ? footerHeight + mdbHeight + 40
      : BOTTOM_MARGIN;
    const svgHeight = headerHeight + chunkHeight + LEGEND_HEIGHT + supplyHeight + BOTTOM_MARGIN;

    // Stack upward from the bottom of the floor area, exactly as the single-sheet
    // layout does, so a chunked riser matches the on-screen drawing positionally.
    const baseY = svgHeight - supplyHeight - BOTTOM_MARGIN;
    let offset = 0;
    for (const fd of sheet.floors) {
      fd.cy = baseY - offset - fd.height / 2;
      offset += fd.height;
    }

    return {
      index: i + 1,
      total: sheets.length,
      floors: sheet.floors,
      svgWidth,
      svgHeight,
      showSupplyBlock: sheet.showSupplyBlock,
      firstFloorNumber: sheet.floors[0]?.floorNumber ?? 0,
      lastFloorNumber: sheet.floors[sheet.floors.length - 1]?.floorNumber ?? 0,
    };
  });
}
