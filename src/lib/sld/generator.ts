interface SLDProject {
  name: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  transformerSize?: number | null;
  buildings: {
    id?: string;
    name: string;
    floors: number;
    floorDesigns: {
      id?: string;
      floorNumber: number;
      hasFloorSubPanels: boolean;
      riserCableSize?: string | null;
      riserCableLength?: number | null;
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

export function generateSLD(project: SLDProject): string {
  const lines: string[] = [];
  let mdbBreakerIdx = 0;

  lines.push(`sld "${project.name} — Single Line Diagram"`);
  lines.push('');

  // Utility source
  lines.push(`grid = utility [label: "${project.voltage}V Utility", voltage: "${project.voltage}V"]`);
  lines.push('');

  // Transformer
  const txKva = project.transformerSize || 1000;
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
    const sortedFloors = [...bldg.floorDesigns].sort((a, b) => a.floorNumber - b.floorNumber);
    for (const fd of sortedFloors) {
      if (fd.items.length === 0) continue;

      // Every floor gets its own bus — this groups MCBs vertically per floor
      const floorBusId = `floor_bus_${bldgPrefix}_${fd.floorNumber}`;
      const floorBreakerId = `floor_bkr_${bldgPrefix}_${fd.floorNumber}`;
      const floorCurrent = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);

      if (fd.hasFloorSubPanels) {
        // Sub-panel floor: MDB → floor breaker → floor bus (distribution_board)
        lines.push(`${floorBusId} = distribution_board [label: "${bldg.name} F${fd.floorNumber} Sub-Panel", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "${bldg.name} F${fd.floorNumber} Main", rating: "${Math.ceil(floorCurrent)}A"]`);
      } else {
        // Direct floor: MDB → floor breaker → floor bus
        lines.push(`${floorBusId} = bus [label: "${bldg.name} F${fd.floorNumber}", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "${bldg.name} F${fd.floorNumber}", rating: "${Math.ceil(floorCurrent)}A"]`);
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

        lines.push(`${bkrId} = mcb [label: "${item.breakerSize}", rating: "${item.breakerSize}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`${floorBusId} -> ${bkrId} [cable: "${cableTag}", label: "${item.cableSize}"]`);
        lines.push(`${bkrId} -> ${loadId}`);
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
export function generateSLDPages(project: SLDProject): SLDPage[] {
  const pages: SLDPage[] = [];

  const allFloors: { building: string; fd: typeof project.buildings[0]['floorDesigns'][0] }[] = [];
  for (const bldg of project.buildings) {
    const sortedFloors = [...bldg.floorDesigns].sort((a, b) => a.floorNumber - b.floorNumber);
    for (const fd of sortedFloors) {
      if (fd.items.length > 0) {
        allFloors.push({ building: bldg.name, fd });
      }
    }
  }

  if (allFloors.length === 0) return pages;

  const hasMultipleBuildings = project.buildings.length > 1;

  for (let i = 0; i < allFloors.length; i++) {
    const { building, fd } = allFloors[i];
    const floorCurrent = fd.items.reduce((s, item) => s + item.calculatedCurrent, 0);
    const lines: string[] = [];

    lines.push(`sld "${project.name} — ${building} F${fd.floorNumber} (${i + 1}/${allFloors.length})"`);
    lines.push('');

    // MDB bus (shown as a short bus at the top)
    lines.push(`mdb = bus [label: "MDB Bus", voltage: "${project.voltage}V"]`);
    lines.push('');

    if (fd.hasFloorSubPanels) {
      // Sub-panel floor: MDB → Floor Breaker → Sub-Panel Bus → MCBs
      lines.push(`f${fd.floorNumber}_bkr = breaker [label: "F${fd.floorNumber}", rating: "${Math.ceil(floorCurrent)}A"]`);
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

        lines.push(`${mcbId} = mcb [label: "${item.breakerSize}", rating: "${item.breakerSize}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`f${fd.floorNumber}_bus -> ${mcbId} [cable: "${cableTag}", label: "${item.cableSize}"]`);
        lines.push(`${mcbId} -> ${loadId}`);
      });
    } else {
      // Direct floor: MDB → Floor Breaker → Floor Bus → MCBs
      lines.push(`f${fd.floorNumber}_bkr = breaker [label: "F${fd.floorNumber}", rating: "${Math.ceil(floorCurrent)}A"]`);
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

        lines.push(`${mcbId} = mcb [label: "${item.breakerSize}", rating: "${item.breakerSize}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`f${fd.floorNumber}_bus -> ${mcbId} [cable: "${cableTag}", label: "${item.cableSize}"]`);
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

  return pages;
}
