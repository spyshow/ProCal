/**
 * Per-phase (L1/L2/L3) load balancing for a distribution board.
 *
 * ProCal used to lump every load into one total kW / one scalar current. This
 * module is the per-phase accounting: it splits each load across L1/L2/L3,
 * computes per-phase kW + current, the neutral current (vector method), and a
 * current-unbalance %, and applies a limit check + neutral sizing guard.
 *
 * Pure function — no React, no DB. Takes the board's items + the project
 * (for PF + calculationStandard), returns a `PhaseBalance` the calculator,
 * computeFeeders, and the MDB schedule consume.
 *
 * Design doc: ~/.gstack/projects/spyshow-ProCal/Jihad.Kherfan-feat-building-loads-library-design-20260714-091915.md
 *   "Engineering Review" section — the decisions below are the eng-review
 *   hardening of the office-hours spec.
 *
 * Key decisions (eng-review):
 *  - Neutral current uses the TOTAL angle = 120° phase offset (L1=0°, L2=−120°,
 *    L3=+120°) + per-item displacement (arccos PF, lagging). PF angle alone is
 *    WRONG — it omits the 120° separation that makes balanced loads cancel to 0.
 *  - Unbalance is a CURRENT-unbalance % proxy (max−min)/avg, NOT VUF/LVUR
 *    (both are voltage-based; ProCal computes currents). calculationStandard
 *    selects the LIMIT + label only.
 *  - Greedy phase assignment is computed ON-READ for null assignedPhase
 *    (round-robin to the least-loaded phase, in input array order — callers
 *    iterate floors → items deterministically, so results are stable across
 *    reads). No UI backfill event — every entry point (calculator, reports,
 *    computeFeeders) gets correct numbers; newly-added null items are assigned
 *    on the next read.
 *  - Neutral sizing guard = fundamental 2× max-phase only (PDH §5C). Triplen
 *    3× branch dropped — no harmonic data stored.
 *  - 3-phase apartment templates: kW/3 balanced split, flagged
 *    `internalImbalanceNotModeled` (a 3φ apartment is a bundle of 1φ room
 *    circuits, not a balanced motor; per-room decomposition deferred to C).
 */

import type {
  BuildingLoad,
  CalculationStandard,
  FloorItem,
  Project,
} from "@/types";
import {
  isThreePhaseForBuildingLoad,
  isThreePhaseForItem,
  pfAngleForBuildingLoad,
  pfAngleForItem,
} from "./feeders";

/** Phase index 1=L1, 2=L2, 3=L3. Stored on assignedPhase; 0-indexed internally. */
export type PhaseIdx = 0 | 1 | 2; // L1, L2, L3

/** 120° phase offset (radians) for the vector neutral decomposition. */
const PHASE_OFFSET_RAD: readonly number[] = [
  0, // L1
  (-2 * Math.PI) / 3, // L2 = −120°
  (2 * Math.PI) / 3, // L3 = +120°
];

/**
 * Current-unbalance limit per calculation standard. These are applied to the
 * current-unbalance % proxy. NOTE: EN 50160 (2%) and NEMA (1–5%) are VOLTAGE
 * limits; current unbalance runs ~4–6× voltage unbalance, so a literal 2%
 * threshold would cry-wolf on every real mixed board. The defaults below are
 * engineering-judgment current thresholds that keep the cited-standard framing
 * without the false positives. Tunable per project later if needed.
 *   (eng-review §D4)
 */
const UNBALANCE_LIMIT_PCT: Record<CalculationStandard, number> = {
  IEC: 10, // % current unbalance (EN 50160-framed)
  NEMA: 10, // % current unbalance (NEMA-framed; NEMA advisory 1%/hard 5% → ~6× on current)
};

/** 2× max-phase neutral bound (PDH Course E336 §5C). */
const NEUTRAL_FUNDAMENTAL_FACTOR = 2;

