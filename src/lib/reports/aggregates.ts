import {
  computeItemVoltageDrop,
  parseMm2,
  getItemCableLength,
  getBuildingLoadCableLength,
  getRiserCableLength,
  formatCableSizeFor,
} from "@/lib/calculations/cables";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { awgLabel, nextBreakerRating } from "@/lib/calculations/codes";
import { computeFeeders, createFindBreaker, type EquipmentItem, type FindBreaker } from "@/lib/calculations/feeders";
import type { Building, FloorItem, Project, FallbackType, GenericBreakerSpec } from "@/types";
import type {
  BOMResult,
  BreakerRow,
  CableRow,
  FeederRow,
  VoltageDropRow,
  LoadRow,
  ShortCircuitRow,
} from "./types";

export type {
  BOMResult,
  FeederRow,
  CableRow,
  BreakerRow,
  VoltageDropRow,
  LoadRow,
  ShortCircuitRow,
  ReportData,
  ReportOptions,
  ReportSection,
} from "./types";


/**
 * Aggregate BOM rows across every building in the project.
 *
 * Cable lengths fall back to a simple estimate (10 m + 5 m per floor above the
 * ground floor) when individual item lengths are not persisted. Breaker sizes
 * are coerced from the string rating stored on FloorItem.
 */
export function aggregateBOM(project: Project): BOMResult {
  const cableMap = new Map<string, { size: number; cores: number; phase: number; description: string; length: number; count: number }>();
  const breakerMap = new Map<number, { rating: number; count: number }>();
  // NEMA/NEC projects label cables with AWG/kcmil trade sizes (display only).
  const sizeLabel = (mm2: number) =>
    project.calculationStandard === 'NEMA' ? awgLabel(mm2) : `${mm2} mm²`;

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      for (const item of fd.items) {
        const cableSize = parseMm2(item.cableSize) ?? 4;
        const breakerAmps = parseBreakerAmps(item.breakerSize);
        const length = getItemCableLength(item, fd.floorNumber);
        const phases = resolveItemPhases(item);
        const cores = phases === 1 ? 2 : 4;
        const key = `${cores}C-${cableSize}`;
        const description = `${cores}C × ${sizeLabel(cableSize)}`;

        const cableEntry = cableMap.get(key) ?? {
          size: cableSize,
          cores,
          phase: phases,
          description,
          length: 0,
          count: 0,
        };
        cableEntry.length += length;
        cableEntry.count += 1;
        cableMap.set(key, cableEntry);

        const breakerEntry = breakerMap.get(breakerAmps) ?? { rating: breakerAmps, count: 0 };
        breakerEntry.count += 1;
        breakerMap.set(breakerAmps, breakerEntry);
      }
    }
    for (const bl of bldg.buildingLoads ?? []) {
      const cableSize = parseMm2(bl.cableSize) ?? 4;
      const breakerAmps = parseBreakerAmps((bl as unknown as { breakerSize?: string }).breakerSize || '32A');
      const length = getBuildingLoadCableLength(bl);
      const phases = bl.loadLibraryItem?.phase ?? 3;
      const cores = phases === 1 ? 2 : 4;
      const key = `${cores}C-${cableSize}`;
      const description = `${cores}C × ${sizeLabel(cableSize)}`;

      const cableEntry = cableMap.get(key) ?? {
        size: cableSize,
        cores,
        phase: phases,
        description,
        length: 0,
        count: 0,
      };
      cableEntry.length += length;
      cableEntry.count += 1;
      cableMap.set(key, cableEntry);

      const breakerEntry = breakerMap.get(breakerAmps) ?? { rating: breakerAmps, count: 0 };
      breakerEntry.count += 1;
      breakerMap.set(breakerAmps, breakerEntry);
    }
  }

  const cables = Array.from(cableMap.values())
    .sort((a, b) => a.cores - b.cores || a.size - b.size)
    .map(({ size, cores, phase, description, length, count }) => ({
      size,
      cores,
      phase,
      description,
      rating: 0,
      count,
      totalLength: Math.round(length),
    }));

  const breakers = Array.from(breakerMap.values())
    .sort((a, b) => a.rating - b.rating)
    .map(({ rating, count }) => ({
      size: 0,
      rating,
      count,
      totalLength: 0,
    }));

  return { cables, breakers };
}

