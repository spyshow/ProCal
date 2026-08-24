/**
 * Per-floor riser-diagram voltage-drop computation.
 *
 * The riser page used to inline this — and inline it incorrectly (see
 * riser.test.ts "BUG" cases + the plan doc). Extracted here so it is pure,
 * testable, and single-sourced. Reuses the canonical IEC 60364-5-52 formula
 * in `calculateVoltageDrop` and the shared per-item phase/PF rules in
 * feeders.ts; no second formula, no re-derived phase split.
 *
 * Topology (matches computeFeeders):
 *  - Direct floor (!hasFloorSubPanels): every apartment is its own feeder
 *    tapped off the main bus. There is NO vertical riser. The floor's
 *    "ΔV to furthest load" = the worst apartment branch ΔV.
 *  - SDB floor (hasFloorSubPanels): MDB → riser → SDB → apartment branches.
 *    Riser ΔV uses maxPhaseCurrent (imbalance-aware, per eng-review §feeders),
 *    NOT the lumped floor current. Total = riser + worst branch.
 *
 * ponytail: a 1-phase apartment feeder carries line-neutral current at 230V
 * (2·I·L path); only 3-phase feeders use √3·I·L at 400V. The page used to pass
 * 3-phase/400V for everything — that was the bulk of "ΔV not correct".
 */
import { calculateVoltageDrop, parseMm2 } from "./cables";
import { phaseBalance } from "./phaseBalance";
import { isThreePhaseForItem, pfForFloorItem } from "./feeders";
import type { FloorDesign, FloorItem, Project } from "@/types";

export { parseMm2 };

export interface RiserFloorVd {
  /** True for SDB floors (a real vertical riser off the MDB bus). */
  hasRiser: boolean;
  /** Riser (MDB→SDB) ΔV %. 0 for direct floors. */
  riserVdPercent: number;
  /** True when an SDB riser exists but its length/size are missing (can't compute). */
  riserNoData: boolean;
  /** Riser cable mm² as actually used (parsed from FloorDesign), or null if absent. */
  riserCableSize: number | null;
  /** Riser cable length (m) as actually used, or null if absent. */
  riserCableLength: number | null;
  /** Design current (A) the riser was sized off — `maxPhaseCurrent`, not lumped. */
  riserCurrent: number;
  /** Worst apartment-branch ΔV behind the SDB (or directly off the bus for direct floors). */
  branchVdPercent: number;
  /** True when no item on the floor has computable branch data. */
  branchNoData: boolean;
  /** Transformer→furthest load ΔV % = riser + branch (the IEC compliance number). */
  totalVdPercent: number;
  /** True when the total can't be fully computed (any path leg missing). */
  totalNoData: boolean;
  /** Name of the item producing the worst branch ΔV (for annotation), or null. */
  worstItemName: string | null;
}

/** Per-apartment branch ΔV, using the item's own cable/length/phase/PF. null if no data. */
function itemBranchVd(
  item: FloorItem,
  project: Project
): { dropVolts: number; dropPercent: number } | null {
  const len = item.cableLength;
  const size = parseMm2(item.cableSize);
  const current = item.calculatedCurrent;
  if (len == null || len <= 0 || size == null || !current || current <= 0) return null;
  const is3ph = isThreePhaseForItem(item);
  const itemVoltage = is3ph ? project.voltage : project.voltage / Math.sqrt(3);
  const material = (item.cableMaterial as 'copper' | 'aluminum') ?? 'copper';
  return calculateVoltageDrop(
    current,
    len,
    size,
    pfForFloorItem(item, project),
    is3ph,
    itemVoltage,
    1,
    material
  );
}

/**
 * Compute the riser-diagram voltage-drop profile for one floor.
 *
 * Pure: takes a FloorDesign + Project, returns the ΔV breakdown. The SDB
 * riser current comes from `phaseBalance(fd.items).maxPhaseCurrent` (the same
 * imbalance-aware sizing current computeFeeders uses), so the riser page and
 * the panel/cable-schedule pages agree on the load the riser sees.
 */
export function computeFloorRiserVd(fd: FloorDesign, project: Project): RiserFloorVd {
  const balance = phaseBalance(fd.items, project);
  const riserCurrent = balance.maxPhaseCurrent;

  // Worst apartment-branch ΔV on the floor.
  let worstBranch: { dropVolts: number; dropPercent: number } | null = null;
  let worstItemName: string | null = null;
  for (const item of fd.items) {
    const vd = itemBranchVd(item, project);
    if (vd == null) continue;
    if (worstBranch == null || vd.dropPercent > worstBranch.dropPercent) {
      worstBranch = vd;
      worstItemName = item.name;
    }
  }
  const branchVdPercent = worstBranch?.dropPercent ?? 0;
  const branchNoData = worstBranch == null;

  if (fd.hasFloorSubPanels) {
    const riserLen = fd.riserCableLength;
    const riserSize = parseMm2(fd.riserCableSize);
    const riserNoData = riserLen == null || riserLen <= 0 || riserSize == null || riserCurrent <= 0;
    const riserVd = riserNoData
      ? { dropVolts: 0, dropPercent: 0 }
      : calculateVoltageDrop(
          riserCurrent,
          riserLen!,
          riserSize!,
          project.powerFactor ?? 0.85,
          true,
          project.voltage,
          1,
          (fd.riserCableMaterial as 'copper' | 'aluminum') ?? 'copper'
        );
    const riserVdPercent = riserVd.dropPercent;
    // Percentages sum — never raw volts. The riser leg drops against 400V
    // (√3·I·L·Z) while a 1-phase branch drops against 230V (2·I·L·Z); adding
    // volts then dividing by 400 understated the true total (a 2% riser +
    // 4.5% branch reported 4.6% instead of 6.5%, flipping FAIL to PASS).
    // Each leg's dropPercent is already referenced to its own base.
    const totalVdPercent = riserVdPercent + branchVdPercent;
    return {
      hasRiser: true,
      riserVdPercent,
      riserNoData,
      riserCableSize: riserSize,
      riserCableLength: riserLen ?? null,
      riserCurrent,
      branchVdPercent,
      branchNoData,
      totalVdPercent,
      totalNoData: riserNoData || branchNoData,
      worstItemName,
    };
  }

  // Direct floor: no riser. The branch IS the floor's ΔV to furthest load.
  return {
    hasRiser: false,
    riserVdPercent: 0,
    riserNoData: false,
    riserCableSize: null,
    riserCableLength: null,
    riserCurrent,
    branchVdPercent,
    branchNoData,
    totalVdPercent: branchVdPercent,
    totalNoData: branchNoData,
    worstItemName,
  };
}
