import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;

    const building = await db.building.findUnique({
      where: { id: buildingId },
      include: { project: true },
    });
    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
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

    // Apply IEC diversity factor based on total apartment count in building.
    const apartmentCount = items.length;
    const diversityFactor = getApartmentDiversityFactor(apartmentCount);

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

    if (updates.length > 0) {
      await db.$transaction(updates);
    }

    return NextResponse.json({ success: true, updated: updates.length, diversityFactor });
  } catch (error) {
    return errorResponse(error, "Building Recalculate Error");
  }
}