export function resolveBreakerDisplayName(
  savedModel: string | undefined | null,
  feederModel: string | undefined | null
): string {
  const defaultModel = feederModel || 'Standard Circuit Breaker';
  if (!savedModel) return defaultModel;
  if (savedModel.includes(defaultModel)) return savedModel;
  const parts = savedModel.split(/\s+/);
  if (parts.length > 1 && defaultModel.startsWith(parts[0])) {
    return savedModel;
  }
  return `${defaultModel} (${savedModel})`;
}

export interface DetailedCableBOMItem {
  key: string;
  sizeNum: number;
  cores: number;
  phase: number;
  sizeLabel: string;
  length: number;
  count: number;
}

export interface DetailedBreakerBOMItem {
  ratingAmps: number;
  ratingLabel: string;
  category: 'ACB' | 'MCCB' | 'MCB';
  poles: string;
  model: string;
  manufacturer: string;
  sourcingStatus: string;
  fallbackType?: FallbackType;
  genericSpec?: GenericBreakerSpec;
  count: number;
}

export interface DetailedBOMResult {
  allItems: (FloorItem & { floor: number; building: string })[];
  cableRows: DetailedCableBOMItem[];
  totalCableLength: number;
  breakerRows: DetailedBreakerBOMItem[];
  totalBreakers: number;
  annexItems: DetailedBreakerBOMItem[];
}

/**
 * Comprehensive Bill of Materials aggregation across all distribution tiers:
 * - Main Incomer breaker & supply cables
 * - Sub-panel SMDB riser breakers & feeder cables
 * - All MDB distribution feeders & building mechanical loads
 * - Individual sub-panel apartment & branch circuit breakers
 */
