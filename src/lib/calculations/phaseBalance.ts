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
    const totalAngle = PHASE_OFFSET_RAD[p] + load.angle;
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
  const totalAngle = PHASE_OFFSET_RAD[phase] + load.angle;
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

/** Current-unbalance % = (max − min) / avg × 100. 0 for an empty/equal board. */
export function currentUnbalancePct(
  phaseCurrent: [number, number, number]
): number {
  const max = Math.max(phaseCurrent[0], phaseCurrent[1], phaseCurrent[2]);
  const min = Math.min(phaseCurrent[0], phaseCurrent[1], phaseCurrent[2]);
  const avg = (phaseCurrent[0] + phaseCurrent[1] + phaseCurrent[2]) / 3;
  if (avg === 0) return 0;
  return ((max - min) / avg) * 100;
}

/** Resolve the calculation standard, defaulting to IEC. */
function standardOf(project: Project): CalculationStandard {
  return project.calculationStandard === "NEMA" ? "NEMA" : "IEC";
}
