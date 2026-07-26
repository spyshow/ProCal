import { sizeCableAndBreaker } from "./cables";
import { phaseBalance } from "./phaseBalance";
import type { Building, BuildingLoad, FloorItem, PanelFeeder, Project } from "@/types";

/**
 * Equipment catalog entry — a breaker/MCCB/ACB model from /api/equipment.
 * Shared between the panel page and the breaker schedule page so the helper
 * can accept equipment via dependency injection rather than calling a hook.
 */
export interface EquipmentItem {
  id: string;
  category: string; // 'MCCB' | 'ACB' | 'MCB' | ...
  manufacturer: string;
  familyId: string | null;
  familyName: string | null;
  series: string;
  model: string;
  ratedCurrent: number;
  poles: number;
  breakingCapacity: number;
  tripUnit: string | null;
  settingsJson: string | null;
}

/**
 * Result returned by the family-aware breaker finder.
 */
export interface FoundBreaker {
  model: string | null;
  manufacturer: string | null;
  familyName: string | null;
  ratedCurrent: number | null;
  fallback: boolean;
}

/**
 * Three-phase classification for a FloorItem.
 *
 * Mirrors the per-item-type derivation in the API routes
 * (floors/[id]/items/route.ts:62,88,114) so every view agrees:
 *   APARTMENT  → apartmentTemplate.phases === 3
 *   LIBRARY    → loadLibraryItem.phase === 3
 *   MANUAL     → true (SERVICE/PUMP/ELEVATOR panels are 3-phase by default)
 *
 * This is the single source of truth — panel, breaker-schedule,
 * cable-schedule, and the API routes all use it. No more per-page re-derivation.
 */
export function isThreePhaseForItem(item: FloorItem): boolean {
  // Apartment: derive from the template's phase count (default 1 if missing).
  if (item.type === "APARTMENT") {
    return (item.apartmentTemplate?.phases ?? 1) === 3;
  }
  // Load Library item: derive from its declared phase (default 1).
  if (item.loadLibraryItem) {
    return item.loadLibraryItem.phase === 3;
  }
  // Manual kW entry (SERVICE_PANEL / PUMP_PANEL / ELEVATOR_PANEL): 3-phase.
  return true;
}

/**
 * Per-item-type phase count, the BuildingLoad variant. A building load is
 * always backed by a LoadLibraryItem (elevator, pump, AC, fire pump), so its
 * phase comes from `loadLibraryItem.phase` (default 3 — building mechanical
 * loads are 3-phase by convention; a 1-phase library item overrides).
 */
export function isThreePhaseForBuildingLoad(load: BuildingLoad): boolean {
  return (load.loadLibraryItem?.phase ?? 3) === 3;
}

/**
 * Per-item power-factor DISPLACEMENT angle (radians) for the vector neutral-
 * current decomposition. This is the per-item half of the total angle; the
 * 120° phase offset (L1=0°, L2=−120°, L3=+120°) is applied by the caller
 * (phaseBalance.ts), NOT here — this helper is a per-item property, parallel
 * to isThreePhaseForItem.
 *
 * PF-source is the single source of truth (eng-review issue 4 / D6), mirroring
 * isThreePhaseForItem so type→PF-source lives in one place:
 *   APARTMENT / MANUAL FloorItem → Project.powerFactor (not stored per-item)
 *   LIBRARY FloorItem             → loadLibraryItem.powerFactor
 *   BuildingLoad (always library) → loadLibraryItem.powerFactor
 *
 * ProCal does not store leading-vs-lagging, so displacement is assumed LAGGING
 * (positive angle, the motor/resistive default). The total angle fed to the
 * vector sum = phaseOffset + displacement.
 *
 * Returns 0 for PF >= 1 (resistive) or missing PF (treated as resistive).
 */
export function pfAngleForItem(
  item: FloorItem,
  project: Project
): number {
  const pf = pfForFloorItem(item, project);
  return displacementAngle(pf);
}

export function pfAngleForBuildingLoad(load: BuildingLoad): number {
  const pf = load.loadLibraryItem?.powerFactor ?? 1;
  return displacementAngle(pf);
}