export function aggregateDetailedBOM(
  project: Project,
  findBreaker?: FindBreaker,
  breakerSettings?: any[],
  buildingId?: string
): DetailedBOMResult {
  const safeFindBreaker: FindBreaker =
    findBreaker ||
    createFindBreaker(
      [],
      {
        ACB: project.defaultAcbFamilyId ?? undefined,
        MCCB: project.defaultMccbFamilyId ?? undefined,
        MCB: project.defaultMcbFamilyId ?? undefined,
      },
      project.preferredManufacturer
    );

  const allItems: (FloorItem & { floor: number; building: string })[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        allItems.push({
          ...item,
          floor: fd.floorNumber,
          building: b.name,
        });
      }
    }
    for (const bl of b.buildingLoads || []) {
      if (!bl.loadLibraryItem) continue;
      allItems.push({
        id: bl.id,
        name: bl.loadLibraryItem.name,
        type: 'SERVICE_PANEL' as const,
        calculatedConnectedLoad: bl.loadLibraryItem.power * bl.quantity,
        calculatedMaxDemand: bl.loadLibraryItem.power * bl.quantity,
        calculatedCurrent: 0,
        breakerSize: (bl as any).breakerSize || '32A',
        cableSize: bl.cableSize || '4 mm²',
        voltageDrop: 0,
        cableLength: getBuildingLoadCableLength(bl),
        floor: 0,
        building: b.name,
      });
    }
  }

  // Aggregate Cables differentiating 2-core (1-phase) and 4-core (3-phase)
  const cableBOM: Record<string, DetailedCableBOMItem> = {};

  const addCable = (
    cableSize: number,
    isThreePhase: boolean,
    length: number,
    runs: number = 1
  ) => {
    if (!cableSize || cableSize <= 0) return;
    const cores = isThreePhase ? 4 : 2;
    const key = `${cores}C-${cableSize}`;
    const sizeLabel = `${cores}C × ${formatCableSizeFor(cableSize, project.calculationStandard)}`;
    if (!cableBOM[key]) {
      cableBOM[key] = {
        key,
        sizeNum: cableSize,
        cores,
        phase: isThreePhase ? 3 : 1,
        sizeLabel,
        length: 0,
        count: 0,
      };
    }
    cableBOM[key].length += length * (runs || 1);
    cableBOM[key].count += (runs || 1);
  };

  // Aggregate Breakers with real catalog & fallback model details
  const breakerMap = new Map<string, DetailedBreakerBOMItem>();

  for (const bldg of project.buildings) {
    if (buildingId && bldg.id !== buildingId) continue;
    const {
      mdbFeeders,
      smdbFloorNumbers,
      smdbFeeders,
      mainIncomerSettings,
      mainBreakerIn,
      mainCableSize,
      mainParallelRuns,
    } = computeFeeders(bldg, project, safeFindBreaker);

    // 1. Process Main Incoming Supply Feeder Cable
    if (mainCableSize > 0) {
      const incomerLen = bldg.incomerCableLength ?? 20;
      addCable(mainCableSize, true, incomerLen, mainParallelRuns);
    }

    const processFeeder = (f: {
      breakerSize: number;
      isThreePhase: boolean;
      type: string;
      breakerModel: string;
      manufacturer: string | null;
      fallbackType?: FallbackType;
      genericSpec?: GenericBreakerSpec;
    }) => {
      const modelUpper = (f.breakerModel || '').toUpperCase();
      const isMcbModel =
        modelUpper.includes('MCB') ||
        modelUpper.includes('S200') ||
        modelUpper.includes('FAZ') ||
        modelUpper.includes('IC60') ||
        modelUpper.includes('C60');
      const isMccbModel =
        modelUpper.includes('MCCB') ||
        modelUpper.includes('NSX') ||
        modelUpper.includes('XT') ||
        modelUpper.includes('DPX') ||
        modelUpper.includes('NZM');
      const isAcbModel =
        modelUpper.includes('ACB') ||
        modelUpper.includes('MASTERPACT') ||
        modelUpper.includes('EVAL') ||
        modelUpper.includes('AIR');

      const cat: 'ACB' | 'MCCB' | 'MCB' =
        isAcbModel || f.breakerSize >= 630
          ? 'ACB'
          : isMcbModel
          ? 'MCB'
          : isMccbModel
          ? 'MCCB'
          : f.type === 'INCOMER'
          ? 'MCCB'
          : f.breakerSize > 63
          ? 'MCCB'
          : 'MCB';
      const polesStr = f.isThreePhase ? '3P' : '1P';
      const key = `${f.breakerSize}-${cat}-${polesStr}-${f.breakerModel}`;

      const sourcingStatus =
        f.fallbackType === 'SAME_FAMILY' || !f.fallbackType
          ? 'Catalog Match'
          : f.fallbackType === 'OTHER_FAMILY'
          ? 'Alternative Family'
          : f.fallbackType === 'OTHER_BRAND'
          ? `Alt Brand (${f.manufacturer || 'Standard'})`
          : 'Generic Spec';

      const existing = breakerMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        breakerMap.set(key, {
          ratingAmps: f.breakerSize,
          ratingLabel: `${f.breakerSize}A`,
          category: cat,
          poles: polesStr,
          model: f.breakerModel,
          manufacturer: f.manufacturer || 'Standard',
          sourcingStatus,
          fallbackType: f.fallbackType,
          genericSpec: f.genericSpec,
          count: 1,
        });
      }
    };

    // 2. Process Main Incomer Breaker
    const incomerSaved = breakerSettings?.find(
      (s: any) =>
        s.breakerId === `${project.id}-main-incomer-${bldg.id}` ||
        s.breakerId === `main-incomer-${bldg.id}` ||
        s.breakerId === `${project.id}-Main Incomer-${bldg.id}` ||
        (project.buildings.length === 1 && (
          s.breakerId === `${project.id}-main-incomer` ||
          s.breakerId === `${project.id}-Main Incomer` ||
          s.breakerId === 'main-incomer' ||
          s.breakerId === 'Main Incomer'
        ))
    );
    const effectiveIncomerModel = resolveBreakerDisplayName(
      incomerSaved?.model,
      mainIncomerSettings.model || `${mainIncomerSettings.manufacturer || 'Standard'} Incomer ACB`
    );

    processFeeder({
      breakerSize: mainBreakerIn,
      isThreePhase: true,
      type: 'INCOMER',
      breakerModel: effectiveIncomerModel,
      manufacturer: mainIncomerSettings.manufacturer || 'Standard',
      fallbackType: mainIncomerSettings.isGeneric ? 'GENERIC_SPEC' : 'SAME_FAMILY',
      genericSpec: mainIncomerSettings.isGeneric
        ? {
            category: mainBreakerIn >= 630 ? 'ACB' : 'MCCB',
            ratingAmps: mainBreakerIn,
            requiredIcuKa: 50,
            poles: 3,
            tripUnitType: 'Electronic LSI / LSIG (Adjustable Ir, Isd, tsd, Ii)',
            standard: 'IEC 60947-2',
            procurementNotes: `Procure ${mainBreakerIn}A ${mainBreakerIn >= 630 ? 'ACB' : 'MCCB'} 3P incomer breaker compliant with IEC 60947-2.`,
          }
        : undefined,
    });

    for (const f of mdbFeeders) {
      const stableId = `${project.id}-${f.name}`;
      const saved = breakerSettings?.find((s: any) => s.breakerId === stableId);
      const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
      processFeeder({ ...f, breakerModel: effectiveModel });

      // Add to Cable BOM
      let cableLen = 20;
      if (f.type === 'SMDB') {
        const matchFloor = f.floorDesignId
          ? bldg.floorDesigns.find((fd) => fd.id === f.floorDesignId)
          : undefined;
        cableLen = getRiserCableLength(matchFloor, matchFloor?.floorNumber ?? 1);
      } else if (f.buildingLoadId) {
        const matchBl = (bldg.buildingLoads || []).find((bl) => bl.id === f.buildingLoadId);
        cableLen = matchBl ? getBuildingLoadCableLength(matchBl) : 20;
      } else if (f.itemId) {
        const matchFd = bldg.floorDesigns.find((fd) => fd.items.some((it) => it.id === f.itemId));
        const matchItem = matchFd?.items.find((it) => it.id === f.itemId);
        cableLen = matchItem && matchFd ? getItemCableLength(matchItem, matchFd.floorNumber) : 20;
      }
      addCable(f.cableSize, f.isThreePhase, cableLen, f.parallelRuns);
    }

    for (const fl of smdbFloorNumbers) {
      const matchFd = bldg.floorDesigns.find((fd) => fd.floorNumber === fl);
      for (const f of smdbFeeders(fl)) {
        const stableId = `${project.id}-${f.name}`;
        const saved = breakerSettings?.find((s: any) => s.breakerId === stableId);
        const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
        processFeeder({ ...f, breakerModel: effectiveModel });

        const matchItem = matchFd?.items.find((it) => it.id === f.itemId || f.name.includes(it.name));
        const cableLen = matchItem ? getItemCableLength(matchItem, fl) : (10 + (fl - 1) * 5);
        addCable(f.cableSize, f.isThreePhase, cableLen, f.parallelRuns);
      }
    }
  }

  const cableRows = Object.values(cableBOM).sort(
    (a, b) => a.cores - b.cores || a.sizeNum - b.sizeNum
  );
  const totalCableLength = Math.round(cableRows.reduce((s, e) => s + e.length, 0));

  const breakerRows = Array.from(breakerMap.values()).sort(
    (a, b) => a.ratingAmps - b.ratingAmps || a.category.localeCompare(b.category) || a.model.localeCompare(b.model)
  );
  const totalBreakers = breakerRows.reduce((sum, b) => sum + b.count, 0);
  const annexItems = breakerRows.filter((b) => b.fallbackType || b.genericSpec);

  return {
    allItems,
    cableRows,
    totalCableLength,
    breakerRows,
    totalBreakers,
    annexItems,
  };
}