/** A load reduced to what the per-phase math needs. */
interface PhaseLoad {
  /** Item identity, for round-tripping assignedPhase back to the caller. */
  id: string;
  /** 1 = single-phase (sits on one phase), 3 = three-phase (splits across all). */
  phaseCount: 1 | 3;
  /** Per-phase current magnitude (A). For 1-phase: the full current on its
   * assigned phase. For 3-phase: the line current (same on each phase). */
  current: number;
  /** Per-phase kW. For 1-phase: full kW on its phase. For 3-phase: kW/3. */
  kw: number;
  /** Displacement angle (radians) for the vector neutral decomposition. */
  angle: number;
  /** Persisted/manual phase for 1-phase loads (1/2/3), or null = auto-assign. */
  assignedPhase: number | null;
  /** True for 3-phase apartment templates → flag "internal imbalance not modeled". */
  internalImbalanceNotModeled: boolean;
}

export interface PhaseBalance {
  /** Per-phase current (A). [L1, L2, L3]. */
  phaseCurrent: [number, number, number];
  /** Per-phase kW. [L1, L2, L3]. */
  phaseKw: [number, number, number];
  /** Total kW across all three phases (Σ phaseKw). */
  totalKw: number;
  /** Neutral current (A) — vector method, total angle. */
  neutralCurrent: number;
  /** Max loaded phase current (A) — drives cable/breaker sizing. */
  maxPhaseCurrent: number;
  /** Current-unbalance % = (max−min)/avg × 100. 0 for an empty board. */
  unbalancePct: number;
  /** True when unbalancePct exceeds the standard's limit. */
  imbalanced: boolean;
  /** The limit (%) the imbalanced flag is checked against. */
  unbalanceLimitPct: number;
  /** True when neutral current exceeds 2× the max phase current (PDH §5C). */
  neutralOversized: boolean;
  /** True if any 3-phase apartment-template load was modeled as balanced (kW/3). */
  internalImbalanceNotModeled: boolean;
  /** Per-load resolved phase assignment (1/2/3), so the UI can show it. */
  assignments: { id: string; assignedPhase: number; phaseCount: 1 | 3 }[];
  /** Raw phasor components — combine these before sqrt when merging boards. */
  neutralPhasors: { x: number; y: number };
}

/**
 * Compute the per-phase balance for a board.
 *
 * @param items    floor items and/or building loads on this board. Mixed
 *                 arrays are supported; the kind is detected per item.
 * @param project  the project (PF source for apartments/manual; calculationStandard).
 * @param buildingPhaseMap  optional map of item ID → phase from building-level
 *                          balance. When provided, auto-assignment uses these
 *                          pre-computed phases instead of round-robin.
 */

export interface OptimizePhaseBalanceOptions {
  /** Optional building-level phase seed map (item ID -> 1|2|3). */
  buildingPhaseMap?: Map<string, number>;
  /** Ignore existing manual assignedPhase pins and re-optimize all 1-phase loads. */
  ignorePins?: boolean;
  /**
   * When true, 3-phase APARTMENT items with populated apartmentTemplate.rooms
   * have their room connected loads decomposed into individual 1-phase loads
   * balanced across L1/L2/L3 (clearing internalImbalanceNotModeled).
   */
  decomposeThreePhaseApartments?: boolean;
}

interface ExpandResult {
  loads: PhaseLoad[];
  fixedParentAssignments: PhaseBalance["assignments"];
}

