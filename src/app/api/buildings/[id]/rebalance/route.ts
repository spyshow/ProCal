import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Reset all apartment phase pins to auto (null) for the selected building.
 * The calculator page recomputes auto-assignments on-the-fly via buildingPhaseMap.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: buildingId } = await params;

    const building = await db.building.findUnique({
      where: { id: buildingId },
      include: {
        project: true,
        floorDesigns: {
          include: { items: true },
        },
        buildingLoads: true,
      },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    // Reset ALL floor-item assignedPhase to null (auto) for apartment items.
    const allFloorItems = building.floorDesigns.flatMap((fd) => fd.items);
    const pinnedFloorItems = allFloorItems.filter(
      (item) => item.assignedPhase != null && item.type === 'APARTMENT'
    );

    // Also reset building-load assignedPhase to null.
    const pinnedBuildingLoads = building.buildingLoads.filter(
      (bl) => bl.assignedPhase != null
    );

    const updates = [
      ...pinnedFloorItems.map((item) =>
        db.floorItem.update({
          where: { id: item.id },
          data: { assignedPhase: null },
        })
      ),
      ...pinnedBuildingLoads.map((bl) =>
        db.buildingLoad.update({
          where: { id: bl.id },
          data: { assignedPhase: null },
        })
      ),
    ];

    if (updates.length > 0) {
      await db.$transaction(updates);
    }

    return NextResponse.json({
      success: true,
      reset: updates.length,
    });
  } catch (error) {
    console.error("POST Rebalance Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