/**
 * Aggregate MDB feeder rows across all buildings.
 *
 * Reuses computeFeeders so sizing matches the breaker-schedule page exactly.
 * For floors with sub-panels a single SMDB summary row is emitted; per-apartment
 * feeders are also returned for the printable MDB schedule.
 */
export function aggregateFeederRows(
  project: Project,
  findBreaker: FindBreaker
): FeederRow[] {
  const rows: FeederRow[] = [];
  let index = 0;

  for (const bldg of project.buildings) {
    const { mdbFeeders, smdbFeeders, smdbFloorNumbers } = computeFeeders(
      bldg,
      project,
      findBreaker
    );

    for (const f of mdbFeeders) {
      index += 1;
      const floor = feederFloor(f.name);
      rows.push({
        index,
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor,
        feeder: f.name,
        type: f.type,
        demandKw: currentToKw(f.current, project, f.isThreePhase),
        current: f.current,
        breakerAmps: f.breakerSize,
        cableMm2: f.cableSize,
        breakerModel: f.breakerModel,
        isThreePhase: f.isThreePhase,
        isSubPanel: f.type === 'SMDB',
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        index += 1;
        rows.push({
          index,
          buildingName: bldg.name,
          buildingId: bldg.id,
          floor: floorNumber,
          feeder: f.name,
          type: f.type,
          demandKw: currentToKw(f.current, project, f.isThreePhase),
          current: f.current,
          breakerAmps: f.breakerSize,
          cableMm2: f.cableSize,
          breakerModel: f.breakerModel,
          isThreePhase: f.isThreePhase,
          isSubPanel: false,
        });
      }
    }
  }

  return rows;
}

/**
 * Aggregate cable schedule rows across all buildings.
 *
 * Matches the tag generation in src/app/(app)/cable-schedule/page.tsx:
 * circuit = "F{floor}-{A,B,C,...}" and cable name = "Wf{floor}{letter}".
 */
export function aggregateCableRows(project: Project): CableRow[] {
  const rows: CableRow[] = [];

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const phases = resolveItemPhases(item);
        rows.push({
          circuit: `F${fd.floorNumber}-${letter.toUpperCase()}`,
          buildingName: bldg.name,
          floor: fd.floorNumber,
          phase: phases,
          current: item.calculatedCurrent || 0,
          breakerAmps: parseBreakerAmps(item.breakerSize),
          cableMm2: parseMm2(item.cableSize) ?? 4,
          method: (item.installMethod as string | undefined) || 'C',
          insulation: (item.cableInsulation as 'PVC' | 'XLPE' | undefined) || 'XLPE',
          material: (item.cableMaterial as 'copper' | 'aluminum' | undefined) || 'copper',
        });
      });
    }
  }

  return rows;
}

