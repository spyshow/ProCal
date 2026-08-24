import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";
import { ENGINE_VERSION } from "@/lib/calculations/version";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: floorDesignId } = await params;

    const floorDesign = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: { building: { include: { project: true } } },
    });
    if (!floorDesign) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(floorDesign.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const project = floorDesign.building.project;
    const voltageKv = project.voltage / 1000;
    const powerFactor = project.powerFactor;

    // Get total apartment count in the building for diversity factor.
    const totalAptCount = await db.floorItem.count({
      where: {
        floorDesign: { buildingId: floorDesign.buildingId },
        type: "APARTMENT",
      },
    });
    const diversityFactor = getApartmentDiversityFactor(totalAptCount);

    const items = await db.floorItem.findMany({
      where: { floorDesignId },
      include: { apartmentTemplate: { include: { rooms: true } } },
    });

    const updates = [];
    for (const item of items) {
      if (item.type !== "APARTMENT" || !item.apartmentTemplate) continue;

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

      updates.push(
        db.floorItem.update({
          where: { id: item.id },
          data: {
            calculatedConnectedLoad,
            calculatedMaxDemand,
            calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
          },
        })
      );
    }

    const itemCount = updates.length;
    // Stamp the engine version so stale designs (computed under older calc
    // semantics) can be flagged until a recalculate heals them.
    updates.push(
      db.project.update({
        where: { id: floorDesign.building.projectId },
        data: { engineVersion: ENGINE_VERSION },
      })
    );
    await db.$transaction(updates);

    return NextResponse.json({ success: true, updated: itemCount, diversityFactor });
  } catch (error) {
    return errorResponse(error, "Floor Recalculate Error");
  }
}
