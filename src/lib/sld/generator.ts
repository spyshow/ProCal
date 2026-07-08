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
      if (fd.hasFloorSubPanels && fd.items.length > 0) {
        // Sub-panel floor
        const spBusId = `sp_bus_${fd.floorNumber}`;
        const spBreakerId = `sp_bkr_${fd.floorNumber}`;
        const floorCurrent = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);

        lines.push(`${spBusId} = distribution_board [label: "F${fd.floorNumber} Sub-Panel", voltage: "${project.voltage}V"]`);
        lines.push(`${spBreakerId} = breaker [label: "F${fd.floorNumber} Main", rating: "${Math.ceil(floorCurrent)}A"]`);
        lines.push(`mdb_bus -> ${spBreakerId} [label: "Floor ${fd.floorNumber}"]`);
        lines.push(`${spBreakerId} -> ${spBusId}`);
        lines.push('');

        for (const item of fd.items) {
          const bkrId = `bkr_${fd.floorNumber}_${mdbBreakerIdx++}`;
          lines.push(`${bkrId} = mcb [label: "${item.name}", rating: "${item.breakerSize}"]`);
          lines.push(`${spBusId} -> ${bkrId} [cable: "${item.cableSize}"]`);
        }
        lines.push('');
      } else if (fd.items.length > 0) {
        // Direct floor
        for (const item of fd.items) {
          const bkrId = `bkr_${fd.floorNumber}_${mdbBreakerIdx++}`;
          lines.push(`${bkrId} = mcb [label: "${item.name}", rating: "${item.breakerSize}"]`);
          lines.push(`mdb_bus -> ${bkrId} [cable: "${item.cableSize}"]`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
