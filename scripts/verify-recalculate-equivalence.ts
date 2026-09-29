import 'dotenv/config';
import { db } from '../src/lib/db';
import { getBuildingDiversityFactor } from '../src/lib/calculations/loads';
import { sizeApartmentItem, isCommercialBuilding, countResidentialApartmentsByBuilding } from '../src/lib/services/recalculate';
import { loadDesignGraph } from '../src/lib/services/projects';

/**
 * Differential test: does the consolidated recalculate service produce the same
 * stored numbers as the code it replaced?
 *
 * Refactoring a write path on a submittal tool is only safe if you can prove
 * equivalence. Comparing against fixtures does not prove it; comparing against a
 * live database does. This runs three implementations over the *same* real
 * project and diffs the results field by field:
 *
 *   A. OLD ROUTE  — verbatim logic from `buildings/[id]/recalculate/route.ts`
 *                   at commit 60c85b4^. This is the UI path, and the new service
 *                   must match it exactly: a pure refactor.
 *   B. OLD MCP    — verbatim logic from `mcp/freshness.ts` at 60c85b4^, which
 *                   counted *floors* instead of apartment units. This is the bug
 *                   that was fixed, so a difference here is EXPECTED and the point
 *                   is to quantify it.
 *   C. NEW        — services/recalculate.ts, the consolidated implementation.
 *
 * Usage: npx tsx scripts/verify-recalculate-equivalence.ts [projectId]
 */

type Impl = { data: Record<string, unknown> };

/** A. The old route's inline calculation, transcribed verbatim. */
function oldRouteSizing(input: {
  rooms: Array<{ connectedLoad: number }>;
  phases: number;
  voltageKv: number;
  powerFactor: number;
  diversityFactor: number;
  item: { voltageDrop: number | null; breakerSize: string | null; cableSize: string | null };
  resetSizing?: boolean;
}): Impl {
  const { rooms, phases, voltageKv, powerFactor, diversityFactor, item } = input;

  const totalConnectedLoadVA = rooms.reduce((sum, room) => sum + room.connectedLoad, 0);
  const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
  const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
  const isThreePhase = phases === 3;

  let calculatedCurrent: number;
  if (isThreePhase) {
    calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
  } else {
    calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
  }

  const dataToUpdate: Record<string, unknown> = {
    calculatedConnectedLoad,
    calculatedMaxDemand,
    calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
  };
  if (item.voltageDrop === 0.1 || input.resetSizing) {
    dataToUpdate.voltageDrop = null;
  }

  const connectedKw = calculatedConnectedLoad;
  const connectedDesignCurrent = isThreePhase
    ? connectedKw / (Math.sqrt(3) * voltageKv * powerFactor)
    : connectedKw / ((voltageKv / Math.sqrt(3)) * powerFactor);
  const itemDesignCurrent = calculatedCurrent > 0 ? calculatedCurrent : connectedDesignCurrent;
  const manualBreaker = item.breakerSize
    ? parseInt(item.breakerSize.replace(/[^\d.]/g, ''), 10)
    : null;
  const isUndersizedForLoad =
    manualBreaker != null && !isNaN(manualBreaker) && manualBreaker < itemDesignCurrent - 0.1;

  if (input.resetSizing || isUndersizedForLoad) {
    dataToUpdate.breakerSize = null;
    dataToUpdate.cableSize = null;
  }

  return { data: dataToUpdate };
}

/** B. The old MCP freshness guard, verbatim. Counts floors, not units. */
function oldMcpSizing(input: {
  rooms: Array<{ connectedLoad: number }>;
  phases: number;
  voltageKv: number;
  powerFactor: number;
  diversityFactor: number;
  item: { voltageDrop: number | null; breakerSize: string | null; cableSize: string | null };
}): Impl {
  const { rooms, phases, voltageKv, powerFactor, diversityFactor, item } = input;

  const connectedLoadVA = rooms.reduce((sum, room) => sum + room.connectedLoad, 0);
  const calculatedConnectedLoad = connectedLoadVA / 1000;
  const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
  const isThreePhase = phases === 3;
  const calculatedCurrent = isThreePhase
    ? calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor)
    : calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);

  const data: Record<string, unknown> = {
    calculatedConnectedLoad,
    calculatedMaxDemand,
    calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
  };
  if (item.voltageDrop === 0.1) data.voltageDrop = null;

  const connectedDesignCurrent = isThreePhase
    ? calculatedConnectedLoad / (Math.sqrt(3) * voltageKv * powerFactor)
    : calculatedConnectedLoad / ((voltageKv / Math.sqrt(3)) * powerFactor);
  const itemDesignCurrent = calculatedCurrent > 0 ? calculatedCurrent : connectedDesignCurrent;
  const manualBreaker = item.breakerSize
    ? parseInt(item.breakerSize.replace(/[^\d.]/g, ''), 10)
    : null;
  const isUndersizedForLoad =
    manualBreaker != null && !isNaN(manualBreaker) && manualBreaker < itemDesignCurrent - 0.1;

  if (isUndersizedForLoad) {
    data.breakerSize = null;
    data.cableSize = null;
  }

  return { data };
}

function normalise(d: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(d)
        .map(([k, v]) => [k, typeof v === 'number' ? Number(v.toFixed(6)) : v])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    )
  );
}

