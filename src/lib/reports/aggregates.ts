import {
  calculateVoltageDrop,
  parseMm2,
  getItemCableLength,
  getBuildingLoadCableLength,
} from "@/lib/calculations/cables";
import { computeFeeders, type EquipmentItem, type FindBreaker } from "@/lib/calculations/feeders";
import type { FloorItem, Project } from "@/types";
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

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      for (const item of fd.items) {
        const cableSize = parseMm2(item.cableSize) ?? 4;
        const breakerAmps = parseBreakerAmps(item.breakerSize);
        const length = getItemCableLength(item, fd.floorNumber);
        const phases = resolveItemPhases(item);
        const cores = phases === 1 ? 2 : 4;
        const key = `${cores}C-${cableSize}`;
        const description = `${cores}C × ${cableSize} mm²`;

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
      const description = `${cores}C × ${cableSize} mm²`;

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
      breakerModel: mainIncomerSettings.model || 'Main Incomer ACB',
      isThreePhase: true,
    });

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

/**
 * Aggregate Load analysis and phase balancing rows across all buildings.
 */
export function aggregateLoadRows(project: Project): LoadRow[] {
  const rows: LoadRow[] = [];
  const pf = project.powerFactor || 0.85;

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
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

        // Phase current distribution
        let currentL1 = 0;
        let currentL2 = 0;
        let currentL3 = 0;

        if (phases === 3) {
          currentL1 = current;
          currentL2 = current;
          currentL3 = current;
        } else {
          // Assign based on floor/item phase cycling
          const phaseAssign = (fd.floorNumber + idx) % 3;
          if (phaseAssign === 0) currentL1 = current;
          else if (phaseAssign === 1) currentL2 = current;
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
          powerFactor: pf,
        });
      });
    }

    for (const bl of bldg.buildingLoads ?? []) {
      const powerKw = bl.loadLibraryItem?.power || 0;
      const current = bl.loadLibraryItem?.runningCurrent || 0;
      const phases = bl.loadLibraryItem?.phase || 3;
      const maxDemandKw = powerKw * (bl.loadLibraryItem?.demandFactor || 1);
      const maxDemandKva = maxDemandKw / pf;

      rows.push({
        buildingName: bldg.name,
        buildingId: bldg.id,
        floor: 0,
        name: bl.loadLibraryItem?.name || 'Central Load',
        type: bl.loadLibraryItem?.category || 'CENTRAL_LOAD',
        connectedLoadKw: parseFloat(powerKw.toFixed(2)),
        demandFactor: bl.loadLibraryItem?.demandFactor || 1,
        maxDemandKw: parseFloat(maxDemandKw.toFixed(2)),
        maxDemandKva: parseFloat(maxDemandKva.toFixed(2)),
        phase: phases,
        currentL1: parseFloat(current.toFixed(1)),
        currentL2: parseFloat((phases === 3 ? current : 0).toFixed(1)),
        currentL3: parseFloat((phases === 3 ? current : 0).toFixed(1)),
        powerFactor: bl.loadLibraryItem?.powerFactor || pf,
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
    const { mdbFeeders, smdbFloorNumbers, smdbFeeders, transformerIscKa } = computeFeeders(
      bldg,
      project,
      findBreaker
    );

    // Main Incomer at MDB bus
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
      breakerIcuKa: 65, // Typical ACB Icu
      status: 'SAFE',
    });

    for (const f of mdbFeeders) {
      const isc = f.faultCurrentKa || transformerIscKa;
      const icu = f.breakerSize >= 630 ? 65 : f.breakerSize >= 100 ? 36 : 10;
      const status = icu >= isc ? 'SAFE' : icu >= isc * 0.8 ? 'MARGINAL' : 'OVERLOAD';

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
        status,
      });
    }

    for (const floorNumber of smdbFloorNumbers) {
      for (const f of smdbFeeders(floorNumber)) {
        const isc = f.faultCurrentKa || transformerIscKa;
        const icu = f.breakerSize >= 630 ? 65 : f.breakerSize >= 100 ? 36 : 10;
        const status = icu >= isc ? 'SAFE' : icu >= isc * 0.8 ? 'MARGINAL' : 'OVERLOAD';

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
          status,
        });
      }
    }
  }

  return rows;
}

// Re-export equipment helpers for use by callers that build the injected finder.
export type { EquipmentItem, FindBreaker };