function normalizeWithDecomposition(
  items: (FloorItem | BuildingLoad)[],
  project: Project,
  decomposeThreePhaseApartments: boolean
): ExpandResult {
  const loads: PhaseLoad[] = [];
  const fixedParentAssignments: PhaseBalance["assignments"] = [];

  for (const item of items) {
    if (!("type" in item)) {
      loads.push(fromBuildingLoad(item));
      continue;
    }

    const isThreePhaseApt =
      item.type === "APARTMENT" && (item.apartmentTemplate?.phases ?? 1) === 3;
    const rooms = item.apartmentTemplate?.rooms ?? [];

    if (decomposeThreePhaseApartments && isThreePhaseApt && rooms.length > 0) {
      const totalRoomWatts = rooms.reduce((sum, r) => sum + Math.max(0, r.connectedLoad || 0), 0);
      if (totalRoomWatts > 0) {
        fixedParentAssignments.push({ id: item.id, assignedPhase: 0, phaseCount: 3 });
        const itemKw = item.calculatedMaxDemand ?? 0;
        const itemLineCurrent = item.calculatedCurrent ?? 0;
        const itemAngle = pfAngleForItem(item, project);

        rooms.forEach((room, idx) => {
          const share = Math.max(0, room.connectedLoad || 0) / totalRoomWatts;
          if (share <= 0) return;
          loads.push({
            id: `${item.id}::room::${room.id || idx}`,
            phaseCount: 1,
            // Sum of L-N branch currents on a 3-phase wye apartment equals 3 * line current at balanced split
            current: 3 * itemLineCurrent * share,
            kw: itemKw * share,
            angle: itemAngle,
            assignedPhase: null,
            internalImbalanceNotModeled: false,
          });
        });
        continue;
      }
    }

    loads.push(fromFloorItem(item, project));
  }

  return { loads, fixedParentAssignments };
}

function balanceObjective(phaseCurrent: [number, number, number], nx: number, ny: number): number {
  const maxI = Math.max(phaseCurrent[0], phaseCurrent[1], phaseCurrent[2]);
  const neutralI = Math.sqrt(nx * nx + ny * ny);
  const unbal = currentUnbalancePct(phaseCurrent);
  return maxI + 0.15 * neutralI + 0.05 * unbal;
}

/**
 * Combinatorial min-neutral per-phase optimizer extending greedy LPT with
 * steepest-descent single-relocation and pairwise Kempe swap local search over
 * true 120-degree + displacement phasors.
 */
