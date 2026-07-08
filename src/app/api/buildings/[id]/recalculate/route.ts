import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;

    const items = await db.floorItem.findMany({
      where: {
        floorDesign: { buildingId },
        type: "APARTMENT",
      },
      include: { apartmentTemplate: { include: { rooms: true } } },
    });

    let updated = 0;
    for (const item of items) {
      if (!item.apartmentTemplate) continue;

      const template = item.apartmentTemplate;
      const totalConnectedLoadVA = template.rooms.reduce(
        (sum, room) => sum + room.connectedLoad, 0
      );

      const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
      const calculatedMaxDemand = calculatedConnectedLoad * 0.4;
      const isThreePhase = template.phases === 3;

      let calculatedCurrent: number;
      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * 0.4);
      } else {
        calculatedCurrent = calculatedMaxDemand / 0.23;
      }

      const sizing = sizeCableAndBreaker(calculatedCurrent, isThreePhase, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 1,
      });

      await db.floorItem.update({
        where: { id: item.id },
        data: {
          calculatedConnectedLoad,
          calculatedMaxDemand,
          calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
          breakerSize: `${sizing.breakerSize}A`,
          cableSize: `${sizing.cableSize} mm²`,
        },
      });
      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("Recalculate Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
