import { db, type Prisma } from "@/lib/db";
import { getBuildingDiversityFactor } from "@/lib/calculations/loads";
import { ENGINE_VERSION } from "@/lib/calculations/version";

export interface RecalculateOptions {
  resetSizing?: boolean;
}

export interface RecalculateBuildingResult {
  success: boolean;
  updated: number;
  diversityFactor: number;
}

/**
 * Recalculates all apartment loads and branch currents for a specific building.
 * Evaluates the coincidence factor across all residential units in the project
 * (IEC 61439-2 Clause 10.10) for uniform demand factor policy across towers.
 */
export async function recalculateBuilding(
  buildingId: string,
  options?: RecalculateOptions
): Promise<RecalculateBuildingResult> {
  const building = await db.building.findUnique({
    where: { id: buildingId },
    include: {
      project: {
        include: {
          buildings: {
            include: {
              floorDesigns: {
                include: {
                  items: {
                    where: { type: "APARTMENT" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!building) {
    throw new Error(`Building not found: ${buildingId}`);
  }

  const project = building.project;
  const voltageKv = project.voltage / 1000;
  const powerFactor = project.powerFactor;

  const items = await db.floorItem.findMany({
    where: {
      floorDesign: { buildingId },
      type: "APARTMENT",
    },
    include: { apartmentTemplate: { include: { rooms: true } } },
  });

  const isCommercial =
    (building.name || "").toUpperCase().includes("OFFICE") ||
    (building.name || "").toUpperCase().includes("COMMERCIAL") ||
    (building.name || "").toUpperCase().includes("RETAIL") ||
    (building.name || "").toUpperCase().includes("MALL");

  let apartmentCount = items.length;
  if (!isCommercial && building.project?.buildings) {
    const totalResidentialApts = building.project.buildings
      .filter((b) => {
        const name = (b.name || "").toUpperCase();
        return (
          !name.includes("OFFICE") &&
          !name.includes("COMMERCIAL") &&
          !name.includes("RETAIL") &&
          !name.includes("MALL")
        );
      })
      .reduce((sum, b) => {
        return (
          sum +
          (b.floorDesigns?.reduce(
            (fSum, fd) =>
              fSum + (fd.items?.filter((i) => i.type === "APARTMENT").length || 0),
            0
          ) || 0)
        );
      }, 0);
    if (totalResidentialApts > 0) {
      apartmentCount = totalResidentialApts;
    }
  }

  const diversityFactor = getBuildingDiversityFactor(apartmentCount, building.name);

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const item of items) {
    if (!item.apartmentTemplate) continue;

    const template = item.apartmentTemplate;
    const totalConnectedLoadVA = template.rooms.reduce(
      (sum, room) => sum + room.connectedLoad,
      0
    );

    const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
    const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
    const isThreePhase = template.phases === 3;

    let calculatedCurrent: number;
    if (isThreePhase) {
      calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
    } else {
      calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
    }

    const dataToUpdate: Prisma.FloorItemUpdateInput = {
      calculatedConnectedLoad,
      calculatedMaxDemand,
      calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
    };
    if (item.voltageDrop === 0.1 || options?.resetSizing) {
      dataToUpdate.voltageDrop = null;
    }

    const connectedKw = calculatedConnectedLoad;
    const connectedDesignCurrent = isThreePhase
      ? connectedKw / (Math.sqrt(3) * voltageKv * powerFactor)
      : connectedKw / ((voltageKv / Math.sqrt(3)) * powerFactor);
    const itemDesignCurrent = calculatedCurrent > 0 ? calculatedCurrent : connectedDesignCurrent;
    const manualBreaker = item.breakerSize
      ? parseInt(item.breakerSize.replace(/[^\d.]/g, ""), 10)
      : null;

    const isUndersizedForLoad =
      manualBreaker != null && !isNaN(manualBreaker) && manualBreaker < itemDesignCurrent - 0.1;

    if (options?.resetSizing || isUndersizedForLoad) {
      dataToUpdate.breakerSize = null;
      dataToUpdate.cableSize = null;
    }

    updates.push(
      db.floorItem.update({
        where: { id: item.id },
        data: dataToUpdate,
      })
    );
  }

  const itemCount = updates.length;
  updates.push(
    db.project.update({
      where: { id: building.projectId },
      data: { engineVersion: ENGINE_VERSION },
    })
  );

  await db.$transaction(updates);

  return { success: true, updated: itemCount, diversityFactor };
}

/**
 * Recalculates all buildings for an entire project.
 */
export async function recalculateProjectBuildings(
  projectId: string,
  options?: RecalculateOptions
) {
  const buildings = await db.building.findMany({
    where: { projectId },
    select: { id: true },
  });

  const results = [];
  for (const bldg of buildings) {
    const res = await recalculateBuilding(bldg.id, options);
    results.push(res);
  }

  await db.project.update({
    where: { id: projectId },
    data: { engineVersion: ENGINE_VERSION },
  });

  return results;
}