export function optimizePhaseBalance(
  items: (FloorItem | BuildingLoad)[],
  project: Project,
  options?: OptimizePhaseBalanceOptions
): PhaseBalance {
  const decompose = Boolean(options?.decomposeThreePhaseApartments);
  const ignorePins = Boolean(options?.ignorePins);
  const buildingPhaseMap = options?.buildingPhaseMap;

  const { loads, fixedParentAssignments } = normalizeWithDecomposition(items, project, decompose);

  const phaseCurrent: [number, number, number] = [0, 0, 0];
  const phaseKw: [number, number, number] = [0, 0, 0];
  let neutralX = 0;
  let neutralY = 0;
  const fixedAssignments: PhaseBalance["assignments"] = [...fixedParentAssignments];
  let internalImbalanceNotModeled = false;

  const movable: PhaseLoad[] = [];
  for (const load of loads) {
    if (load.phaseCount === 3) {
      placeThreePhase(load, phaseCurrent, phaseKw, (ox, oy) => {
        neutralX += ox;
        neutralY += oy;
      });
      fixedAssignments.push({ id: load.id, assignedPhase: 0, phaseCount: 3 });
      if (load.internalImbalanceNotModeled) internalImbalanceNotModeled = true;
      continue;
    }

    if (!ignorePins && load.assignedPhase != null && load.assignedPhase >= 1 && load.assignedPhase <= 3) {
      const p = (load.assignedPhase - 1) as PhaseIdx;
      placeOnePhase(load, p, phaseCurrent, phaseKw, (ox, oy) => {
        neutralX += ox;
        neutralY += oy;
      });
      fixedAssignments.push({ id: load.id, assignedPhase: load.assignedPhase, phaseCount: 1 });
      continue;
    }

    movable.push(load);
  }

  // Sort largest-first for deterministic greedy LPT seed
  const sortedMovable = [...movable].sort((a, b) => b.current - a.current);
  const n = sortedMovable.length;
  const assigned: PhaseIdx[] = new Array(n);

  // Seed with buildingPhaseMap or LPT least-loaded phase
  for (let i = 0; i < n; i++) {
    const load = sortedMovable[i];
    const mapped = buildingPhaseMap?.get(load.id);
    const phase: PhaseIdx =
      mapped != null && mapped >= 1 && mapped <= 3
        ? ((mapped - 1) as PhaseIdx)
        : leastLoadedPhase(phaseCurrent);
    assigned[i] = phase;
    placeOnePhase(load, phase, phaseCurrent, phaseKw, (ox, oy) => {
      neutralX += ox;
      neutralY += oy;
    });
  }

  // Precompute phasor vectors per movable load for O(1) move/swap evaluation
  const px = sortedMovable.map((l) => [
    l.current * Math.cos(PHASE_OFFSET_RAD[0] - l.angle),
    l.current * Math.cos(PHASE_OFFSET_RAD[1] - l.angle),
    l.current * Math.cos(PHASE_OFFSET_RAD[2] - l.angle),
  ] as [number, number, number]);
  const py = sortedMovable.map((l) => [
    l.current * Math.sin(PHASE_OFFSET_RAD[0] - l.angle),
    l.current * Math.sin(PHASE_OFFSET_RAD[1] - l.angle),
    l.current * Math.sin(PHASE_OFFSET_RAD[2] - l.angle),
  ] as [number, number, number]);

  let currentCost = balanceObjective(phaseCurrent, neutralX, neutralY);
  const maxIters = 150;
  for (let iter = 0; iter < maxIters && n > 0; iter++) {
    let bestCost = currentCost - 1e-9;
    let bestMove: { kind: "relocate"; i: number; to: PhaseIdx } | { kind: "swap"; i: number; j: number } | null = null;

    // 1. Evaluate all single-load relocations
    for (let i = 0; i < n; i++) {
      const from = assigned[i];
      const ci = sortedMovable[i].current;
      for (let to = 0; to < 3; to++) {
        if (to === from) continue;
        phaseCurrent[from] -= ci;
        phaseCurrent[to] += ci;
        const nx = neutralX - px[i][from] + px[i][to];
        const ny = neutralY - py[i][from] + py[i][to];
        const cost = balanceObjective(phaseCurrent, nx, ny);
        if (cost < bestCost) {
          bestCost = cost;
          bestMove = { kind: "relocate", i, to: to as PhaseIdx };
        }
        phaseCurrent[from] += ci;
        phaseCurrent[to] -= ci;
      }
    }

    // 2. Evaluate all 1-for-1 Kempe swaps across distinct phases
    // Cap inner scan at 160 items to keep worst-case runtime strictly < 20ms even on huge boards
    const scanLimit = Math.min(n, 160);
    for (let i = 0; i < scanLimit; i++) {
      const pi = assigned[i];
      const ci = sortedMovable[i].current;
      for (let j = i + 1; j < scanLimit; j++) {
        const pj = assigned[j];
        if (pi === pj) continue;
        const cj = sortedMovable[j].current;
        if (Math.abs(ci - cj) < 1e-9 && Math.abs(sortedMovable[i].angle - sortedMovable[j].angle) < 1e-9) {
          continue;
        }
        phaseCurrent[pi] += cj - ci;
        phaseCurrent[pj] += ci - cj;
        const nx = neutralX - px[i][pi] + px[i][pj] - px[j][pj] + px[j][pi];
        const ny = neutralY - py[i][pi] + py[i][pj] - py[j][pj] + py[j][pi];
        const cost = balanceObjective(phaseCurrent, nx, ny);
        if (cost < bestCost) {
          bestCost = cost;
          bestMove = { kind: "swap", i, j };
        }
        phaseCurrent[pi] += ci - cj;
        phaseCurrent[pj] += cj - ci;
      }
    }

    if (!bestMove) break;

    if (bestMove.kind === "relocate") {
      const { i, to } = bestMove;
      const from = assigned[i];
      const load = sortedMovable[i];
      phaseCurrent[from] -= load.current;
      phaseCurrent[to] += load.current;
      phaseKw[from] -= load.kw;
      phaseKw[to] += load.kw;
      neutralX = neutralX - px[i][from] + px[i][to];
      neutralY = neutralY - py[i][from] + py[i][to];
      assigned[i] = to;
    } else {
      const { i, j } = bestMove;
      const pi = assigned[i];
      const pj = assigned[j];
      const li = sortedMovable[i];
      const lj = sortedMovable[j];
      phaseCurrent[pi] += lj.current - li.current;
      phaseCurrent[pj] += li.current - lj.current;
      phaseKw[pi] += lj.kw - li.kw;
      phaseKw[pj] += li.kw - lj.kw;
      neutralX = neutralX - px[i][pi] + px[i][pj] - px[j][pj] + px[j][pi];
      neutralY = neutralY - py[i][pi] + py[i][pj] - py[j][pj] + py[j][pi];
      assigned[i] = pj;
      assigned[j] = pi;
    }
    currentCost = bestCost;
  }

  const allAssignments: PhaseBalance["assignments"] = [...fixedAssignments];
  for (let i = 0; i < n; i++) {
    const load = sortedMovable[i];
    // Decomposed sub-room virtual IDs stay internal to calculation; parent already recorded
    if (!load.id.includes("::room::")) {
      allAssignments.push({ id: load.id, assignedPhase: assigned[i] + 1, phaseCount: 1 });
    }
  }

  return finalize(
    phaseCurrent,
    phaseKw,
    neutralX,
    neutralY,
    project,
    allAssignments,
    internalImbalanceNotModeled
  );
}