/** Resolve the power factor for a FloorItem from the correct source. */
export function pfForFloorItem(item: FloorItem, project: Project): number {
  // Apartment template + manual kW entry: PF comes from the project (default 0.85),
  // NOT stored per-item on FloorItem/ApartmentTemplate. See design doc §input contract.
  if (item.type === "APARTMENT" || !item.loadLibraryItem) {
    return project.powerFactor ?? 0.85;
  }
  // Library item (3-phase or 1-phase): its own declared power factor.
  return item.loadLibraryItem.powerFactor ?? 1;
}

/** arccos(PF) displacement angle in radians; clamped to [0, π/2). */
function displacementAngle(pf: number): number {
  if (!pf || pf <= 0) return 0;
  return Math.acos(Math.min(Math.max(pf, -1), 1));
}

/**
 * Per-phase fields for ONE feeder, projected from the BOARD-RESOLVED phase.
 * For 3-phase loads this is the same board-level spread (the load spans all
 * three phases). For 1-phase loads we honor `resolvedPhase` (the phase this
 * load was assigned to by the floor/building balance, or its persisted
 * assignedPhase) so each feeder's L-column matches the board's real
 * distribution — summing L1/L2/L3 across feeders then equals the board
 * aggregate. A null resolvedPhase (single-item call site) falls back to L1.
 */
function oneItemPhaseFields(
  item: FloorItem | BuildingLoad,
  project: Project,
  resolvedPhase: number | null
): Pick<
  PanelFeeder,
  | "phaseCurrent"
  | "phaseKw"
  | "neutralCurrent"
  | "unbalancePct"
  | "imbalanced"
  | "neutralOversized"
  | "internalImbalanceNotModeled"
> {
  const withPhase =
    resolvedPhase && resolvedPhase >= 1 && resolvedPhase <= 3
      ? ({ ...item, assignedPhase: resolvedPhase } as FloorItem | BuildingLoad)
      : item;
  const b = phaseBalance([withPhase] as FloorItem[] & BuildingLoad[], project);
  return {
    phaseCurrent: b.phaseCurrent,
    phaseKw: b.phaseKw,
    neutralCurrent: b.neutralCurrent,
    unbalancePct: b.unbalancePct,
    imbalanced: b.imbalanced,
    neutralOversized: b.neutralOversized,
    internalImbalanceNotModeled: b.internalImbalanceNotModeled,
  };
}

/**
 * Project-level default breaker family IDs by category.
 */
export interface DefaultFamilies {
  ACB?: string;
  MCCB?: string;
  MCB?: string;
}

/**
 * Returns the smallest equipment entry whose ratedCurrent >= the breaker size,
 * filtered by category and poles. When a default family is provided, prefer
 * models from that family; otherwise fall back to the preferred manufacturer.
 */
export type FindBreaker = (
  currentRating: number,
  category: "ACB" | "MCCB" | "MCB",
  poles: 1 | 3,
  options?: {
    familyId?: string;
    manufacturer?: string; // fallback manufacturer when familyId is omitted
  }
) => FoundBreaker;

/**
 * Build a model display string from matched equipment.
 */
function formatBreakerModel(item: EquipmentItem): string {
  return `${item.manufacturer} ${item.series} ${item.model}`;
}

/**
 * Find the smallest matching breaker model.
 * 1. Try the selected family (if any) matching category and poles.
 * 2. Fall back to the family's manufacturer + category + poles before trying
 *    the global preferred manufacturer. This keeps a Schneider family from
 *    jumping to ABB just because the sidebar preference is still ABB.
 * 3. Last resort: any row matching category + poles.
 */