async function main() {
  const explicitId = process.argv[2];
  const projects = explicitId
    ? [await loadDesignGraph(explicitId)]
    : await db.project.findMany({
        where: { buildings: { some: { floorDesigns: { some: { items: { some: { type: 'APARTMENT', apartmentTemplateId: { not: null } } } } } } } },
        select: { id: true, name: true },
        orderBy: { updatedAt: 'desc' },
      }).then((rows) => Promise.all(rows.map((p) => loadDesignGraph(p.id))));

  const loaded = projects.filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (loaded.length === 0) {
    console.error('No projects with apartment circuits found.');
    process.exit(1);
  }

  let compared = 0;
  let routeMatches = 0;
  let mcpMatches = 0;
  const routeDiffs: string[] = [];
  const mcpDiffs: string[] = [];
  let dfFlipped = 0;

  for (const project of loaded) {
    const voltageKv = project.voltage / 1000;
    const powerFactor = project.powerFactor;
    const counts = await countResidentialApartmentsByBuilding(project.id);

    const newTotal = counts.filter((b) => !b.isCommercial).reduce((s, b) => s + b.apartmentCount, 0);
    const oldMcpTotal = project.buildings
      .filter((b) => !isCommercialBuilding(b.name))
      .reduce((s, b) => s + b.floorDesigns.length, 0);

    console.log(`\nproject : ${project.name}`);
    console.log(`  units=${newTotal}  floors=${oldMcpTotal}  buildings=${project.buildings.length}`);

    for (const building of counts) {
      const items = await db.floorItem.findMany({
        where: { floorDesign: { buildingId: building.buildingId }, type: 'APARTMENT' },
        include: { apartmentTemplate: { include: { rooms: true } } },
      });
      if (items.length === 0) continue;

      const countForThisBuilding =
        !building.isCommercial && newTotal > 0 ? newTotal : items.length;
      const dfNew = getBuildingDiversityFactor(countForThisBuilding, building.name);
      const dfOldMcp = getBuildingDiversityFactor(
        !isCommercialBuilding(building.name) && oldMcpTotal > 0 ? oldMcpTotal : items.length,
        building.name
      );
      if (Math.abs(dfNew - dfOldMcp) > 1e-9) dfFlipped++;

      for (const item of items) {
        if (!item.apartmentTemplate) continue;
        compared++;

        const input = {
          rooms: item.apartmentTemplate.rooms,
          phases: item.apartmentTemplate.phases,
          voltageKv,
          powerFactor,
          item: {
            voltageDrop: item.voltageDrop,
            breakerSize: item.breakerSize,
            cableSize: item.cableSize,
          },
        };

        // C. The new service. Note it takes `voltage` and `isThreePhase`, not the
        // pre-divided `voltageKv` the two old copies worked with.
        const neu = sizeApartmentItem({
          voltage: project.voltage,
          powerFactor,
          diversityFactor: dfNew,
          isThreePhase: item.apartmentTemplate.phases === 3,
          rooms: input.rooms,
          item: input.item,
        });

        // A. The old route, which counted units the same way.
        const oldRoute = oldRouteSizing({ ...input, diversityFactor: dfNew });
        if (normalise(neu.data) === normalise(oldRoute.data)) routeMatches++;
        else if (routeDiffs.length < 6) {
          routeDiffs.push(
            `${project.name} / ${building.name} / item ${item.id}\n      old route: ${normalise(oldRoute.data)}\n      new     : ${normalise(neu.data)}`
          );
        }

        // B. The old MCP guard, which counted floors.
        const oldMcp = oldMcpSizing({ ...input, diversityFactor: dfOldMcp });
        if (normalise(oldMcp.data) === normalise(neu.data)) mcpMatches++;
        else if (mcpDiffs.length < 3) {
          mcpDiffs.push(
            `${project.name} / ${building.name}: old MCP df=${dfOldMcp.toFixed(4)} -> ${String(oldMcp.data.calculatedMaxDemand).slice(0, 8)} kW | new df=${dfNew.toFixed(4)} -> ${String(neu.data.calculatedMaxDemand).slice(0, 8)} kW`
          );
        }
      }
    }
  }

  console.log(`\n=== A. new service vs OLD ROUTE (the UI path) ===`);
  console.log(`  projects compared : ${loaded.length}`);
  console.log(`  circuits compared : ${compared}`);
  console.log(`  identical         : ${routeMatches}/${compared}`);
  if (routeDiffs.length) {
    console.log('\n  DIFFERENCES:');
    for (const d of routeDiffs) console.log(`    - ${d}`);
  }

  console.log(`\n=== B. new service vs OLD MCP guard (the bug) ===`);
  console.log(`  identical            : ${mcpMatches}/${compared}`);
  console.log(`  buildings where the diversity factor changed: ${dfFlipped}`);
  for (const d of mcpDiffs) console.log(`    - ${d}`);

  console.log('');
  const routeExact = routeMatches === compared && compared > 0;
  console.log(
    routeExact
      ? `EQUIVALENT: behaviour-preserving vs the old UI path across all ${compared} circuits in ${loaded.length} project(s).`
      : `DIVERGENCE: ${compared - routeMatches} circuit(s) differ from the old route.`
  );
  process.exit(routeExact ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-recalculate-equivalence failed:', e);
  process.exit(1);
});
