import { formatCableSizeFor } from "@/lib/calculations/cables";
import { sizeTransformer } from "@/lib/calculations/loads";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { nextBreakerRating, codeOf, type CodeStandard } from "@/lib/calculations/codes";
import type { BuildingLoad, FloorItem, Project } from "@/types";

interface SLDProject {
  name: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  transformerSize?: number | null;
  calculationStandard?: string | null;
  buildings: {
    id?: string;
    name: string;
    floors: number;
    buildingLoads?: BuildingLoad[] | unknown[];
    floorDesigns: {
      id?: string;
      floorNumber: number;
      hasFloorSubPanels: boolean;
      riserCableSize?: string | null;
      riserCableLength?: number | null;
      riserBreakerSize?: string | null;
      items: {
        id?: string;
        name: string;
        type: string;
        calculatedMaxDemand: number;
        calculatedCurrent: number;
        breakerSize?: string | null;
        cableSize?: string | null;
      }[];
    }[];
  }[];
}

/**
 * Resolves a circuit breaker rating string (e.g. "63A") for SLD diagrams and inspection.
 * - If storedBreakerSize is valid and non-empty, standardizes it with an 'A' suffix.
 * - Otherwise, sizes against standard breaker ratings (IEC/NEC) using the load design current.
 */
export function resolveBreakerRating(
  storedBreakerSize: string | number | null | undefined,
  current: number,
  code: CodeStandard = 'IEC'
): string {
  if (storedBreakerSize != null) {
    const s = String(storedBreakerSize).trim();
    if (s !== '' && s !== 'null' && s !== 'undefined') {
      const numeric = parseFloat(s.replace(/[^\d.]/g, ''));
      if (!isNaN(numeric) && numeric > 0) {
        return `${numeric}A`;
      }
    }
  }
  const rating = nextBreakerRating(Math.max(current || 0, 0), code);
  return `${rating}A`;
}

/**
 * Consolidates multiple floor design entries sharing the same floorNumber
 * into a single unified floor design entry, grouping all floor items together.
 * This guarantees unique floor bus IDs and prevents duplicate node ID crashes in SLD.
 */
export function consolidateFloorDesigns<
  T extends {
    floorNumber: number;
    hasFloorSubPanels: boolean;
    riserBreakerSize?: string | null;
    riserCableSize?: string | null;
    riserCableLength?: number | null;
    items?: unknown[];
  }