export function createFindBreaker(
  equipment: EquipmentItem[],
  defaultFamilies?: DefaultFamilies,
  preferredManufacturer?: string
): FindBreaker {
  return (currentRating, category, poles, options = {}) => {
    // Normalize: 1-phase matches poles <= 2; 3-phase matches poles === 3.
    const matchesPoles = (e: EquipmentItem) =>
      poles === 1 ? e.poles <= 2 : e.poles === 3;

    const familyId = options.familyId ?? defaultFamilies?.[category];
    const familyManufacturer = familyId
      ? equipment.find((e) => e.familyId === familyId)?.manufacturer
      : undefined;

    // Step 1: selected/default family.
    if (familyId) {
      const familyMatch = equipment
        .filter(
          (e) =>
            e.familyId === familyId &&
            e.category === category &&
            matchesPoles(e) &&
            e.ratedCurrent >= currentRating
        )
        .sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0];

      if (familyMatch) {
        return {
          model: formatBreakerModel(familyMatch),
          manufacturer: familyMatch.manufacturer,
          familyName: familyMatch.familyName,
          ratedCurrent: familyMatch.ratedCurrent,
          fallback: false,
        };
      }
    }

    // Step 2: fallback to the family's manufacturer, or the preferred manufacturer.
    const manufacturer =
      options.manufacturer ??
      familyManufacturer ??
      preferredManufacturer;
    if (manufacturer && manufacturer !== "MIXED") {
      const mfgMatch = equipment
        .filter(
          (e) =>
            e.category === category &&
            e.manufacturer.toUpperCase() === manufacturer.toUpperCase() &&
            matchesPoles(e) &&
            e.ratedCurrent >= currentRating
        )
        .sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0];

      if (mfgMatch) {
        return {
          model: formatBreakerModel(mfgMatch),
          manufacturer: mfgMatch.manufacturer,
          familyName: mfgMatch.familyName,
          ratedCurrent: mfgMatch.ratedCurrent,
          fallback: true,
        };
      }
    }

    // Step 3: last resort, any matching category + poles.
    const anyMatch = equipment
      .filter(
        (e) => e.category === category && matchesPoles(e) && e.ratedCurrent >= currentRating
      )
      .sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0];

    if (anyMatch) {
      return {
        model: formatBreakerModel(anyMatch),
        manufacturer: anyMatch.manufacturer,
        familyName: anyMatch.familyName,
        ratedCurrent: anyMatch.ratedCurrent,
        fallback: true,
      };
    }

    // Nothing found.
    return {
      model: null,
      manufacturer: null,
      familyName: null,
      ratedCurrent: null,
      fallback: false,
    };
  };
}

/**
 * Resolve the breaker category for a FloorItem based on its type/role.
 *
 * Feeder category routing:
 *   Main incomer          → ACB (computed outside this helper)
 *   Sub-panel riser       → MCCB
 *   Building service load → MCCB
 *   Apartment             → MCB
 *   Other end-load        → MCB
 */
function categoryForFloorItem(item: FloorItem): "MCCB" | "MCB" {
  if (
    item.type === "SERVICE_PANEL" ||
    item.type === "PUMP_PANEL" ||
    item.type === "ELEVATOR_PANEL"
  ) {
    return "MCCB";
  }
  return "MCB";
}

/**
 * Build a PanelFeeder from a per-item current, deriving three-phase via the
 * shared rule and looking up a breaker model through the injected finder.
 * The feeder name carries the floor prefix (e.g. "F0 – Apt A") so it is
 * unique within a building and the floor can be read back from the name.
 */
function feederFromItem(
  item: FloorItem,
  floorNumber: number,
  findBreaker: FindBreaker,
  project: Project,
  resolvedPhase: number | null = null
): PanelFeeder {
  const isThreePhase = isThreePhaseForItem(item);
  const sizing = sizeCableAndBreaker(item.calculatedCurrent, isThreePhase, {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 2,
    installMethod: item.installMethod ?? undefined,
  });
  const category = categoryForFloorItem(item);
  const poles: 1 | 3 = isThreePhase ? 3 : 1;
  const match = findBreaker(sizing.breakerSize, category, poles);
  // The selected model determines the real breaker rating. If the catalog's
  // smallest model is larger than the design breaker size, size the cable to
  // the actual model rating so breaker and cable stay consistent.
  const actualBreakerSize = Math.max(
    sizing.breakerSize,
    match.ratedCurrent ?? 0
  );
  const finalSizing =
    actualBreakerSize > sizing.breakerSize
      ? sizeCableAndBreaker(actualBreakerSize, isThreePhase, {
          material: "copper",
          insulation: "XLPE",
          ambientTemp: 30,
          groupingCount: 2,
        })
      : sizing;
  return {
    name: `F${floorNumber} – ${item.name}`,
    type: item.type,
    current: item.calculatedCurrent,
    breakerSize: actualBreakerSize,
    cableSize: finalSizing.cableSize,
    breakerModel:
      match.model ??
      `${match.manufacturer ?? ""} ${category} ${actualBreakerSize}`.trim(),
    manufacturer: match.manufacturer,
    familyName: match.familyName,
    fallback: match.fallback,
    isThreePhase,
    assignedPhase: item.assignedPhase ?? null,
    ...oneItemPhaseFields(item, project, resolvedPhase),
  };
}