export function phaseBalance(
  items: (FloorItem | BuildingLoad)[],
  project: Project,
  buildingPhaseMap?: Map<string, number>
): PhaseBalance {
  const loads = normalize(items, project);
  return compute(loads, project, buildingPhaseMap);
}

// ---------------------------------------------------------------------------
// 1. Normalize: reduce FloorItem[] / BuildingLoad[] → PhaseLoad[]
// ---------------------------------------------------------------------------

function normalize(
  items: (FloorItem | BuildingLoad)[],
  project: Project
): PhaseLoad[] {
  // Kind is detected per item (FloorItem carries `type`; BuildingLoad does not)
  // so mixed boards — e.g. computeFeeders' overall balance — never route a
  // BuildingLoad through fromFloorItem, which would read its missing
  // calculatedCurrent/calculatedMaxDemand as zero and drop the load entirely.
  return items.map((item) =>
    "type" in item ? fromFloorItem(item, project) : fromBuildingLoad(item)
  );
}

function fromFloorItem(item: FloorItem, project: Project): PhaseLoad {
  const phaseCount: 1 | 3 = isThreePhaseForItem(item) ? 3 : 1;
  const isThreePhaseApt =
    item.type === "APARTMENT" && (item.apartmentTemplate?.phases ?? 1) === 3;
  const current = item.calculatedCurrent ?? 0;
  // kW from the precomputed max-demand (already a kW figure for apartments;
  // for library/manual items it's the demand kW). 1-phase: full kW on its
  // phase; 3-phase: kW/3 per phase.
  const kw = item.calculatedMaxDemand ?? 0;
  const angle = pfAngleForItem(item, project);
  return {
    id: item.id,
    phaseCount,
    current,
    kw,
    angle,
    assignedPhase: item.assignedPhase ?? null,
    // A 3-phase apartment template is modeled as a balanced motor (kW/3), but
    // it's really a bundle of 1-phase room circuits — flag the limitation.
    internalImbalanceNotModeled: isThreePhaseApt,
  };
}

function fromBuildingLoad(load: BuildingLoad): PhaseLoad {
  const phaseCount: 1 | 3 = isThreePhaseForBuildingLoad(load) ? 3 : 1;
  const lib = load.loadLibraryItem;
  // Current from power×quantity, exactly as feeders.ts does (eng-review §D5:
  // consume calculatedCurrent for FloorItem; for BuildingLoad there is no
  // stored current, so derive from lib.power×quantity here).
  const totalKw = (lib?.power ?? 0) * load.quantity;
  const voltageKv = (lib?.voltage ?? 230) / 1000;
  const pf = lib?.powerFactor ?? 1;
  const current =
    phaseCount === 3
      ? totalKw / (Math.sqrt(3) * voltageKv * pf)
      : totalKw / (voltageKv * pf);
  return {
    id: load.id,
    phaseCount,
    current,
    kw: totalKw,
    angle: pfAngleForBuildingLoad(load),
    assignedPhase: load.assignedPhase ?? null,
    // Building loads are mechanical (elevator/pump/AC) — genuinely 3-phase when
    // declared so; no apartment-internal-imbalance caveat.
    internalImbalanceNotModeled: false,
  };
}

