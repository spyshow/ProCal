interface SLDProject {
  name: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  transformerSize?: number | null;
  buildings: {
    name: string;
    floors: number;
    floorDesigns: {
      floorNumber: number;
      hasFloorSubPanels: boolean;
      items: {
        name: string;
        type: string;
        calculatedMaxDemand: number;
        calculatedCurrent: number;
        breakerSize: string;
        cableSize: string;
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

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      if (fd.items.length === 0) continue;

      // Every floor gets its own bus — this groups MCBs vertically per floor
      const floorBusId = `floor_bus_${fd.floorNumber}`;
      const floorBreakerId = `floor_bkr_${fd.floorNumber}`;
      const floorCurrent = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);

      if (fd.hasFloorSubPanels) {
        // Sub-panel floor: MDB → floor breaker → floor bus (distribution_board)
        lines.push(`${floorBusId} = distribution_board [label: "F${fd.floorNumber} Sub-Panel", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "F${fd.floorNumber} Main", rating: "${Math.ceil(floorCurrent)}A"]`);
      } else {
        // Direct floor: MDB → floor breaker → floor bus
        lines.push(`${floorBusId} = bus [label: "F${fd.floorNumber}", voltage: "${project.voltage}V"]`);
        lines.push(`${floorBreakerId} = breaker [label: "F${fd.floorNumber}", rating: "${Math.ceil(floorCurrent)}A"]`);
      }

      lines.push(`mdb_bus -> ${floorBreakerId} [label: "Floor ${fd.floorNumber}"]`);
      lines.push(`${floorBreakerId} -> ${floorBusId}`);
      lines.push('');

      // MCBs connect to floor bus (not MDB bus)
      fd.items.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + idx);
        const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
        const cableTag = `Wf${fd.floorNumber}${letter}`;
        const bkrId = `bkr_${fd.floorNumber}_${mdbBreakerIdx++}`;
        const loadId = `load_${fd.floorNumber}_${letter}`;

        lines.push(`${bkrId} = mcb [label: "${item.breakerSize}", rating: "${item.breakerSize}"]`);
        lines.push(`${loadId} = load [label: "${loadTag}"]`);
        lines.push(`${floorBusId} -> ${bkrId} [cable: "${cableTag}", label: "${item.cableSize}"]`);
        lines.push(`${bkrId} -> ${loadId}`);
      });
      lines.push('');
    }
  }

  return lines.join('\n');
}