export interface BuildingIncomerResolution {
  breakerRating: number;
  breakerCategory: 'ACB' | 'MCCB';
  breakerModel: string;
  cableSize: number;
  parallelRuns: number;
  cableSpec: string;
  cableIz?: number;
  designCurrent: number;
  isUnderProtected?: boolean;
}

/**
 * Resolves a building's main incomer breaker and feeder cable according to the
 * Breaker Schedule (single source of truth).
 *
 * Consults computeFeeders with the real equipment catalog, applies the matched
 * frame size and Iz >= In cable sizing, and incorporates any persisted user overrides
 * from the Breaker Schedule.
 */
export function resolveBuildingIncomer(
  building: Building,
  project: Project,
  findBreaker: FindBreaker,
  breakerSettings?: any[]
): BuildingIncomerResolution {
  const {
    mainIncomerSettings,
    mainBreakerIn,
    mainCableSize,
    mainParallelRuns,
    mainCableIz,
    mainCableUnderProtected,
    mainIncomerCurrent,
  } = computeFeeders(building, project, findBreaker);

  // Check persisted user overrides from Step 2 (/breaker-schedule)
  const incomerSaved = breakerSettings?.find(
    (s: any) =>
      s.breakerId === `${project.id}-main-incomer-${building.id}` ||
      s.breakerId === `main-incomer-${building.id}` ||
      s.breakerId === `${project.id}-Main Incomer-${building.id}` ||
      (project.buildings.length === 1 && (
        s.breakerId === `${project.id}-main-incomer` ||
        s.breakerId === `${project.id}-Main Incomer` ||
        s.breakerId === 'main-incomer' ||
        s.breakerId === 'Main Incomer'
      ))
  );

  const savedFrame = incomerSaved?.frameSize ? parseInt(incomerSaved.frameSize, 10) : NaN;
  const effectiveIn = !isNaN(savedFrame) && savedFrame > 0 ? savedFrame : mainBreakerIn;
  const effectiveModel =
    incomerSaved?.model ||
    mainIncomerSettings.model ||
    `Main Incomer ${mainIncomerSettings.category ?? 'MCCB'}`;
  const category = (effectiveIn >= 630 ? 'ACB' : 'MCCB') as 'ACB' | 'MCCB';

  const cableSpec =
    mainParallelRuns > 1
      ? `${mainParallelRuns} × (4C × ${formatCableSizeFor(mainCableSize, project.calculationStandard)})`
      : `4C × ${formatCableSizeFor(mainCableSize, project.calculationStandard)}`;

  return {
    breakerRating: effectiveIn,
    breakerCategory: category,
    breakerModel: effectiveModel,
    cableSize: mainCableSize,
    parallelRuns: mainParallelRuns,
    cableSpec,
    cableIz: mainCableIz,
    designCurrent: mainIncomerCurrent || mainIncomerSettings.ir,
    isUnderProtected: effectiveIn > (mainCableIz ?? Infinity) || mainCableUnderProtected,
  };
}

/**
 * Aggregate breaker schedule rows across all buildings.
 *
 * Mirrors the flat breaker list construction in
 * src/app/(app)/breaker-schedule/page.tsx so the report and breaker page agree.
 */
