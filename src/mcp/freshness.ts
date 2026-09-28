import { db } from '@/lib/db';
import { ENGINE_VERSION } from '@/lib/calculations/version';
import { computeFloorRiserVd } from '@/lib/calculations/riser';
import { getBuildingDiversityFactor } from '@/lib/calculations/loads';

/**
 * Freshness guard for exported deliverables (Task 5 Step 3).
 *
 * Most report schedules — cable, MDB, BOM, voltage drop — read the **stored**
 * `FloorItem` columns (`calculatedConnectedLoad`, `calculatedMaxDemand`,
 * `calculatedCurrent`, `breakerSize`, `cableSize`, `voltageDrop`) rather than
 * recomputing. Those columns only change when a recalculate runs. An agent that
 * builds a project and exports immediately would therefore ship a confident,
 * wrong submittal.
 *
 * Every export tool calls `ensureFresh()` first. It is the difference between a
 * plausible deliverable and a correct one.
 */

export interface FreshnessResult {
  wasStale: boolean;
  engineVersion: string | null;
  itemsRecalculated: number;
}

/**
 * Recalculate a project if its stored numbers predate the current engine.
 *
 * Mirrors the logic in `POST /api/buildings/[id]/recalculate` so an MCP-driven
 * export is identical to one made through the UI.
 */
export async function ensureFresh(projectId: string): Promise<FreshnessResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      voltage: true,
      powerFactor: true,
      engineVersion: true,
      buildings: {
        select: {
          id: true,
          name: true,
          floorDesigns: { select: { id: true } },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (project.engineVersion === ENGINE_VERSION) {
    return {
      wasStale: false,
      engineVersion: project.engineVersion,
      itemsRecalculated: 0,
    };
  }

  const voltageKv = project.voltage / 1000;
  const powerFactor = project.powerFactor;

  const isCommercial = (name: string) => {
    const upper = (name || '').toUpperCase();
    return (
      upper.includes('OFFICE') ||
      upper.includes('COMMERCIAL') ||
      upper.includes('RETAIL') ||
      upper.includes('MALL')
    );
  };

  // Count residential units across the WHOLE project, not just this building, so
  // identical templates get a consistent diversity policy across towers
  // (IEC 61439-2 Clause 10.10).
  const totalResidentialApts = project.buildings
    .filter((b) => !isCommercial(b.name))
    .reduce((sum, b) => sum + b.floorDesigns.length, 0);

  let itemsRecalculated = 0;
  // Mixed write types, hence the explicit union.
  const updates: Array<
    ReturnType<typeof db.floorItem.update> | ReturnType<typeof db.project.update>
  > = [];

  for (const building of project.buildings) {
    const items = await db.floorItem.findMany({
      where: { floorDesign: { buildingId: building.id }, type: 'APARTMENT' },
      include: { apartmentTemplate: { include: { rooms: true } } },
    });
    if (items.length === 0) continue;

    const apartmentCount =
      !isCommercial(building.name) && totalResidentialApts > 0
        ? totalResidentialApts
        : items.length;
    const diversityFactor = getBuildingDiversityFactor(apartmentCount, building.name);

    for (const item of items) {
      if (!item.apartmentTemplate) continue;

      const connectedLoadVA = item.apartmentTemplate.rooms.reduce(
        (sum, room) => sum + room.connectedLoad,
        0
      );
      const calculatedConnectedLoad = connectedLoadVA / 1000;
      const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;

      const isThreePhase = item.apartmentTemplate.phases === 3;
      const calculatedCurrent = isThreePhase
        ? calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor)
        : calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);

      const data: Record<string, unknown> = {
        calculatedConnectedLoad,
        calculatedMaxDemand,
        calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
      };

      // A 0.1 placeholder means "never sized"; clear it so the engine re-sizes.
      if (item.voltageDrop === 0.1) {
        data.voltageDrop = null;
      }

      // A manual breaker below the design current is an overload risk — clear it
      // and let the cable/breaker engine size it properly.
      const manualBreaker = item.breakerSize
        ? parseInt(item.breakerSize.replace(/[^\d.]/g, ''), 10)
        : null;
      const connectedDesignCurrent = isThreePhase
        ? calculatedConnectedLoad / (Math.sqrt(3) * voltageKv * powerFactor)
        : calculatedConnectedLoad / ((voltageKv / Math.sqrt(3)) * powerFactor);
      const itemDesignCurrent =
        calculatedCurrent > 0 ? calculatedCurrent : connectedDesignCurrent;
      const isUndersizedForLoad =
        manualBreaker != null &&
        !isNaN(manualBreaker) &&
        manualBreaker < itemDesignCurrent - 0.1;

      if (isUndersizedForLoad) {
        data.breakerSize = null;
        data.cableSize = null;
      }

      updates.push(db.floorItem.update({ where: { id: item.id }, data }));
      itemsRecalculated++;
    }
  }

  // Stamp the engine so the next export is a no-op and the UI stops flagging it.
  updates.push(
    db.project.update({
      where: { id: projectId },
      data: { engineVersion: ENGINE_VERSION },
    })
  );
  await db.$transaction(updates);

  return { wasStale: true, engineVersion: ENGINE_VERSION, itemsRecalculated };
}

/**
 * Re-read a project with everything the calculation engine and report renderer
 * need, in the shape `src/types`' `Project` expects.
 *
 * Shared by the export tools and the design-summary tool so an agent sees the same
 * numbers the report will.
 */
export async function loadProjectForDesign(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: {
              items: {
                include: {
                  apartmentTemplate: { include: { rooms: true } },
                  loadLibraryItem: true,
                },
              },
            },
          },
          buildingLoads: { include: { loadLibraryItem: true } },
        },
      },
      apartmentTemplates: { include: { rooms: true } },
      loadLibraryItems: true,
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

/**
 * Per-floor ΔV verdict, for the design-summary tool.
 *
 * Typed loosely on purpose: the caller passes the Prisma include shape from
 * `loadProjectForDesign`, which is structurally compatible with the fields
 * `computeFloorRiserVd` actually reads but is not the `Project` interface.
 */
export function summariseRiser(project: {
  buildings: Array<{
    id: string;
    name: string;
    floorDesigns: Array<{
      floorNumber: number;
      hasFloorSubPanels: boolean;
      items: Array<{
        type: string;
        name: string;
        calculatedCurrent: number;
        calculatedMaxDemand: number;
        calculatedConnectedLoad: number;
        cableSize: string | null;
        cableLength: number | null;
        installMethod: string | null;
        cableInsulation: string | null;
        cableMaterial: string | null;
        ambientTemp: number | null;
        groupingCount: number | null;
        assignedPhase: number | null;
        apartmentTemplateId: string | null;
        apartmentTemplate: { phases: number } | null;
      }>;
    }>;
  }>;
  voltage: number;
  powerFactor: number;
  maxVoltageDropPower: number | null;
}) {
  return project.buildings.flatMap((b) =>
    b.floorDesigns.map((fd) => {
      const vd = computeFloorRiserVd(fd as never, project as never);
      return {
        buildingId: b.id,
        buildingName: b.name,
        floorNumber: fd.floorNumber,
        hasFloorSubPanels: fd.hasFloorSubPanels,
        riserCurrent: vd.riserCurrent,
        riserVdPercent: vd.riserVdPercent,
        branchVdPercent: vd.branchVdPercent,
        totalVdPercent: vd.totalVdPercent,
        totalNoData: vd.totalNoData,
      };
    })
  );
}
