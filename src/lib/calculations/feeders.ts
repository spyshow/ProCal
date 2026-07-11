import { sizeCableAndBreaker } from "./cables";
import type { Building, FloorItem, PanelFeeder, Project } from "@/types";

/**
 * Equipment catalog entry — a breaker/MCCB/ACB model from /api/equipment.
 * Shared between the panel page and the breaker schedule page so the helper
 * can accept equipment via dependency injection rather than calling a hook.
 */
export interface EquipmentItem {
  id: string;
  category: string; // 'MCCB' | 'ACB' | ...
  manufacturer: string;
  series: string;
  model: string;
  ratedCurrent: number;
  poles: number;
  breakingCapacity: number;
  tripUnit: string | null;
  settingsJson: string | null;
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
 * Returns the smallest equipment entry whose ratedCurrent >= the breaker size,
 * or null when no equipment is loaded (the page then falls back to a string).
 */
export type FindBreaker = (
  currentRating: number,
  category: "MCCB" | "ACB"
) => EquipmentItem | null;

/**
 * Build a PanelFeeder from a per-item current, deriving three-phase via the
 * shared rule and looking up an MCCB model through the injected finder.
 */
function feederFromItem(
  item: FloorItem,
  findBreaker: FindBreaker
): PanelFeeder {
  const isThreePhase = isThreePhaseForItem(item);
  const sizing = sizeCableAndBreaker(item.calculatedCurrent, isThreePhase, {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 2,
  });
  const mccb = findBreaker(sizing.breakerSize, "MCCB");
  return {
    name: item.name,
    type: item.type,
    current: item.calculatedCurrent,
    breakerSize: sizing.breakerSize,
    cableSize: sizing.cableSize,
    breakerModel: mccb
      ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}`
      : `MCCB ${sizing.breakerSize}`,
  };
}

/**
 * Building-load feeder (elevator, water pump, fire pump, split AC, central AC).
 * These are 3-phase mechanical loads sized per the building's voltage.
 */
function feederFromBuildingLoad(
  name: string,
  type: string,
  kw: number,
  count: number,
  project: Project,
  findBreaker: FindBreaker
): PanelFeeder | null {
  if (count <= 0 || kw <= 0) return null;
  const totalKw = kw * count;
  // kVA → current via the project's actual voltage (not a hardcoded 0.4 kV).
  const current =
    totalKw / (Math.sqrt(3) * (project.voltage / 1000) * project.powerFactor);
  const sizing = sizeCableAndBreaker(current, true, {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 1,
  });
  const mccb = findBreaker(sizing.breakerSize, "MCCB");
  return {
    name,
    type,
    current,
    breakerSize: sizing.breakerSize,
    cableSize: sizing.cableSize,
    breakerModel: mccb
      ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}`
      : `MCCB ${sizing.breakerSize}`,
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
 */
export function computeFeeders(
  building: Building,
  project: Project,
  findBreaker: FindBreaker
): ComputeFeedersResult {
  const mdbFeeders: PanelFeeder[] = [];

  for (const fd of building.floorDesigns) {
    if (fd.hasFloorSubPanels) {
      // Floor has a sub-panel → one SMDB feeder for the whole floor.
      const floorTotalCurrent = fd.items.reduce(
        (sum, item) => sum + item.calculatedCurrent,
        0
      );
      const sizing = sizeCableAndBreaker(floorTotalCurrent, true, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 2,
      });
      const mccb = findBreaker(sizing.breakerSize, "MCCB");
      mdbFeeders.push({
        name: `F${fd.floorNumber} – SMDB`,
        type: "SMDB",
        current: floorTotalCurrent,
        breakerSize: sizing.breakerSize,
        cableSize: sizing.cableSize,
        breakerModel: mccb
          ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}`
          : `MCCB ${sizing.breakerSize}`,
      });
    } else {
      // No sub-panel → individual apartment / load feeders.
      for (const item of fd.items) {
        mdbFeeders.push(feederFromItem(item, findBreaker));
      }
    }
  }

  // Other building mechanical loads (3-phase, sized per project voltage).
  const pushLoad = (name: string, type: string, kw: number, count: number) => {
    const f = feederFromBuildingLoad(name, type, kw, count, project, findBreaker);
    if (f) mdbFeeders.push(f);
  };
  pushLoad("Elevator(s)", "ELEVATOR", 22, building.elevators);
  pushLoad("Water Pump(s)", "WATER_PUMP", 7.5, building.waterPumps);
  if (building.firePump) pushLoad("Fire Pump", "FIRE_PUMP", 15, 1);
  pushLoad("Split AC Panel", "SPLIT_AC", 5, building.splitAc);
  pushLoad("Central AC", "CENTRAL_AC", 50, building.centralAc);

  const smdbFloorNumbers = building.floorDesigns
    .filter((fd) => fd.hasFloorSubPanels)
    .map((fd) => fd.floorNumber);

  const smdbFeeders = (floorNumber: number): PanelFeeder[] => {
    const fd = building.floorDesigns.find(
      (f) => f.floorNumber === floorNumber
    );
    if (!fd) return [];
    return fd.items.map((item) => feederFromItem(item, findBreaker));
  };

  return { mdbFeeders, smdbFeeders, smdbFloorNumbers };
}
