import {
  sizeCableAndBreaker,
  parseCableSize,
  getItemCableLength,
  getBuildingLoadCableLength,
  getRiserCableLength,
  evaluateCableProtection,
} from "./cables";
import { phaseBalance } from "./phaseBalance";
import { calculateShortCircuitCurrent, calculateIscWithCable, getTypicalImpedance } from "./shortCircuit";
import { verifyCoordination, suggestAlternativeBreaker, type BreakerCurveSettings } from "./selectivity";
import { calculateThreePhaseCurrent, sizeTransformer } from "./loads";
import type { Building, BuildingLoad, FloorItem, PanelFeeder, Project, FallbackType, GenericBreakerSpec } from "@/types";

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
  /** Icu in kA. Null when the catalog entry has no recorded breaking capacity
   *  (missing spreadsheet column / legacy row) — treated as "cannot prove
   *  compliance" until a compliant device is found for the required fault. */
  breakingCapacity: number | null;
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
  /** Icu in kA of the matched catalog device; null for generic specs. */
  breakingCapacity?: number | null;
  fallback: boolean;
  fallbackType: FallbackType;
  genericSpec?: GenericBreakerSpec;
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
  const b = phaseBalance([withPhase], project);
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
 * models from that family; otherwise fall back across same-brand families,
 * other brands, and finally generic specifications.
 */
export type FindBreaker = (
  currentRating: number,
  category: "ACB" | "MCCB" | "MCB",
  poles: 1 | 3,
  options?: {
    familyId?: string;
    manufacturer?: string; // fallback manufacturer when familyId is omitted
    /** Prospective fault current (kA) at the device location; catalog
     *  candidates with Icu below it are skipped when a compliant one exists. */
    requiredIcuKa?: number;
  }
) => FoundBreaker;

/**
 * Build a model display string from matched equipment.
 */
function formatBreakerModel(item: EquipmentItem, targetRating?: number): string {
  if (targetRating && targetRating < item.ratedCurrent) {
    const replaced = item.model.replace(new RegExp(`\\b${item.ratedCurrent}A?\\b`, 'i'), `${targetRating}A`);
    return `${item.manufacturer} ${item.series} ${replaced}`;
  }
  return `${item.manufacturer} ${item.series} ${item.model}`;
}

/**
 * Find the smallest matching breaker model using a 4-tier search pipeline:
 * 1. Tier 1: Search the specific selected Family (SAME_FAMILY)
 * 2. Tier 2: Search other families of the same brand (OTHER_FAMILY)
 * 3. Tier 3: Search other active brands in the catalog (OTHER_BRAND)
 * 4. Tier 4: Generate a detailed generic engineering specification (GENERIC_SPEC)
 */
