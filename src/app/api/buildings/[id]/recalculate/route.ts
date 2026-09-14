import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { errorResponse } from "@/lib/api-errors";
import { getBuildingDiversityFactor } from "@/lib/calculations/loads";
import { ENGINE_VERSION } from "@/lib/calculations/version";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    const body = await request.json().catch(() => ({}));

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
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    // This route is middleware-excluded (matcher skips /api/buildings), so it
    // MUST self-guard: recalculation rewrites every apartment's stored demand
    // and was previously reachable with no session at all.
    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

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

    // Apply IEC diversity factor based on total count and building occupancy profile.
    // For residential towers in a multi-building project, evaluate the coincidence factor
    // across all residential units in the project (IEC 61439-2 Clause 10.10) so identical
    // templates have a consistent, uniform demand factor policy across towers.
    const isCommercial =
      (building.name || '').toUpperCase().includes('OFFICE') ||
      (building.name || '').toUpperCase().includes('COMMERCIAL') ||
      (building.name || '').toUpperCase().includes('RETAIL') ||
      (building.name || '').toUpperCase().includes('MALL');

    let apartmentCount = items.length;
    if (!isCommercial && building.project?.buildings) {
      const totalResidentialApts = building.project.buildings
        .filter((b) => {
          const name = (b.name || '').toUpperCase();
          return (
            !name.includes('OFFICE') &&
            !name.includes('COMMERCIAL') &&
            !name.includes('RETAIL') &&
            !name.includes('MALL')
          );
        })
        .reduce((sum, b) => {
          return (
            sum +
            (b.floorDesigns?.reduce(
              (fSum, fd) =>
                fSum +
                (fd.items?.filter((i) => i.type === 'APARTMENT').length || 0),
              0
            ) || 0)
          );
        }, 0);
      if (totalResidentialApts > 0) {
        apartmentCount = totalResidentialApts;
      }
    }
    const diversityFactor = getBuildingDiversityFactor(apartmentCount, building.name);

    const updates = [];
    for (const item of items) {
      if (!item.apartmentTemplate) continue;

      const template = item.apartmentTemplate;
      const totalConnectedLoadVA = template.rooms.reduce(
        (sum, room) => sum + room.connectedLoad, 0
      );

      const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
      const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
      const isThreePhase = template.phases === 3;

      let calculatedCurrent: number;
      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
      } else {
        // 1-phase: use V_LN = V_LL / √3 (e.g. 230V for a 400V system)
        calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
      }

      const dataToUpdate: Record<string, any> = {
        calculatedConnectedLoad,
        calculatedMaxDemand,
        calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
      };
      if (item.voltageDrop === 0.1 || body?.resetSizing) {
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
      // Branch circuits size to the actual design current (calculatedCurrent).
      // Breakers smaller than design current (continuous overload risk) or explicitly requested resets are cleared.
      const isUndersizedForLoad =
        manualBreaker != null && !isNaN(manualBreaker) && manualBreaker < itemDesignCurrent - 0.1;

      if (body?.resetSizing || isUndersizedForLoad) {
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
    // Stamp the engine version so stale designs (computed under older calc
    // semantics) can be flagged until a recalculate heals them.
    updates.push(
      db.project.update({
        where: { id: building.projectId },
        data: { engineVersion: ENGINE_VERSION },
      })
    );
    await db.$transaction(updates);

    return NextResponse.json({ success: true, updated: itemCount, diversityFactor });
  } catch (error) {
    return errorResponse(error, "Building Recalculate Error");
  }
}