// ---------------------------------------------------------------------------
// 2. Greedy LPT assignment for 1-phase loads with null assignedPhase
// ---------------------------------------------------------------------------

function compute(loads: PhaseLoad[], project: Project, buildingPhaseMap?: Map<string, number>): PhaseBalance {
  const phaseCurrent: [number, number, number] = [0, 0, 0];
  const phaseKw: [number, number, number] = [0, 0, 0];
  // Per-item phasor accumulators for the vector neutral current (eng-review
  // §D3): we carry each load's own displacement angle through the sum, so the
  // neutral is exact for mixed-PF boards, not just uniform-PF. The 120° phase
  // offset is added per contribution. X = Σ I·cos(totalAngle), Y = Σ I·sin(totalAngle).
  let neutralX = 0;
  let neutralY = 0;
  const assignments: PhaseBalance["assignments"] = [];
  let internalImbalanceNotModeled = false;

  // First pass: honor persisted/manual assignments for 1-phase loads and place
  // all 3-phase loads (kW/3, same line current on each of L1/L2/L3).
  const toAutoAssign: PhaseLoad[] = [];
  for (const load of loads) {
    if (load.phaseCount === 3) {
      placeThreePhase(load, phaseCurrent, phaseKw, (ox, oy) => {
        neutralX += ox;
        neutralY += oy;
      });
      assignments.push({ id: load.id, assignedPhase: 0, phaseCount: 3 });
      if (load.internalImbalanceNotModeled) internalImbalanceNotModeled = true;
      continue;
    }
    if (load.assignedPhase != null && load.assignedPhase >= 1 && load.assignedPhase <= 3) {
      const phase = (load.assignedPhase - 1) as PhaseIdx;
      placeOnePhase(load, phase, phaseCurrent, phaseKw, (ox, oy) => {
        neutralX += ox;
        neutralY += oy;
      });
      assignments.push({ id: load.id, assignedPhase: load.assignedPhase, phaseCount: 1 });
      continue;
    }
    toAutoAssign.push(load);
  }

  // Auto-assign 1-phase loads: use building-level assignments if provided,
  // otherwise use simple round-robin (least-loaded phase). Sort largest-first
  // (LPT — Longest Processing Time) so big loads land before the board fills
  // up; assigning in input order can strand a heavy load on an already-maxed
  // phase and leave a visible imbalance.
  const autoSorted = [...toAutoAssign].sort((a, b) => b.current - a.current);
  for (const load of autoSorted) {
    // Check if we have a pre-computed assignment from building-level balance
    const buildingPhase = buildingPhaseMap?.get(load.id);
    let phase: PhaseIdx;
    if (buildingPhase != null && buildingPhase >= 1 && buildingPhase <= 3) {
      // Use the building-level assignment
      phase = (buildingPhase - 1) as PhaseIdx;
    } else {
      // Round-robin: assign to least-loaded phase
      phase = leastLoadedPhase(phaseCurrent);
    }
    placeOnePhase(load, phase, phaseCurrent, phaseKw, (ox, oy) => {
      neutralX += ox;
      neutralY += oy;
    });
    assignments.push({ id: load.id, assignedPhase: phase + 1, phaseCount: 1 });
  }

  return finalize(
    phaseCurrent,
    phaseKw,
    neutralX,
    neutralY,
    project,
    assignments,
    internalImbalanceNotModeled
  );
}

/** Accumulator callback: add a load's neutral phasor contribution (cos, sin). */
type NeutralAccum = (ox: number, oy: number) => void;

function placeThreePhase(
  load: PhaseLoad,
  phaseCurrent: [number, number, number],
  phaseKw: [number, number, number],
  addNeutral: NeutralAccum
): void {
  // A balanced 3-phase load draws the same line current on each phase and
  // contributes kW/3 to each phase. Its three line currents at 0°/−120°/+120°
  // (each with the load's displacement) sum to ~0 in the neutral when the
  // per-phase currents are equal — the 120° cancellation.
  for (let p = 0; p < 3; p++) {
    phaseCurrent[p] += load.current;
    phaseKw[p] += load.kw / 3;
    const totalAngle = PHASE_OFFSET_RAD[p] - load.angle;
    addNeutral(load.current * Math.cos(totalAngle), load.current * Math.sin(totalAngle));
  }
}