/**
 * Building-load feeder (elevator, water pump, fire pump, split AC, central AC).
 * These are mechanical loads sized from the attached LoadLibraryItem's power × quantity.
 * `current` and `isThreePhase` are computed by the caller from the library item so a
 * 1-phase library item stays 1-phase; routing is MCCB (building service loads).
 */
function feederFromBuildingLoad(
  name: string,
  type: string,
  current: number,
  isThreePhase: boolean,
  findBreaker: FindBreaker,
  project: Project,
  load: BuildingLoad,
  resolvedPhase: number | null = null
): PanelFeeder | null {
  if (current <= 0) return null;
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 1,
    installMethod: (load as any).installMethod ?? undefined,
  });
  const poles: 1 | 3 = isThreePhase ? 3 : 1;
  const match = findBreaker(sizing.breakerSize, "MCCB", poles);
  const actualBreakerSize = Math.max(sizing.breakerSize, match.ratedCurrent ?? 0);
  const finalSizing =
    actualBreakerSize > sizing.breakerSize
      ? sizeCableAndBreaker(actualBreakerSize, isThreePhase, {
          material: "copper",
          insulation: "XLPE",
          ambientTemp: 30,
          groupingCount: 1,
        })
      : sizing;
  return {
    name,
    type,
    current,
    breakerSize: actualBreakerSize,
    cableSize: finalSizing.cableSize,
    breakerModel:
      match.model ??
      `${match.manufacturer ?? ""} MCCB ${actualBreakerSize}`.trim(),
    manufacturer: match.manufacturer,
    familyName: match.familyName,
    fallback: match.fallback,
    isThreePhase,
    assignedPhase: load.assignedPhase ?? null,
    ...oneItemPhaseFields(load, project, resolvedPhase),
  };
}

export interface ComputeFeedersResult {
  /** MDB outgoing feeders: per-floor (SMDB for sub-panel floors, else apartments) + building loads. */
  mdbFeeders: PanelFeeder[];
  /** SMDB outgoing feeders for a single floor (its apartments/loads). */
  smdbFeeders: (floorNumber: number) => PanelFeeder[];
  /** Floor numbers that have sub-panels — drives the SMDB floor selector. */
  smdbFloorNumbers: number[];
}

/**
 * Compute the outgoing feeders for a building's MDB and any SMDB floor.
 *
 * Pure function: takes the building, project, an equipment finder (dependency-
 * injected so it stays free of React hooks), and returns feeders + the list of
 * sub-panel floor numbers. Main-incomer and transformer sizing stay in the
 * panel page (they have no analog in the breaker schedule).
 *
 * Feeder category routing:
 *   ┌─────────────────────────────┐
 *   │ Main incomer          → ACB │  (computed in panel/page.tsx)
 *   │ Sub-panel riser       → MCCB│  (floorTotalCurrent aggregated)
 *   │ Building service load → MCCB│  (SERVICE/PUMP/ELEVATOR panels)
 *   │ Apartment / end-load  → MCB │  (feederFromItem)
 *   └─────────────────────────────┘
 */