export function aggregateBreakerRows(
  project: Project,
  findBreaker: FindBreaker
): BreakerRow[] {
  const rows: BreakerRow[] = [];

  for (const bldg of project.buildings) {
    const {
      mdbFeeders,
      smdbFeeders,
      smdbFloorNumbers,
      mainIncomerSettings,
      mainBreakerIn,
      mainCableSize,
      mainParallelRuns,
      mainIncomerCurrent,
    } = computeFeeders(bldg, project, findBreaker);

    // 1. Main Incomer Row
    rows.push({
      feeder: project.buildings.length > 1 ? `${bldg.name} – Main Incomer` : 'Main Incomer',
      buildingName: bldg.name,
      buildingId: bldg.id,
      floor: 0,
      type: 'INCOMER',
      current: mainIncomerCurrent || mainIncomerSettings.ir,
      breakerAmps: mainBreakerIn,
      cableMm2: mainCableSize,
      parallelRuns: mainParallelRuns,
      breakerModel: mainIncomerSettings.model || 'Main Incomer ACB',
      isThreePhase: true,
    });

    const feederFloorNum = (feederName: string | null | undefined): number => {
      if (!feederName) return 0;
      const m = String(feederName).match(/^F(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    for (const f of mdbFeeders) {
      rows.push({
        feeder: f.name,
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor: feederFloorNum(f.name),
        type: f.type,
        current: f.current,
        breakerAmps: f.breakerSize,
        cableMm2: f.cableSize,
        parallelRuns: f.parallelRuns,
        breakerModel: f.breakerModel,
        isThreePhase: f.isThreePhase,
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        rows.push({
          feeder: f.name,
          buildingName: bldg.name,
          buildingId: bldg.id,
          floor: floorNumber,
          type: f.type,
          current: f.current,
          breakerAmps: f.breakerSize,
          cableMm2: f.cableSize,
          parallelRuns: f.parallelRuns,
          breakerModel: f.breakerModel,
          isThreePhase: f.isThreePhase,
        });
      }
    }
  }

  return rows;
}

/**
 * Aggregate voltage-drop rows across all buildings.
 *
 * Uses the same assumptions as the cable schedule: default length, install
 * method, and insulation. VD is recomputed with calculateVoltageDrop so the
 * report reflects the saved cable size and project limits can be applied later.
 */
export function aggregateVoltageDropRows(project: Project): VoltageDropRow[] {
  const rows: VoltageDropRow[] = [];

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      let idx = 0;
      for (const item of fd.items) {
        const letter = String.fromCharCode(97 + idx);
        idx += 1;
        const phases = resolveItemPhases(item);
        const isThreePhase = phases === 3;
        // Shared helper: parses "2 × 240 mm²" correctly (a raw parseFloat read
        // "2"), applies parallel runs + conductor material, and evaluates
        // single-phase circuits against Uo = U_LL/√3 — the raw call divided
        // the L-N drop by U_LL, understating every 1-phase row by √3.
        const vd = computeItemVoltageDrop({
          current: item.calculatedCurrent,
          lengthMeters: item.cableLength ?? 10 + (fd.floorNumber - 1) * 5,
          cableSizeInput: item.cableSize,
          powerFactor: project.powerFactor,
          isThreePhase,
          systemVoltageLL: project.voltage,
          material: (item.cableMaterial as 'copper' | 'aluminum' | undefined) || 'copper',
        });
        if (!vd) continue; // no computable cable data — skip rather than fabricate

        const isLighting =
          item.type === 'APARTMENT' ||
          (item.name || '').toLowerCase().includes('light') ||
          (item.loadLibraryItem?.category || '').toLowerCase().includes('light');
        const limit = isLighting ? project.maxVoltageDropLighting : project.maxVoltageDropPower;
        const status = deriveStatus(vd.dropPercent, limit);

        rows.push({
          circuit: `F${fd.floorNumber}-${letter.toUpperCase()}`,
          buildingName: bldg.name,
          floor: fd.floorNumber,
          current: item.calculatedCurrent,
          cableMm2: parseMm2(item.cableSize) ?? 0,
          lengthMeters: item.cableLength ?? 10 + (fd.floorNumber - 1) * 5,
          voltageDropPercent: vd.dropPercent,
          status,
        });
      }
    }
  }

  return rows;
}

/**
 * Per-item phase count used for cable and voltage-drop schedules.
 * Apartments follow the template; library loads follow loadLibraryItem.phase;
 * manual entries are 3-phase by convention.
 */
function resolveItemPhases(item: FloorItem): number {
  if (item.type === 'APARTMENT') {
    return item.apartmentTemplate?.phases ?? 1;
  }
  if (item.loadLibraryItem) {
    return item.loadLibraryItem.phase;
  }
  return 3;
}

function parseBreakerAmps(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
}

function feederFloor(feederName: string | null | undefined): number {
  if (!feederName) return 0;
  const m = String(feederName).match(/^F(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function currentToKw(current: number, project: Project, isThreePhase: boolean): number {
  // 3-phase: √3·U_LL·I·PF. A 1-phase feeder draws through one winding —
  // kW = Uo·I·PF with Uo = U_LL/√3; the old √3 formula overstated it by 73%.
  if (isThreePhase) {
    return Math.sqrt(3) * (project.voltage / 1000) * current * project.powerFactor;
  }
  return (project.voltage / Math.sqrt(3) / 1000) * current * project.powerFactor;
}

function deriveStatus(dropPercent: number, limit: number): 'OK' | 'WARNING' | 'FAIL' {
  if (dropPercent <= limit) return 'OK';
  if (dropPercent <= limit * 1.2) return 'WARNING';
  return 'FAIL';
}

/**
 * Aggregate Load analysis and phase balancing rows across all buildings.
 */
export function aggregateLoadRows(project: Project): LoadRow[] {
  const rows: LoadRow[] = [];
  const pf = project.powerFactor || 0.85;

  for (const bldg of project.buildings) {
    const allBldgItems = [
      ...bldg.floorDesigns.flatMap((fd) => fd.items),
      ...(bldg.buildingLoads ?? []),
    ];
    const bldgBalance = phaseBalance(allBldgItems as any, project as any);
    const bldgPhaseById = new Map(
      bldgBalance.assignments.filter((a) => a.phaseCount === 1).map((a) => [a.id, a.assignedPhase])
    );

    for (const fd of bldg.floorDesigns) {
      // Phase assignment comes from the SAME balance the panel uses, so the
      // report's L1/L2/L3 columns match the board instead of an independent
      // (floor+index)%3 cycling that disagreed with it.
      const floorBalance = fd.hasFloorSubPanels ? phaseBalance(fd.items, project as never) : null;
      const phaseById = floorBalance
        ? new Map(floorBalance.assignments.filter((a) => a.phaseCount === 1).map((a) => [a.id, a.assignedPhase]))
        : bldgPhaseById;

      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(65 + (idx % 26));
        const phases = resolveItemPhases(item);
        const current = item.calculatedCurrent || 0;
        const maxDemandKw = item.calculatedMaxDemand || (phases === 3
          ? (Math.sqrt(3) * (project.voltage / 1000) * current * pf)
          : ((project.voltage / Math.sqrt(3) / 1000) * current * pf));
        const connectedLoadKw = item.apartmentTemplate
          ? (item.apartmentTemplate.rooms?.reduce((s, r) => s + r.connectedLoad, 0) || 0) / 1000
          : (item.loadLibraryItem?.power ?? maxDemandKw);
        const demandFactor = connectedLoadKw > 0 ? maxDemandKw / connectedLoadKw : 1;
        const maxDemandKva = maxDemandKw / pf;

        let currentL1 = 0;
        let currentL2 = 0;
        let currentL3 = 0;

        if (phases === 3) {
          currentL1 = current;
          currentL2 = current;
          currentL3 = current;
        } else {
          const assigned = item.assignedPhase ?? phaseById.get(item.id) ?? 1;
          if (assigned === 1) currentL1 = current;
          else if (assigned === 2) currentL2 = current;
          else currentL3 = current;
        }

        rows.push({
          buildingName: bldg.name,
          buildingId: bldg.id,
          floor: fd.floorNumber,
          name: `${item.name || 'Load'} (F${fd.floorNumber}-${letter})`,
          type: item.type,
          connectedLoadKw: parseFloat(connectedLoadKw.toFixed(2)),
          demandFactor: parseFloat(demandFactor.toFixed(2)),
          maxDemandKw: parseFloat(maxDemandKw.toFixed(2)),
          maxDemandKva: parseFloat(maxDemandKva.toFixed(2)),
          phase: phases,
          currentL1: parseFloat(currentL1.toFixed(1)),
          currentL2: parseFloat(currentL2.toFixed(1)),
          currentL3: parseFloat(currentL3.toFixed(1)),
          powerFactor: item.loadLibraryItem?.powerFactor || pf,
        });
      });
    }

    // Building mechanical loads — same balance-driven phase columns.
    const blLoads = bldg.buildingLoads ?? [];
    const blBalance = phaseBalance(blLoads, project as never);
    const blPhaseById = new Map(
      blBalance.assignments.filter((a) => a.phaseCount === 1).map((a) => [a.id, a.assignedPhase])
    );

    for (const bl of blLoads) {
      const lib = bl.loadLibraryItem;
      const powerKw = (lib?.power || 0) * (bl.quantity || 1);
      const current = (lib?.runningCurrent || 0) * (bl.quantity || 1);
      const phases = lib?.phase || 3;
      const maxDemandKw = powerKw * (lib?.demandFactor || 1);
      const maxDemandKva = maxDemandKw / pf;

      let currentL1 = 0;
      let currentL2 = 0;
      let currentL3 = 0;
      if (phases === 3) {
        currentL1 = current;
        currentL2 = current;
        currentL3 = current;
      } else {
        const assigned = blPhaseById.get(bl.id) ?? 1;
        if (assigned === 1) currentL1 = current;
        else if (assigned === 2) currentL2 = current;
        else currentL3 = current;
      }

      rows.push({
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor: 0,
        name: lib?.name || 'Central Load',
        type: lib?.category || 'CENTRAL_LOAD',
        connectedLoadKw: parseFloat(powerKw.toFixed(2)),
        demandFactor: lib?.demandFactor || 1,
        maxDemandKw: parseFloat(maxDemandKw.toFixed(2)),
        maxDemandKva: parseFloat(maxDemandKva.toFixed(2)),
        phase: phases,
        currentL1: parseFloat(currentL1.toFixed(1)),
        currentL2: parseFloat(currentL2.toFixed(1)),
        currentL3: parseFloat(currentL3.toFixed(1)),
        powerFactor: lib?.powerFactor || pf,
      });
    }
  }

  return rows;
}

/**
 * Aggregate Short-Circuit fault level rows across all buildings and distribution boards.
 */
export function aggregateShortCircuitRows(
  project: Project,
  findBreaker: FindBreaker
): ShortCircuitRow[] {
  const rows: ShortCircuitRow[] = [];

  for (const bldg of project.buildings) {
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders, transformerIscKa, transformerSizeKva, mainBreakingCapacityKa } = computeFeeders(
      bldg,
      project,
      findBreaker
    );

    // Main Incomer at MDB bus — Icu of the ACTUAL selected device (the old
    // hardcoded "65 kA typical ACB" could mark a failing device SAFE while the
    // breaker-schedule page flagged it).
    const incomerIcu = mainBreakingCapacityKa ?? 65;
    rows.push({
      feeder: project.buildings.length > 1 ? `${bldg.name} – Main Incomer (MDB Bus)` : 'Main Incomer (MDB Bus)',
      buildingName: bldg.name,
      buildingId: bldg.id,
      floor: 0,
      type: 'INCOMER',
      cableLengthM: 0,
      cableSizeMm2: 0,
      threePhaseIscKa: transformerIscKa,
      twoPhaseIscKa: parseFloat((transformerIscKa * 0.866).toFixed(2)),
      breakerIcuKa: incomerIcu,
      transformerKva: transformerSizeKva,
      status: scStatus(incomerIcu, transformerIscKa),
    });

    for (const f of mdbFeeders) {
      const isc = f.faultCurrentKa || transformerIscKa;
      const icu = f.breakingCapacityKa ?? fallbackIcuKa(f.breakerSize);
      rows.push({
        feeder: f.name,
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor: feederFloor(f.name),
        type: f.type,
        cableLengthM: 0,
        cableSizeMm2: f.cableSize,
        threePhaseIscKa: isc,
        twoPhaseIscKa: parseFloat((isc * 0.866).toFixed(2)),
        breakerIcuKa: icu,
        transformerKva: transformerSizeKva,
        status: scStatus(icu, isc),
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        const isc = f.faultCurrentKa || transformerIscKa;
        const icu = f.breakingCapacityKa ?? fallbackIcuKa(f.breakerSize);
        rows.push({
          feeder: f.name,
          buildingName: bldg.name,
          buildingId: bldg.id,
          floor: floorNumber,
          type: f.type,
          cableLengthM: 0,
          cableSizeMm2: f.cableSize,
          threePhaseIscKa: isc,
          twoPhaseIscKa: parseFloat((isc * 0.866).toFixed(2)),
          breakerIcuKa: icu,
          transformerKva: transformerSizeKva,
          status: scStatus(icu, isc),
        });
      }
    }
  }

  return rows;
}

/** Tiered typical-Icu estimate used only when a feeder has no catalog device. */
function fallbackIcuKa(breakerSize: number): number {
  return breakerSize >= 630 ? 65 : breakerSize >= 100 ? 36 : 10;
}

function scStatus(icuKa: number, iscKa: number): 'SAFE' | 'MARGINAL' | 'OVERLOAD' {
  if (icuKa >= iscKa) return 'SAFE';
  if (icuKa >= iscKa * 0.8) return 'MARGINAL';
  return 'OVERLOAD';
}

// Re-export equipment helpers for use by callers that build the injected finder.
export type { EquipmentItem, FindBreaker };