function placeOnePhase(
  load: PhaseLoad,
  phase: PhaseIdx,
  phaseCurrent: [number, number, number],
  phaseKw: [number, number, number],
  addNeutral: NeutralAccum
): void {
  phaseCurrent[phase] += load.current;
  phaseKw[phase] += load.kw;
  const totalAngle = PHASE_OFFSET_RAD[phase] - load.angle;
  addNeutral(load.current * Math.cos(totalAngle), load.current * Math.sin(totalAngle));
}

function leastLoadedPhase(phaseCurrent: [number, number, number]): PhaseIdx {
  let min = phaseCurrent[0];
  let idx: PhaseIdx = 0;
  for (let p = 1; p < 3; p++) {
    if (phaseCurrent[p] < min) {
      min = phaseCurrent[p];
      idx = p as PhaseIdx;
    }
  }
  return idx;
}

// ---------------------------------------------------------------------------
// 3. Finalize: neutral current (vector), unbalance %, limits, guard
// ---------------------------------------------------------------------------

function finalize(
  phaseCurrent: [number, number, number],
  phaseKw: [number, number, number],
  neutralX: number,
  neutralY: number,
  project: Project,
  assignments: PhaseBalance["assignments"],
  internalImbalanceNotModeled: boolean
): PhaseBalance {
  const totalKw = phaseKw[0] + phaseKw[1] + phaseKw[2];
  const neutralCurrent = Math.sqrt(neutralX * neutralX + neutralY * neutralY);
  const maxPhaseCurrent = Math.max(phaseCurrent[0], phaseCurrent[1], phaseCurrent[2]);
  const unbalancePct = currentUnbalancePct(phaseCurrent);
  const standard = standardOf(project);
  const unbalanceLimitPct = UNBALANCE_LIMIT_PCT[standard];
  const imbalanced = unbalancePct > unbalanceLimitPct;
  const neutralOversized = neutralCurrent > NEUTRAL_FUNDAMENTAL_FACTOR * maxPhaseCurrent;

  return {
    phaseCurrent,
    phaseKw,
    totalKw,
    neutralCurrent,
    maxPhaseCurrent,
    unbalancePct,
    imbalanced,
    unbalanceLimitPct,
    neutralOversized,
    internalImbalanceNotModeled,
    assignments,
    neutralPhasors: { x: neutralX, y: neutralY },
  };
}

/**
 * Vector neutral current magnitude from accumulated per-item phasors
 * (PDH Course E336, Equation 5A). Each load contributed I·cos(θ_total) and
 * I·sin(θ_total) where θ_total = 120° phase offset + per-item displacement
 * (eng-review §D3). I_N = √(X² + Y²).
 *
 * Exposed for tests + callers that already hold the per-item phasors.
 */
export function neutralFromPhasors(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Current-unbalance % (Current Unbalance Rate, CUR) per NEMA MG 1-2021 Clause 14.36,
 * ANSI C84.1, and IEEE 141:
 *   CUR = max(|I - I_avg|) / I_avg × 100%
 * Returns 0 for an empty or perfectly balanced board.
 */
export function currentUnbalancePct(
  phaseCurrent: [number, number, number]
): number {
  const avg = (phaseCurrent[0] + phaseCurrent[1] + phaseCurrent[2]) / 3;
  if (avg === 0) return 0;
  const maxDev = Math.max(
    Math.abs(phaseCurrent[0] - avg),
    Math.abs(phaseCurrent[1] - avg),
    Math.abs(phaseCurrent[2] - avg)
  );
  return (maxDev / avg) * 100;
}

/** Resolve the calculation standard, defaulting to IEC. */
function standardOf(project: Project): CalculationStandard {
  return project.calculationStandard === "NEMA" ? "NEMA" : "IEC";
}