export function createFindBreaker(
  equipment: EquipmentItem[],
  defaultFamilies?: DefaultFamilies,
  preferredManufacturer?: string
): FindBreaker {
  return (currentRating, category, poles, options = {}) => {
    const requestedFamilyId = options.familyId ?? defaultFamilies?.[category];
    const familyItem = requestedFamilyId
      ? equipment.find((e) => e.familyId === requestedFamilyId)
      : undefined;

    const familyManufacturer = familyItem?.manufacturer;

    const matchPoles = (e: EquipmentItem, cat: "ACB" | "MCCB" | "MCB") => {
      if (cat === "MCB") {
        return poles === 1 ? e.poles <= 2 : e.poles === 3;
      }
      return poles === 1 ? e.poles <= 3 : e.poles === 3;
    };

    const findInSubset = (
      items: EquipmentItem[],
      cat: "ACB" | "MCCB" | "MCB",
      requiredIcu?: number
    ): EquipmentItem | null => {
      return (
        items
          .filter(
            (e) =>
              e.category === cat &&
              matchPoles(e, cat) &&
              e.ratedCurrent >= currentRating &&
              // A null Icu cannot prove compliance, so it is skipped when a
              // required fault level is given (matches the `?? 0` semantics of
              // the old `undefined >= n` comparison).
              (requiredIcu === undefined || (e.breakingCapacity ?? 0) >= requiredIcu)
          )
          .sort((a, b) => a.ratedCurrent - b.ratedCurrent)[0] || null
      );
    };

    // Categories to attempt if rating exceeds or falls below standard category limits
    const categoriesToAttempt: ("ACB" | "MCCB" | "MCB")[] = [category];
    if (category === "MCB" && currentRating > 63) {
      categoriesToAttempt.push("MCCB");
    }
    if (category === "MCCB" && currentRating <= 63) {
      categoriesToAttempt.push("MCB");
    }
    if ((category === "MCB" || category === "MCCB") && currentRating > 630) {
      categoriesToAttempt.push("ACB");
    }

    const preferredBrand = (
      options.manufacturer ??
      familyManufacturer ??
      (preferredManufacturer && preferredManufacturer !== "MIXED" ? preferredManufacturer : undefined)
    )?.toUpperCase();

    // Tiers 1–3 over the equipment catalog. When requiredIcu is given, only
    // devices whose breaking capacity covers it are considered.
    const searchCatalog = (requiredIcu?: number): FoundBreaker | null => {
      // ---------------------------------------------------------------
      // Tier 1: Search the specific selected Family (SAME_FAMILY)
      // ---------------------------------------------------------------
      let tier1Match: EquipmentItem | null = null;
      if (requestedFamilyId) {
        for (const cat of categoriesToAttempt) {
          const match = findInSubset(
            equipment.filter((e) => e.familyId === requestedFamilyId),
            cat,
            requiredIcu
          );
          if (match) {
            tier1Match = match;
            break;
          }
        }
      }

      if (tier1Match && tier1Match.ratedCurrent === currentRating) {
        return {
          model: formatBreakerModel(tier1Match, currentRating),
          manufacturer: tier1Match.manufacturer,
          familyName: tier1Match.familyName,
          ratedCurrent: tier1Match.ratedCurrent,
          breakingCapacity: tier1Match.breakingCapacity ?? null,
          fallback: false,
          fallbackType: 'SAME_FAMILY',
        };
      }

      // ---------------------------------------------------------------
      // Tier 2: Search other families of the SAME BRAND (OTHER_FAMILY)
      // ---------------------------------------------------------------
      let tier2Match: EquipmentItem | null = null;
      if (preferredBrand) {
        for (const cat of categoriesToAttempt) {
          const match = findInSubset(
            equipment.filter(
              (e) =>
                e.manufacturer.toUpperCase() === preferredBrand &&
                (!requestedFamilyId || e.familyId !== requestedFamilyId)
            ),
            cat,
            requiredIcu
          );
          if (match) {
            tier2Match = match;
            break;
          }
        }
      }

      if (tier1Match) {
        // If Tier 2 has a significantly closer rating to what was requested (e.g. 50A vs 100A), prefer Tier 2
        if (tier2Match && tier2Match.ratedCurrent < tier1Match.ratedCurrent) {
          return {
            model: formatBreakerModel(tier2Match, currentRating),
            manufacturer: tier2Match.manufacturer,
            familyName: tier2Match.familyName,
            ratedCurrent: tier2Match.ratedCurrent,
            breakingCapacity: tier2Match.breakingCapacity ?? null,
            fallback: true,
            fallbackType: 'OTHER_FAMILY',
          };
        }
        return {
          model: formatBreakerModel(tier1Match, currentRating),
          manufacturer: tier1Match.manufacturer,
          familyName: tier1Match.familyName,
          ratedCurrent: tier1Match.ratedCurrent,
          breakingCapacity: tier1Match.breakingCapacity ?? null,
          fallback: false,
          fallbackType: 'SAME_FAMILY',
        };
      }

      if (tier2Match) {
        return {
          model: formatBreakerModel(tier2Match, currentRating),
          manufacturer: tier2Match.manufacturer,
          familyName: tier2Match.familyName,
          ratedCurrent: tier2Match.ratedCurrent,
          breakingCapacity: tier2Match.breakingCapacity ?? null,
          fallback: true,
          fallbackType: 'OTHER_FAMILY',
        };
      }

      // ---------------------------------------------------------------
      // Tier 3: Search OTHER BRANDS in the catalog (OTHER_BRAND)
      // ---------------------------------------------------------------
      for (const cat of categoriesToAttempt) {
        const match = findInSubset(
          equipment.filter(
            (e) => !preferredBrand || e.manufacturer.toUpperCase() !== preferredBrand
          ),
          cat,
          requiredIcu
        );
        if (match) {
          return {
            model: formatBreakerModel(match, currentRating),
            manufacturer: match.manufacturer,
            familyName: match.familyName,
            ratedCurrent: match.ratedCurrent,
            breakingCapacity: match.breakingCapacity ?? null,
            fallback: true,
            fallbackType: 'OTHER_BRAND',
          };
        }
      }

      return null;
    };

    // When a prospective fault current is given, prefer catalog devices whose
    // Icu covers it; only fall back to a lower-Icu device when nothing
    // compliant exists, so the shortfall stays visible for icuOk reporting.
    const requiredIcuKa =
      options.requiredIcuKa !== undefined && options.requiredIcuKa > 0
        ? options.requiredIcuKa
        : undefined;
    const catalogMatch =
      (requiredIcuKa !== undefined ? searchCatalog(requiredIcuKa) : null) ??
      searchCatalog();
    if (catalogMatch) return catalogMatch;

    // -----------------------------------------------------------------
    // Tier 4: Generic Engineering Specification (GENERIC_SPEC)
    // -----------------------------------------------------------------
    const effectiveCategory: 'ACB' | 'MCCB' | 'MCB' =
      currentRating >= 630 ? 'ACB' : currentRating > 63 ? 'MCCB' : category;
    const requiredIcu = Math.max(
      effectiveCategory === 'ACB' ? 50 : effectiveCategory === 'MCCB' ? 36 : 10,
      Math.ceil(requiredIcuKa ?? 0)
    );
    const tripUnitType =
      effectiveCategory === 'ACB'
        ? 'Electronic LSI / LSIG (Adjustable Ir, Isd, tsd, Ii)'
        : effectiveCategory === 'MCCB'
        ? currentRating >= 160
          ? 'Electronic LSI (Adjustable Ir, Isd, tsd)'
          : 'Thermal-Magnetic (Fixed / Adjustable TMD)'
        : 'Thermal-Magnetic Type C (IEC 60898-1)';
    const standard =
      effectiveCategory === 'MCB' ? 'IEC 60898-1 / IEC 60947-2' : 'IEC 60947-2';

    const genericSpec: GenericBreakerSpec = {
      ratingAmps: currentRating,
      category: effectiveCategory,
      poles: poles === 1 ? (effectiveCategory === 'MCB' ? 1 : 3) : 3,
      requiredIcuKa: requiredIcu,
      tripUnitType,
      standard,
      procurementNotes: `Procure ${currentRating}A ${effectiveCategory} ${poles === 1 && effectiveCategory === 'MCB' ? '1P' : '3P'} breaker compliant with ${standard}, min Icu=${requiredIcu}kA, trip unit: ${tripUnitType}.`,
    };

    return {
      model: `Generic ${effectiveCategory} ${currentRating}A ${poles === 1 && effectiveCategory === 'MCB' ? '1P' : '3P'} (${requiredIcu}kA)`,
      manufacturer: null,
      familyName: null,
      ratedCurrent: currentRating,
      breakingCapacity: null,
      fallback: true,
      fallbackType: 'GENERIC_SPEC',
      genericSpec,
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
function categoryForFloorItem(item: FloorItem, currentOrBreakerSize?: number): "ACB" | "MCCB" | "MCB" {
  const size = currentOrBreakerSize ?? item.calculatedCurrent;
  if (size >= 630) return "ACB";
  if (
    size > 63 ||
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
  resolvedPhase: number | null = null,
  floorDesignId?: string
): PanelFeeder {
  const isThreePhase = isThreePhaseForItem(item);
  const insulation = (item.cableInsulation as "PVC" | "XLPE") ?? "XLPE";
  const material = (item.cableMaterial as "copper" | "aluminum") ?? "copper";
  const ambientTemp = item.ambientTemp ?? project.ambientTemp ?? 30;
  const groupingCount = item.groupingCount ?? project.groupingCount ?? 1;
  const installMethod = item.installMethod ?? undefined;
  const sizing = sizeCableAndBreaker(item.calculatedCurrent, isThreePhase, {
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod,
  });
  const manualBreaker = item.breakerSize ? parseInt(item.breakerSize.replace(/[^\d.]/g, ''), 10) : null;
  const targetBreaker = manualBreaker && !isNaN(manualBreaker) ? manualBreaker : sizing.breakerSize;
  const category = categoryForFloorItem(item, targetBreaker);
  const poles: 1 | 3 = isThreePhase ? 3 : 1;
  const match = findBreaker(targetBreaker, category, poles);
  // If the user specified an explicit breaker rating (e.g. 200A), honor that rating.
  // Otherwise if auto-sizing, use the catalog frame if larger than the calculated breaker size.
  const actualBreakerSize = manualBreaker && !isNaN(manualBreaker)
    ? manualBreaker
    : Math.max(targetBreaker, match.ratedCurrent ?? 0);
  const finalSizing =
    actualBreakerSize > sizing.breakerSize
      ? sizeCableAndBreaker(actualBreakerSize, isThreePhase, {
          material,
          insulation,
          ambientTemp,
          groupingCount,
          installMethod,
        })
      : sizing;
  const parsedItemCable = parseCableSize(item.cableSize);
  const effectiveCableSize = parsedItemCable?.size ?? finalSizing.cableSize;
  const cableInputForEval = item.cableSize ?? finalSizing.formattedCableSize;
  const protEval = evaluateCableProtection(cableInputForEval, actualBreakerSize, isThreePhase, {
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod,
  });

  const isBreakerUpsized = actualBreakerSize > sizing.breakerSize;
  const upsizeReason = isBreakerUpsized
    ? `Sized to ${actualBreakerSize}A (exceeds minimal ${sizing.breakerSize}A rating): Selected catalog frame rating for ${item.calculatedCurrent.toFixed(1)}A load.`
    : undefined;

  return {
    name: `F${floorNumber} – ${item.name}`,
    type: item.type,
    current: item.calculatedCurrent,
    breakerSize: actualBreakerSize,
    baseBreakerSize: sizing.breakerSize,
    isBreakerUpsized,
    upsizeReason,
    cableSize: effectiveCableSize,
    parallelRuns: protEval.parallelRuns,
    formattedCableSize: protEval.formattedCableSize,
    cableIz: protEval.deratedAmpacity,
    isUnderProtected: protEval.isUnderProtected,
    recommendedCableSize: protEval.recommendedCableSizeMm2,
    recommendedCableSizeFormatted: protEval.recommendedCableSizeFormatted,
    breakerModel:
      match.model ??
      `${match.manufacturer ? match.manufacturer + " " : ""}${match.familyName ? match.familyName + " " : ""}${category} ${actualBreakerSize}`.trim(),
    manufacturer: match.manufacturer,
    familyName: match.familyName,
    fallback: match.fallback,
    fallbackType: match.fallbackType,
    genericSpec: match.genericSpec,
    breakingCapacityKa: match.breakingCapacity ?? null,
    isThreePhase,
    assignedPhase: item.assignedPhase ?? null,
    itemId: item.id,
    floorDesignId: floorDesignId ?? item.floorDesignId,
    ...oneItemPhaseFields(item, project, resolvedPhase),
  };
}

/**
 * Building-load feeder (elevator, water pump, fire pump, split AC, central AC).
 * These are mechanical loads sized from the attached LoadLibraryItem's power × quantity.
 * `current` and `isThreePhase` are computed by the caller from the library item so a
 * 1-phase library item stays 1-phase; routing is MCCB (or MCB for <=63A).
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
  const insulation = (load.cableInsulation as "PVC" | "XLPE") ?? "XLPE";
  const material = (load.cableMaterial as "copper" | "aluminum") ?? "copper";
  const ambientTemp = load.ambientTemp ?? project.ambientTemp ?? 30;
  const groupingCount = load.groupingCount ?? project.groupingCount ?? 1;
  const installMethod = load.installMethod ?? undefined;
  const sizing = sizeCableAndBreaker(current, isThreePhase, {
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod,
  });
  const manualBreaker = load.breakerSize ? parseInt(load.breakerSize.replace(/[^\d.]/g, ''), 10) : null;
  const targetBreaker = manualBreaker && !isNaN(manualBreaker) ? manualBreaker : sizing.breakerSize;
  const category: "ACB" | "MCCB" | "MCB" = targetBreaker >= 630 ? "ACB" : targetBreaker > 63 ? "MCCB" : "MCB";
  const poles: 1 | 3 = isThreePhase ? 3 : 1;
  const match = findBreaker(targetBreaker, category, poles);
  const actualBreakerSize = manualBreaker && !isNaN(manualBreaker)
    ? manualBreaker
    : Math.max(targetBreaker, match.ratedCurrent ?? 0);
  const finalSizing =
    actualBreakerSize > sizing.breakerSize
      ? sizeCableAndBreaker(actualBreakerSize, isThreePhase, {
          material,
          insulation,
          ambientTemp,
          groupingCount,
          installMethod,
        })
      : sizing;
  const parsedLoadCable = parseCableSize(load.cableSize);
  const effectiveCableSize = parsedLoadCable?.size ?? finalSizing.cableSize;
  const cableInputForEval = load.cableSize ?? finalSizing.formattedCableSize;
  const protEval = evaluateCableProtection(cableInputForEval, actualBreakerSize, isThreePhase, {
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod,
  });

  const isBreakerUpsized = actualBreakerSize > sizing.breakerSize;
  const upsizeReason = isBreakerUpsized
    ? `Sized to ${actualBreakerSize}A (exceeds minimal ${sizing.breakerSize}A rating): Selected catalog frame rating with electronic trip unit protection for ${current.toFixed(1)}A design current.`
    : undefined;

  return {
    name,
    type,
    current,
    breakerSize: actualBreakerSize,
    baseBreakerSize: sizing.breakerSize,
    isBreakerUpsized,
    upsizeReason,
    cableSize: effectiveCableSize,
    parallelRuns: protEval.parallelRuns,
    formattedCableSize: protEval.formattedCableSize,
    cableIz: protEval.deratedAmpacity,
    isUnderProtected: protEval.isUnderProtected,
    recommendedCableSize: protEval.recommendedCableSizeMm2,
    recommendedCableSizeFormatted: protEval.recommendedCableSizeFormatted,
    breakerModel:
      match.model ??
      `${match.manufacturer ? match.manufacturer + " " : ""}${match.familyName ? match.familyName + " " : ""}${category} ${actualBreakerSize}`.trim(),
    manufacturer: match.manufacturer,
    familyName: match.familyName,
    fallback: match.fallback,
    fallbackType: match.fallbackType,
    genericSpec: match.genericSpec,
    breakingCapacityKa: match.breakingCapacity ?? null,
    isThreePhase,
    assignedPhase: load.assignedPhase ?? null,
    buildingLoadId: load.id,
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
  /** Sized main incomer breaker curve settings for this building. */
  mainIncomerSettings: BreakerCurveSettings;
  /** Whether the main incomer's Icu covers the transformer-terminal fault current. */
  mainIncomerIcuOk: boolean;
  /** Per-run cross-section (mm²) of the incomer cable, re-sized to the catalog breaker frame. */
  mainCableSize: number;
  /** Parallel runs of the incomer cable. */
  mainParallelRuns: number;
  /** Derated ampacity (Iz) of the incomer cable — must be >= mainBreakerIn. */
  mainCableIz: number;
  /** Actual catalog breaker rating (In) of the main incomer. */
  mainBreakerIn: number;
  /** Design load current (A) for the whole building incoming supply. */
  mainIncomerCurrent: number;
  /** Prospective secondary short-circuit current (kA) at the main incomer. */
  transformerIscKa: number;
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
      const riserInsulation = (fd.riserCableInsulation as "PVC" | "XLPE") ?? "XLPE";
      const riserMaterial = (fd.riserCableMaterial as "copper" | "aluminum") ?? "copper";
      const riserAmbientTemp = fd.riserAmbientTemp ?? project.ambientTemp ?? 30;
      const riserGroupingCount = fd.riserGroupingCount ?? project.groupingCount ?? 1;
      const riserInstallMethod = fd.riserInstallMethod ?? undefined;
      const sizing = sizeCableAndBreaker(floorCurrent, riserIsThreePhase, {
        material: riserMaterial,
        insulation: riserInsulation,
        ambientTemp: riserAmbientTemp,
        groupingCount: riserGroupingCount,
        installMethod: riserInstallMethod,
        // Feed the floor's vector neutral current so an unbalanced floor keeps
        // the full-size neutral instead of the default S/2 reduction.
        neutralCurrent: floorBalance.neutralCurrent,
      });
      const manualRiserBreaker = fd.riserBreakerSize ? parseInt(fd.riserBreakerSize.replace(/[^\d.]/g, ''), 10) : null;
      const targetRiserBreaker = manualRiserBreaker && !isNaN(manualRiserBreaker) ? manualRiserBreaker : sizing.breakerSize;
      const riserCategory = targetRiserBreaker >= 630 ? "ACB" : "MCCB";
      const match = findBreaker(targetRiserBreaker, riserCategory, riserPoles);
      const actualBreakerSize = manualRiserBreaker && !isNaN(manualRiserBreaker)
        ? manualRiserBreaker
        : Math.max(targetRiserBreaker, match.ratedCurrent ?? 0);
      const finalSizing =
        actualBreakerSize > sizing.breakerSize
          ? sizeCableAndBreaker(actualBreakerSize, riserIsThreePhase, {
              material: riserMaterial,
              insulation: riserInsulation,
              ambientTemp: riserAmbientTemp,
              groupingCount: riserGroupingCount,
              installMethod: riserInstallMethod,
              neutralCurrent: floorBalance.neutralCurrent,
            })
          : sizing;
      const parsedRiserCable = parseCableSize(fd.riserCableSize);
      const effectiveRiserSize = parsedRiserCable?.size ?? finalSizing.cableSize;
      const cableInputForEval = fd.riserCableSize ?? finalSizing.formattedCableSize;
      const riserProtEval = evaluateCableProtection(cableInputForEval, actualBreakerSize, riserIsThreePhase, {
        material: riserMaterial,
        insulation: riserInsulation,
        ambientTemp: riserAmbientTemp,
        groupingCount: riserGroupingCount,
        installMethod: riserInstallMethod,
      });

      const isBreakerUpsized = actualBreakerSize > sizing.breakerSize;
      const upsizeReason = isBreakerUpsized
        ? `Sized to ${actualBreakerSize}A (exceeds minimal ${sizing.breakerSize}A rating): Upsized for SMDB sub-panel selectivity grading (IEC 60947-2 ≥1.6× downstream branch MCBs) and electronic trip unit frame sizing, with dial Ir tuned to protect the ${floorCurrent.toFixed(1)}A load.`
        : undefined;

      mdbFeeders.push({
        name: `F${fd.floorNumber} – SMDB`,
        type: "SMDB",
        current: floorCurrent,
        breakerSize: actualBreakerSize,
        baseBreakerSize: sizing.breakerSize,
        isBreakerUpsized,
        upsizeReason,
        cableSize: effectiveRiserSize,
        parallelRuns: riserProtEval.parallelRuns,
        formattedCableSize: riserProtEval.formattedCableSize,
        cableIz: riserProtEval.deratedAmpacity,
        isUnderProtected: riserProtEval.isUnderProtected,
        recommendedCableSize: riserProtEval.recommendedCableSizeMm2,
        recommendedCableSizeFormatted: riserProtEval.recommendedCableSizeFormatted,
        breakerModel:
          match.model ??
          `${match.manufacturer ?? ""} ${riserCategory} ${actualBreakerSize}`.trim(),
        manufacturer: match.manufacturer,
        familyName: match.familyName,
        fallback: match.fallback,
        fallbackType: match.fallbackType,
        genericSpec: match.genericSpec,
        breakingCapacityKa: match.breakingCapacity ?? null,
        isThreePhase: riserIsThreePhase, // physical riser is always 3-phase off the MDB bus
        floorDesignId: fd.id,
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
          feederFromItem(item, fd.floorNumber, findBreaker, project, resolved, fd.id)
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

  // -------------------------------------------------------------------------
  // Protection Tree Hierarchy & Terminal Short-Circuit Sizing
  // -------------------------------------------------------------------------

  // 1. Calculate transformer capacity and prospective secondary short-circuit current
  const allItems = [
    ...building.floorDesigns.flatMap((fd) => fd.items),
    ...(building.buildingLoads ?? []),
  ];
  const overallBalance = phaseBalance(allItems, project);
  const totalDemandKva = overallBalance.totalKw / (project.powerFactor || 0.85);
  const transformerSizeKva = project.transformerSize || sizeTransformer(totalDemandKva, 1.2) || 500;

  const earthingSystem = building.earthingSystem || 'TN-S';
  const scResult = calculateShortCircuitCurrent({
    ratedPower: transformerSizeKva,
    voltagePrimary: 11000,
    voltageSecondary: project.voltage,
    impedancePercent: getTypicalImpedance(transformerSizeKva),
    earthingSystem,
  });
  const transformerIscKa = scResult.threePhaseIsc;

  // 2. Main Incomer Breaker Sizing
  const mainIncomerCurrent = calculateThreePhaseCurrent(totalDemandKva, project.voltage);
  const mainCableOptions = {
    material: 'copper' as const,
    insulation: 'XLPE' as const,
    ambientTemp: project.ambientTemp ?? 30,
    groupingCount: 1,
    // Whole-building vector neutral current (imbalance-aware), so the MDB
    // incomer neutral is kept full-size when the board is unbalanced.
    neutralCurrent: overallBalance.neutralCurrent,
  };
  const mainSizing = sizeCableAndBreaker(mainIncomerCurrent, true, mainCableOptions);
  const mainCategory = mainSizing.breakerSize < 630 ? 'MCCB' : 'ACB';
  const mainMatch = findBreaker(mainSizing.breakerSize, mainCategory, 3, {
    requiredIcuKa: transformerIscKa,
  });
  const mainBreakerSize = Math.max(mainSizing.breakerSize, mainMatch.ratedCurrent ?? 0);
  const mainBreakerIn = Math.max(16, mainBreakerSize);
  const mainIr = Math.max(16, Math.min(mainIncomerCurrent > 0 ? mainIncomerCurrent : mainBreakerIn, mainBreakerIn));

  // Re-size the incomer cable to the ACTUAL catalog breaker frame: the cable
  // ampacity must cover the breaker rating (Ib <= In <= Iz per IEC 60364-5-52),
  // and the catalog frame (mainBreakerIn) can exceed the load-based standard
  // breaker after the match. Mirrors the finalSizing pattern used for
  // item/riser/building-load feeders so an upsized incomer never ships with
  // In > Iz.
  const mainFinalSizing =
    mainBreakerIn > mainSizing.breakerSize
      ? sizeCableAndBreaker(mainBreakerIn, true, mainCableOptions)
      : mainSizing;

  // A generic spec self-requires the fault level, so it counts as compliant.
  const mainIncomerIcuOk =
    mainMatch.breakingCapacity != null
      ? mainMatch.breakingCapacity >= transformerIscKa
      : mainMatch.fallbackType === 'GENERIC_SPEC';

  const mainIncomerSettings: BreakerCurveSettings = {
    inRating: mainBreakerIn,
    ir: mainIr,
    tr: 12,
    isd: mainBreakerIn * 4,
    tsd: 0.3,
    ii: mainBreakerIn * 10,
    category: mainBreakerIn >= 630 ? 'ACB' : 'MCCB',
    manufacturer: mainMatch.manufacturer ?? project.preferredManufacturer ?? 'ABB',
    model: mainMatch.model ?? `Main ${mainCategory} ${mainBreakerIn}`,
    // A generic engineering spec has no tested selectivity/cascading data —
    // gate the tested-manufacturer matrix on real catalog devices.
    isGeneric: mainMatch.fallbackType === 'GENERIC_SPEC',
  };

  // Verifies a feeder breaker's breaking capacity against the prospective fault
  // current at its location (Icu >= Isc per IEC 60947-2). When the selected
  // device has no recorded Icu or its Icu is below the fault level, retries the
  // catalog for a compliant device at the same rating; if none exists the
  // original device is kept and icuOk is set false so the UI can flag it.
  const categoryForFeeder = (f: PanelFeeder): "ACB" | "MCCB" | "MCB" =>
    f.breakerSize >= 630
      ? "ACB"
      : f.breakerSize > 63 ||
          ["SMDB", "SERVICE_PANEL", "PUMP_PANEL", "ELEVATOR_PANEL"].includes(f.type)
        ? "MCCB"
        : "MCB";

  const enforceFeederIcu = (f: PanelFeeder, faultKa: number): void => {
    f.faultCurrentKa = faultKa;
    if (f.breakingCapacityKa != null && f.breakingCapacityKa >= faultKa) {
      f.icuOk = true;
      return;
    }
    // A generic spec self-requires the fault level, so it counts as compliant
    // without needing a catalog Icu.
    if (f.fallbackType === 'GENERIC_SPEC') {
      f.icuOk = true;
      return;
    }
    // Missing or insufficient Icu: retry the catalog for a compliant device at
    // the same rating. When none exists the original device is kept and icuOk
    // is set false so the UI can flag it.
    const upgrade = findBreaker(
      f.breakerSize,
      categoryForFeeder(f),
      f.isThreePhase ? 3 : 1,
      { requiredIcuKa: faultKa, manufacturer: f.manufacturer ?? undefined }
    );
    if ((upgrade.breakingCapacity ?? 0) >= faultKa || upgrade.fallbackType === 'GENERIC_SPEC') {
      f.breakerModel = upgrade.model ?? f.breakerModel;
      f.manufacturer = upgrade.manufacturer;
      f.familyName = upgrade.familyName;
      f.fallback = upgrade.fallback;
      f.fallbackType = upgrade.fallbackType;
      f.genericSpec = upgrade.genericSpec;
      f.breakingCapacityKa = upgrade.breakingCapacity ?? null;
      f.icuOk = true;
    } else {
      f.icuOk = false;
    }
  };

  // 3. Process MDB Feeders against Main Incomer
  for (const f of mdbFeeders) {
    f.parentFeederName = 'Main Incomer';

    // Cable length resolution
    let cableLength = 20;
    let cableInsulation: 'PVC' | 'XLPE' = 'XLPE';
    let cableMaterial: 'copper' | 'aluminum' = 'copper';

    if (f.type === 'SMDB') {
      const matchFloor = building.floorDesigns.find((fd) => `F${fd.floorNumber} – SMDB` === f.name);
      cableLength = getRiserCableLength(matchFloor, matchFloor?.floorNumber ?? 1);
      cableInsulation = (matchFloor?.riserCableInsulation as 'PVC' | 'XLPE') || 'XLPE';
      cableMaterial = (matchFloor?.riserCableMaterial as 'copper' | 'aluminum') || 'copper';
    } else {
      const matchBl = (building.buildingLoads ?? []).find((bl) => bl.loadLibraryItem?.name === f.name || bl.loadLibraryItem?.category === f.type);
      if (matchBl) {
        cableLength = getBuildingLoadCableLength(matchBl);
        cableInsulation = (matchBl.cableInsulation as 'PVC' | 'XLPE') || 'XLPE';
        cableMaterial = (matchBl.cableMaterial as 'copper' | 'aluminum') || 'copper';
      } else {
        const matchItem = building.floorDesigns
          .flatMap((fd) => fd.items.map((it) => ({ it, floorNumber: fd.floorNumber })))
          .find(({ it, floorNumber }) => `F${floorNumber} – ${it.name}` === f.name);
        if (matchItem) {
          cableLength = getItemCableLength(matchItem.it, matchItem.floorNumber);
          cableInsulation = (matchItem.it.cableInsulation as 'PVC' | 'XLPE') || 'XLPE';
          cableMaterial = (matchItem.it.cableMaterial as 'copper' | 'aluminum') || 'copper';
        }
      }
    }

    const terminalIscKa = calculateIscWithCable(transformerIscKa, cableLength, f.cableSize, project.voltage, cableMaterial === 'copper', !f.isThreePhase, cableInsulation, f.parallelRuns);
    enforceFeederIcu(f, terminalIscKa);

    const dsInRating = Math.max(6, f.breakerSize || 10);
    // Ir cannot exceed the frame rating In: a manual breaker set below the
    // load current must not produce an invalid Ir > In trip setting.
    const dsIr = Math.max(6, Math.min(f.current > 0 ? f.current : dsInRating, dsInRating));

    const downstreamSettings: BreakerCurveSettings = {
      inRating: dsInRating,
      ir: dsIr,
      tr: 12,
      isd: f.isThreePhase ? dsInRating * 4 : undefined,
      tsd: f.isThreePhase ? 0.1 : undefined,
      // Instantaneous pickup aligned with the IEC 60898 C-curve upper band
      // (10×In) for both 1-phase and 3-phase branch MCBs.
      ii: dsInRating * 10,
      category: f.type === 'SMDB' || f.type === 'SERVICE_PANEL' || f.type === 'PUMP_PANEL' || f.type === 'ELEVATOR_PANEL' ? 'MCCB' : 'MCB',
      manufacturer: f.manufacturer ?? project.preferredManufacturer ?? 'ABB',
      model: f.breakerModel,
      isGeneric: f.fallbackType === 'GENERIC_SPEC',
    };

    const coord = verifyCoordination(
      mainIncomerSettings,
      downstreamSettings,
      terminalIscKa * 1000,
      {
        cableSizeMm2: f.cableSize,
        cableMaterial,
        cableInsulation,
        cableRuns: f.parallelRuns,
        manufacturerPair: {
          upstreamMfg: mainIncomerSettings.manufacturer ?? 'ABB',
          downstreamMfg: downstreamSettings.manufacturer ?? 'ABB',
        },
      }
    );

    f.selectivityStatus = coord.status;
    // Stored in kA (the field name carries the unit): coord.limitCurrent is Amperes.
    // Only PARTIAL carries a limit — a FULL verdict has a limit above the
    // fault level (it is reported in selectivityReason), and NONE has none,
    // so the data honors the PanelFeeder contract ("FULL/NONE carry null").
    f.selectivityLimitKa = coord.status === 'PARTIAL' && coord.limitCurrent
      ? parseFloat((coord.limitCurrent / 1000).toFixed(2))
      : null;
    f.cableDamageOk = coord.cableDamageOk;
    f.selectivityReason = coord.overlapDetails ?? (coord.status === 'FULL' ? 'Fully selective against Main Incomer' : 'Selectivity restricted');

    if (coord.status !== 'FULL') {
      const suggestions = suggestAlternativeBreaker(
        mainIncomerSettings,
        downstreamSettings,
        terminalIscKa * 1000,
        {
          downstreamLoadCurrent: f.current,
          cableSizeMm2: f.cableSize,
          parentFeederName: f.parentFeederName,
          preferredManufacturer: project.preferredManufacturer,
        }
      );
      f.alternativeSuggestions = suggestions;
      f.suggestedAlternative = suggestions[0]?.title ?? null;
    }
  }

  const smdbFloorNumbers = building.floorDesigns
    .filter((fd) => fd.hasFloorSubPanels)
    .map((fd) => fd.floorNumber);

  const smdbFeeders = (floorNumber: number): PanelFeeder[] => {
    const fd = building.floorDesigns.find(
      (f) => f.floorNumber === floorNumber
    );
    if (!fd) return [];

    const smdbRiserFeeder = mdbFeeders.find((f) => f.name === `F${floorNumber} – SMDB`);
    const smdbFaultIsc = smdbRiserFeeder?.faultCurrentKa ?? transformerIscKa;

    const riserInRating = Math.max(16, smdbRiserFeeder?.breakerSize ?? 160);
    const riserIr = Math.max(16, Math.min(
      (smdbRiserFeeder?.current && smdbRiserFeeder.current > 0) ? smdbRiserFeeder.current : riserInRating,
      riserInRating
    ));

    const smdbRiserSettings: BreakerCurveSettings = {
      inRating: riserInRating,
      ir: riserIr,
      tr: 12,
      isd: riserInRating * 4,
      tsd: 0.1,
      ii: riserInRating * 10,
      category: 'MCCB',
      manufacturer: smdbRiserFeeder?.manufacturer ?? project.preferredManufacturer ?? 'ABB',
      model: smdbRiserFeeder?.breakerModel,
      isGeneric: smdbRiserFeeder?.fallbackType === 'GENERIC_SPEC',
    };

    // Resolve each item's phase from the floor balance so the SMDB outgoing
    // feeders reflect the real board distribution.
    const balance = phaseBalance(fd.items, project);
    const phaseById = new Map(
      balance.assignments.map((a) => [a.id, a.assignedPhase])
    );
    return fd.items.map((item) => {
      const resolved = item.assignedPhase ?? phaseById.get(item.id) ?? null;
      const feeder = feederFromItem(item, floorNumber, findBreaker, project, resolved, fd.id);

      feeder.parentFeederName = `F${floorNumber} – SMDB`;

      const branchLength = getItemCableLength(item, floorNumber);
      const branchInsulation = (item.cableInsulation as 'PVC' | 'XLPE') || 'XLPE';
      const branchMaterial = (item.cableMaterial as 'copper' | 'aluminum') || 'copper';
      const branchFaultIsc = calculateIscWithCable(smdbFaultIsc, branchLength, feeder.cableSize, project.voltage, branchMaterial === 'copper', !feeder.isThreePhase, branchInsulation, feeder.parallelRuns);
      enforceFeederIcu(feeder, branchFaultIsc);

      const branchInRating = Math.max(6, feeder.breakerSize || 10);
      const branchIr = Math.max(6, Math.min(feeder.current > 0 ? feeder.current : branchInRating, branchInRating));

      const branchSettings: BreakerCurveSettings = {
        inRating: branchInRating,
        ir: branchIr,
        tr: 12,
        isd: feeder.isThreePhase ? branchInRating * 4 : undefined,
        tsd: feeder.isThreePhase ? 0.05 : undefined,
        // Instantaneous pickup aligned with the IEC 60898 C-curve upper band
        // (10×In) for both 1-phase and 3-phase branch MCBs.
        ii: branchInRating * 10,
        category: feeder.type === 'PUMP_PANEL' || feeder.type === 'SERVICE_PANEL' ? 'MCCB' : 'MCB',
        manufacturer: feeder.manufacturer ?? project.preferredManufacturer ?? 'ABB',
        model: feeder.breakerModel,
        isGeneric: feeder.fallbackType === 'GENERIC_SPEC',
      };

      const coord = verifyCoordination(
        smdbRiserSettings,
        branchSettings,
        branchFaultIsc * 1000,
        {
          cableSizeMm2: feeder.cableSize,
          cableMaterial: branchMaterial,
          cableInsulation: branchInsulation,
          cableRuns: feeder.parallelRuns,
          manufacturerPair: {
            upstreamMfg: smdbRiserSettings.manufacturer ?? 'ABB',
            downstreamMfg: branchSettings.manufacturer ?? 'ABB',
          },
        }
      );

      feeder.selectivityStatus = coord.status;
      // Stored in kA (the field name carries the unit): coord.limitCurrent is Amperes.
      // Only PARTIAL carries a limit (FULL/NONE emit null, per the contract).
      feeder.selectivityLimitKa = coord.status === 'PARTIAL' && coord.limitCurrent
        ? parseFloat((coord.limitCurrent / 1000).toFixed(2))
        : null;
      feeder.cableDamageOk = coord.cableDamageOk;
      feeder.selectivityReason = coord.overlapDetails ?? (coord.status === 'FULL' ? `Fully selective against SMDB F${floorNumber}` : 'Selectivity restricted');

      if (coord.status !== 'FULL') {
        const suggestions = suggestAlternativeBreaker(
          smdbRiserSettings,
          branchSettings,
          branchFaultIsc * 1000,
          {
            downstreamLoadCurrent: feeder.current,
            cableSizeMm2: feeder.cableSize,
            parentFeederName: feeder.parentFeederName,
            preferredManufacturer: project.preferredManufacturer,
          }
        );
        feeder.alternativeSuggestions = suggestions;
        feeder.suggestedAlternative = suggestions[0]?.title ?? null;
      }

      return feeder;
    });
  };

  return {
    mdbFeeders,
    smdbFeeders,
    smdbFloorNumbers,
    mainIncomerSettings,
    mainIncomerIcuOk,
    mainCableSize: mainFinalSizing.cableSize,
    mainParallelRuns: mainFinalSizing.parallelRuns,
    mainCableIz: mainFinalSizing.deratedAmpacity,
    mainBreakerIn,
    mainIncomerCurrent,
    transformerIscKa,
  };
}
