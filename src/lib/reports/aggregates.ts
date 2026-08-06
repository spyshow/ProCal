import { calculateVoltageDrop } from "@/lib/calculations/cables";
import { computeFeeders, type EquipmentItem, type FindBreaker } from "@/lib/calculations/feeders";
import type { FloorItem, Project } from "@/types";
import type {
  BOMResult,
  BreakerRow,
  CableRow,
  FeederRow,
  VoltageDropRow,
} from "./types";

export type {
  BOMResult,
  FeederRow,
  CableRow,
  BreakerRow,
  VoltageDropRow,
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
  const cableMap = new Map<number, { size: number; length: number; count: number }>();
  const breakerMap = new Map<number, { rating: number; count: number }>();

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      for (const item of fd.items) {
        const cableSize = parseFloat(item.cableSize) || 4;
        const breakerAmps = parseBreakerAmps(item.breakerSize);
        const length = item.cableLength ?? 10 + (fd.floorNumber - 1) * 5;

        const cableEntry = cableMap.get(cableSize) ?? { size: cableSize, length: 0, count: 0 };
        cableEntry.length += length;
        cableEntry.count += 1;
        cableMap.set(cableSize, cableEntry);

        const breakerEntry = breakerMap.get(breakerAmps) ?? { rating: breakerAmps, count: 0 };
        breakerEntry.count += 1;
        breakerMap.set(breakerAmps, breakerEntry);
      }
    }
  }

  const cables = Array.from(cableMap.values())
    .sort((a, b) => a.size - b.size)
    .map(({ size, length, count }) => ({
      size,
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
        demandKw: currentToKw(f.current, project),
        current: f.current,
        breakerAmps: f.breakerSize,
        cableMm2: f.cableSize,
        breakerModel: f.breakerModel,
        isThreePhase: f.type !== 'APARTMENT',
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
          demandKw: currentToKw(f.current, project),
          current: f.current,
          breakerAmps: f.breakerSize,
          cableMm2: f.cableSize,
          breakerModel: f.breakerModel,
          isThreePhase: f.type !== 'APARTMENT',
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
          current: item.calculatedCurrent,
          breakerAmps: parseBreakerAmps(item.breakerSize),
          cableMm2: parseFloat(item.cableSize) || 4,
          method: (item.installMethod as string | undefined) || 'C',
          insulation: (item.cableInsulation as 'PVC' | 'XLPE' | undefined) || 'XLPE',
        });
      });
    }
  }

  return rows;
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
    const { mdbFeeders, smdbFeeders, smdbFloorNumbers } = computeFeeders(
      bldg,
      project,
      findBreaker
    );

    const feederFloor = (feederName: string): number => {
      const m = feederName.match(/^F(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    for (const f of mdbFeeders) {
      rows.push({
        feeder: f.name,
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor: feederFloor(f.name),
        type: f.type,
        current: f.current,
        breakerAmps: f.breakerSize,
        cableMm2: f.cableSize,
        breakerModel: f.breakerModel,
        isThreePhase: f.type !== 'APARTMENT',
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
          breakerModel: f.breakerModel,
          isThreePhase: f.type !== 'APARTMENT',
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
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const length = item.cableLength ?? 10 + (fd.floorNumber - 1) * 5;
        const cableSize = parseFloat(item.cableSize) || 4;
        const phases = resolveItemPhases(item);
        const isThreePhase = phases === 3;
        const systemVoltage = project.voltage === 400 ? 400 : 230;

        const vd = calculateVoltageDrop(
          item.calculatedCurrent,
          length,
          cableSize,
          project.powerFactor,
          isThreePhase,
          systemVoltage
        );

        const limit = item.type === 'APARTMENT' ? project.maxVoltageDropLighting : project.maxVoltageDropPower;
        const status = deriveStatus(vd.dropPercent, limit);

        rows.push({
          circuit: `F${fd.floorNumber}-${letter.toUpperCase()}`,
          buildingName: bldg.name,
          floor: fd.floorNumber,
          current: item.calculatedCurrent,
          cableMm2: cableSize,
          lengthMeters: length,
          voltageDropPercent: vd.dropPercent,
          status,
        });
      });
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

function parseBreakerAmps(value: string): number {
  return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
}

function feederFloor(feederName: string): number {
  const m = feederName.match(/^F(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function currentToKw(current: number, project: Project): number {
  // kW = sqrt(3) * V * I * PF / 1000
  return (Math.sqrt(3) * (project.voltage / 1000) * current * project.powerFactor);
}

function deriveStatus(dropPercent: number, limit: number): 'OK' | 'WARNING' | 'FAIL' {
  if (dropPercent <= limit) return 'OK';
  if (dropPercent <= limit * 1.2) return 'WARNING';
  return 'FAIL';
}

// Re-export equipment helpers for use by callers that build the injected finder.
export type { EquipmentItem, FindBreaker };