>(floorDesigns: T[]): (T & { items: NonNullable<T['items']> })[] {
  const map = new Map<number, T & { items: NonNullable<T['items']> }>();
  const sorted = [...(floorDesigns || [])].sort((a, b) => a.floorNumber - b.floorNumber);
  for (const fd of sorted) {
    const existing = map.get(fd.floorNumber);
    if (existing) {
      existing.hasFloorSubPanels = existing.hasFloorSubPanels || fd.hasFloorSubPanels;
      existing.riserBreakerSize = existing.riserBreakerSize || fd.riserBreakerSize;
      existing.riserCableSize = existing.riserCableSize || fd.riserCableSize;
      existing.riserCableLength = existing.riserCableLength || fd.riserCableLength;
      if (fd.items && Array.isArray(fd.items)) {
        (existing.items as unknown[]).push(...(fd.items as unknown[]));
      }
    } else {
      map.set(fd.floorNumber, {
        ...fd,
        items: [...(((fd.items as unknown[]) || []) as unknown[])] as NonNullable<T['items']>,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.floorNumber - b.floorNumber);
}

export function generateSLD(project: Project | SLDProject): string {
  const lines: string[] = [];
  let mdbBreakerIdx = 0;
  const code = codeOf(project.calculationStandard);

  lines.push(`sld "${project.name} — Single Line Diagram"`);
  lines.push('');

  // Utility source
  lines.push(`grid = utility [label: "${project.voltage}V Utility", voltage: "${project.voltage}V"]`);
  lines.push('');

  // Transformer
  let txKva = project.transformerSize;
  if (!txKva) {
    const allItems = project.buildings?.flatMap((b) => [
      ...(b.floorDesigns?.flatMap((fd) => fd.items || []) || []),
      ...(b.buildingLoads || []),
    ]) || [];
    if (allItems.length > 0) {
      const balance = phaseBalance(allItems as unknown as FloorItem[], project as unknown as Project);
      const pf = project.powerFactor || 0.85;
      const demandKva = balance.totalKw / pf;
      const perPhaseKva: [number, number, number] = [
        balance.phaseKw[0] / pf,
        balance.phaseKw[1] / pf,
        balance.phaseKw[2] / pf,
      ];
      txKva = sizeTransformer(demandKva || 500, 1.2, perPhaseKva);
    } else {
      txKva = 1000;
    }
  }
  lines.push(`xfmr = transformer_dy [label: "Main Transformer", rating: "${txKva} kVA", voltage: "${project.voltage}V"]`);
  lines.push('');

  // MDB bus
  lines.push(`mdb_bus = bus [label: "MDB Bus", voltage: "${project.voltage}V"]`);
  lines.push('');

  // Connections
  lines.push('grid -> xfmr');
  lines.push('xfmr -> mdb_bus');
  lines.push('');

  project.buildings.forEach((bldg, bldgIdx) => {
    const bldgPrefix = bldg.id ? bldg.id.replace(/[^a-zA-Z0-9]/g, '_') : `bldg_${bldgIdx + 1}`;
    const sortedFloors = consolidateFloorDesigns(bldg.floorDesigns);
    for (const fd of sortedFloors) {
      if (fd.items.length === 0) continue;

      // Every floor gets its own bus — this groups MCBs vertically per floor
      const floorBusId = `floor_bus_${bldgPrefix}_${fd.floorNumber}`;
      const floorBreakerId = `floor_bkr_${bldgPrefix}_${fd.floorNumber}`;
      const floorBalance = phaseBalance(fd.items as unknown as FloorItem[], project as unknown as Project);
      const floorDesignCurrent = floorBalance.maxPhaseCurrent || fd.items.reduce((s, i) => s + (i.calculatedCurrent || 0), 0);
      const floorCbRating = resolveBreakerRating(fd.riserBreakerSize, floorDesignCurrent, code);

      if (fd.hasFloorSubPanels) {
        // Sub-panel floor: MDB → floor breaker → floor bus (distribution_board)
        lines.push(`${floorBusId} = distribution_board [label: "${bldg.name} F${fd.floorNumber} Sub-Panel", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "${bldg.name} F${fd.floorNumber} Main", rating: "${floorCbRating}"]`);
      } else {
        // Direct floor: MDB → floor breaker → floor bus
        lines.push(`${floorBusId} = bus [label: "${bldg.name} F${fd.floorNumber}", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "${bldg.name} F${fd.floorNumber}", rating: "${floorCbRating}"]`);
      }

      lines.push(`mdb_bus -> ${floorBreakerId} [label: "${bldg.name} F${fd.floorNumber}"]`);
      lines.push(`${floorBreakerId} -> ${floorBusId}`);
      lines.push('');

      // MCBs connect to floor bus (not MDB bus)
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
        const cableTag = `Wf${fd.floorNumber}${letter}`;
        const bkrId = `bkr_${bldgPrefix}_${fd.floorNumber}_${mdbBreakerIdx++}`;
        const loadId = `load_${bldgPrefix}_${fd.floorNumber}_${letter}`;
        const itemCbRating = resolveBreakerRating(item.breakerSize, item.calculatedCurrent || 0, code);

        lines.push(`${bkrId} = mcb [label: "${itemCbRating}", rating: "${itemCbRating}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`${floorBusId} -> ${bkrId} [cable: "${cableTag}", label: "${formatCableSizeFor(item.cableSize, project.calculationStandard)}"]`);
        lines.push(`${bkrId} -> ${loadId}`);
      });
      lines.push('');
    }

    // Common Building Loads (Elevators, Fire Pumps, Booster Pumps, HVAC)
    const rawLoads = (bldg.buildingLoads || []) as (BuildingLoad & { name?: string; calculatedCurrent?: number; connectedLoad?: number })[];
    if (rawLoads.length > 0) {
      rawLoads.forEach((bload, bloadIdx) => {
        const lib = bload.loadLibraryItem;
        const totalKw = (lib?.power ?? (bload.connectedLoad ? bload.connectedLoad / 1000 : 0)) * (bload.quantity ?? 1);
        const voltageKv = (lib?.voltage ?? project.voltage) / 1000;
        const pf = lib?.powerFactor ?? project.powerFactor ?? 0.85;
        const is3Ph = (lib?.phase ?? 3) === 3;
        const derivedCurrent = is3Ph
          ? totalKw / (Math.sqrt(3) * voltageKv * pf)
          : totalKw / (voltageKv * pf);
        const current = bload.calculatedCurrent || derivedCurrent || 0;
        const loadName = bload.name || lib?.name || `Common Load ${bloadIdx + 1}`;
        const loadTag = `${bldg.name} ${loadName}`;
        const bkrRating = resolveBreakerRating(bload.breakerSize, current, code);
        const safeId = bload.id ? bload.id.replace(/[^a-zA-Z0-9]/g, '_') : `bload_${bldgPrefix}_${bloadIdx + 1}`;
        const bkrId = `bkr_bload_${safeId}`;
        const loadId = `load_bload_${safeId}`;

        lines.push(`${bkrId} = breaker [label: "${bkrRating}", rating: "${bkrRating}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`mdb_bus -> ${bkrId} [label: "${loadName}"]`);
        lines.push(`${bkrId} -> ${loadId} [label: "${formatCableSizeFor(bload.cableSize, project.calculationStandard)}"]`);
      });
      lines.push('');
    }
  });

  return lines.join('\n');
}

export interface SLDPage {
  title: string;
  floors: string;
  buildingName?: string;
  floorNumber?: number;
  dsl: string;
}

/**
 * Generate individual floor diagrams — each page is ONE floor rendered
 * as a vertical diagram, not spread horizontally on the MDB bus.
 */
export function generateSLDPages(project: Project | SLDProject): SLDPage[] {
  const pages: SLDPage[] = [];

  const allFloors: { building: string; fd: typeof project.buildings[0]['floorDesigns'][0] }[] = [];
  for (const bldg of project.buildings) {
    const sortedFloors = consolidateFloorDesigns(bldg.floorDesigns);
    for (const fd of sortedFloors) {
      if (fd.items.length > 0) {
        allFloors.push({ building: bldg.name, fd });
      }
    }
  }

  const hasMultipleBuildings = project.buildings.length > 1;
  const code = codeOf(project.calculationStandard);

  for (let i = 0; i < allFloors.length; i++) {
    const { building, fd } = allFloors[i];
    const floorBalance = phaseBalance(fd.items as unknown as FloorItem[], project as unknown as Project);
    const floorDesignCurrent = floorBalance.maxPhaseCurrent || fd.items.reduce((s, item) => s + (item.calculatedCurrent || 0), 0);
    const floorCbRating = resolveBreakerRating(fd.riserBreakerSize, floorDesignCurrent, code);
    const lines: string[] = [];

    lines.push(`sld "${project.name} — ${building} F${fd.floorNumber} (${i + 1}/${allFloors.length})"`);
    lines.push('');

    // MDB bus (shown as a short bus at the top)
    lines.push(`mdb = bus [label: "MDB Bus", voltage: "${project.voltage}V"]`);
    lines.push('');

    if (fd.hasFloorSubPanels) {
      // Sub-panel floor: MDB → Floor Breaker → Sub-Panel Bus → MCBs
      lines.push(`f${fd.floorNumber}_bkr = breaker [label: "F${fd.floorNumber}", rating: "${floorCbRating}"]`);
      lines.push(`mdb -> f${fd.floorNumber}_bkr`);
      lines.push('');

      lines.push(`f${fd.floorNumber}_bus = distribution_board [label: "F${fd.floorNumber} Sub-Panel", voltage: "${project.voltage}V"]`);
      lines.push(`f${fd.floorNumber}_bkr -> f${fd.floorNumber}_bus`);
      lines.push('');

      // MCBs under the sub-panel
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
        const cableTag = `Wf${fd.floorNumber}${letter}`;
        const mcbId = `fm${fd.floorNumber}_${letter}`;
        const loadId = `fl${fd.floorNumber}_${letter}`;
        const itemCbRating = resolveBreakerRating(item.breakerSize, item.calculatedCurrent || 0, code);

        lines.push(`${mcbId} = mcb [label: "${itemCbRating}", rating: "${itemCbRating}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`f${fd.floorNumber}_bus -> ${mcbId} [cable: "${cableTag}", label: "${formatCableSizeFor(item.cableSize, project.calculationStandard)}"]`);
        lines.push(`${mcbId} -> ${loadId}`);
      });
    } else {
      // Direct floor: MDB → Floor Breaker → Floor Bus → MCBs
      lines.push(`f${fd.floorNumber}_bkr = breaker [label: "F${fd.floorNumber}", rating: "${floorCbRating}"]`);
      lines.push(`mdb -> f${fd.floorNumber}_bkr`);
      lines.push('');

      lines.push(`f${fd.floorNumber}_bus = bus [label: "F${fd.floorNumber}", voltage: "${project.voltage}V"]`);
      lines.push(`f${fd.floorNumber}_bkr -> f${fd.floorNumber}_bus`);
      lines.push('');

      // MCBs under the floor bus
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
        const cableTag = `Wf${fd.floorNumber}${letter}`;
        const mcbId = `fm${fd.floorNumber}_${letter}`;
        const loadId = `fl${fd.floorNumber}_${letter}`;
        const itemCbRating = resolveBreakerRating(item.breakerSize, item.calculatedCurrent || 0, code);

        lines.push(`${mcbId} = mcb [label: "${itemCbRating}", rating: "${itemCbRating}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`f${fd.floorNumber}_bus -> ${mcbId} [cable: "${cableTag}", label: "${formatCableSizeFor(item.cableSize, project.calculationStandard)}"]`);
        lines.push(`${mcbId} -> ${loadId}`);
      });
    }

    pages.push({
      title: hasMultipleBuildings ? `${building} - F${fd.floorNumber}` : `F${fd.floorNumber}`,
      floors: `${building} — Floor ${fd.floorNumber} (${fd.items.length} circuits)`,
      buildingName: building,
      floorNumber: fd.floorNumber,
      dsl: lines.join('\n'),
    });
  }

  // Common Services Pages for building loads
  for (const bldg of project.buildings) {
    const rawLoads = (bldg.buildingLoads || []) as (BuildingLoad & { name?: string; calculatedCurrent?: number; connectedLoad?: number })[];
    if (rawLoads.length > 0) {
      const lines: string[] = [];
      lines.push(`sld "${project.name} — ${bldg.name} Common Services"`);
      lines.push('');
      lines.push(`mdb = bus [label: "MDB Bus", voltage: "${project.voltage}V"]`);
      lines.push('');

      rawLoads.forEach((bload, idx) => {
        const lib = bload.loadLibraryItem;
        const totalKw = (lib?.power ?? (bload.connectedLoad ? bload.connectedLoad / 1000 : 0)) * (bload.quantity ?? 1);
        const voltageKv = (lib?.voltage ?? project.voltage) / 1000;
        const pf = lib?.powerFactor ?? project.powerFactor ?? 0.85;
        const is3Ph = (lib?.phase ?? 3) === 3;
        const derivedCurrent = is3Ph
          ? totalKw / (Math.sqrt(3) * voltageKv * pf)
          : totalKw / (voltageKv * pf);
        const current = bload.calculatedCurrent || derivedCurrent || 0;
        const loadName = bload.name || lib?.name || `Common Load ${idx + 1}`;
        const bkrRating = resolveBreakerRating(bload.breakerSize, current, code);
        const mcbId = `bload_bkr_${idx + 1}`;
        const loadId = `bload_load_${idx + 1}`;

        lines.push(`${mcbId} = breaker [label: "${bkrRating}", rating: "${bkrRating}"]`);
        lines.push(`${loadId} = load [label: "${loadName}"]`);
        lines.push(`mdb -> ${mcbId} [label: "${loadName}"]`);
        lines.push(`${mcbId} -> ${loadId} [label: "${formatCableSizeFor(bload.cableSize, project.calculationStandard)}"]`);
      });

      pages.push({
        title: `${bldg.name} - Services`,
        floors: `${bldg.name} — Common Services (${rawLoads.length} loads)`,
        buildingName: bldg.name,
        dsl: lines.join('\n'),
      });
    }
  }

  return pages;
}