export function computeFeeders(
  building: Building,
  project: Project,
  findBreaker: FindBreaker
): ComputeFeedersResult {
  const mdbFeeders: PanelFeeder[] = [];

  for (const fd of building.floorDesigns) {
    // Per-phase balance for this floor. 3-phase loads split equally; 1-phase
    // loads auto-assign or use the persisted assignedPhase. We use the MAX
    // loaded phase current (not the lumped sum) to size the riser/breaker.
    const floorBalance = phaseBalance(fd.items, project);

    if (fd.hasFloorSubPanels) {
      // Floor has a sub-panel → one SMDB feeder for the whole floor.
      // The riser is ALWAYS 3-phase/3-pole off the MDB bus, even when every
      // downstream item is 1-phase. The gear exists; current on unloaded phases
      // is zero, but the cable is still a 3-phase 4-wire set. Sizing therefore
      // uses the 3-phase cable table (conservative for the physical cable) and
      // the max-loaded phase current as the design current. (eng-review §note)
      const floorCurrent = floorBalance.maxPhaseCurrent;
      const riserIsThreePhase = true;
      const riserPoles: 1 | 3 = 3;
      const sizing = sizeCableAndBreaker(floorCurrent, riserIsThreePhase, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 2,
      });
      const match = findBreaker(sizing.breakerSize, "MCCB", riserPoles);
      const actualBreakerSize = Math.max(sizing.breakerSize, match.ratedCurrent ?? 0);
      const finalSizing =
        actualBreakerSize > sizing.breakerSize
          ? sizeCableAndBreaker(actualBreakerSize, riserIsThreePhase, {
              material: "copper",
              insulation: "XLPE",
              ambientTemp: 30,
              groupingCount: 2,
            })
          : sizing;
      mdbFeeders.push({
        name: `F${fd.floorNumber} – SMDB`,
        type: "SMDB",
        current: floorCurrent,
        breakerSize: actualBreakerSize,
        cableSize: finalSizing.cableSize,
        breakerModel:
          match.model ??
          `${match.manufacturer ?? ""} MCCB ${actualBreakerSize}`.trim(),
        manufacturer: match.manufacturer,
        familyName: match.familyName,
        fallback: match.fallback,
        isThreePhase: riserIsThreePhase, // physical riser is always 3-phase off the MDB bus
        // Per-phase balance fields for the MDB schedule columns (T6).
        phaseCurrent: floorBalance.phaseCurrent,
        phaseKw: floorBalance.phaseKw,
        neutralCurrent: floorBalance.neutralCurrent,
        unbalancePct: floorBalance.unbalancePct,
        imbalanced: floorBalance.imbalanced,
        neutralOversized: floorBalance.neutralOversized,
        internalImbalanceNotModeled: floorBalance.internalImbalanceNotModeled,
        assignedPhase: null,
      });
    } else {
      // No sub-panel → individual apartment / load feeders. Project each from
      // the floor-resolved phase so per-feeder L-columns sum to the floor
      // aggregate (not each re-balanced alone onto L1).
      const phaseById = new Map(
        floorBalance.assignments.map((a) => [a.id, a.assignedPhase])
      );
      for (const item of fd.items) {
        const resolved = item.assignedPhase ?? phaseById.get(item.id) ?? null;
        mdbFeeders.push(
          feederFromItem(item, fd.floorNumber, findBreaker, project, resolved)
        );
      }
    }
  }

  // Building mechanical loads (elevator, pumps, AC, fire pump) attached from the
  // load library. Compute their per-phase balance and size each feeder off the
  // max-loaded phase current (same as floor sub-panels). This makes a 1-phase
  // building load correctly single-pole and phase-load-aware.
  const buildingBalance = phaseBalance(building.buildingLoads ?? [], project);
  const blPhaseById = new Map(
    buildingBalance.assignments.map((a) => [a.id, a.assignedPhase])
  );
  for (const bl of building.buildingLoads ?? []) {
    const lib = bl.loadLibraryItem;
    if (!lib || lib.power <= 0 || bl.quantity <= 0) continue;
    const isThreePhase = lib.phase === 3;
    // The per-phase balance already computed current magnitudes by load; pull
    // this load's resolved current from the balance's assignment row.
    const assignment = buildingBalance.assignments.find((a) => a.id === bl.id);
    const current =
      assignment?.phaseCount === 3
        ? (lib.power * bl.quantity) /
          (Math.sqrt(3) * (lib.voltage / 1000) * lib.powerFactor)
        : (lib.power * bl.quantity) / ((lib.voltage / 1000) * lib.powerFactor);
    const resolved = bl.assignedPhase ?? blPhaseById.get(bl.id) ?? null;
    const f = feederFromBuildingLoad(
      lib.name,
      lib.category,
      current,
      isThreePhase,
      findBreaker,
      project,
      bl,
      resolved
    );
    if (f) mdbFeeders.push(f);
  }

  const smdbFloorNumbers = building.floorDesigns
    .filter((fd) => fd.hasFloorSubPanels)
    .map((fd) => fd.floorNumber);

  const smdbFeeders = (floorNumber: number): PanelFeeder[] => {
    const fd = building.floorDesigns.find(
      (f) => f.floorNumber === floorNumber
    );
    if (!fd) return [];
    // Resolve each item's phase from the floor balance so the SMDB outgoing
    // feeders reflect the real board distribution.
    const balance = phaseBalance(fd.items, project);
    const phaseById = new Map(
      balance.assignments.map((a) => [a.id, a.assignedPhase])
    );
    return fd.items.map((item) => {
      const resolved = item.assignedPhase ?? phaseById.get(item.id) ?? null;
      return feederFromItem(item, floorNumber, findBreaker, project, resolved);
    });
  };

  return { mdbFeeders, smdbFeeders, smdbFloorNumbers };
}
