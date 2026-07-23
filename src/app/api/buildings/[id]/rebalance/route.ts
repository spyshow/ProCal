import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { phaseBalance } from "@/lib/calculations/phaseBalance";

/**
 * Reset all apartment phase assignments to auto (null) for the selected building.
 * This clears any manually pinned phases so the UI shows auto-computed assignments.
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
          include: {
            items: true,
          },
        },
      },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    // Reset all floor-item assignedPhase to null (auto) for apartment items.
    const allFloorItems = building.floorDesigns.flatMap((fd) => fd.items);
    const pinnedItems = allFloorItems.filter(
      (item) => item.assignedPhase != null && item.type === 'APARTMENT'
    );

    if (pinnedItems.length > 0) {
      await db.$transaction(
        pinnedItems.map((item) =>
          db.floorItem.update({
            where: { id: item.id },
            data: { assignedPhase: null },
          })
        )
      );
    }

    return NextResponse.json({ success: true, reset: pinnedItems.length });
  } catch (error) {
    console.error("POST Rebalance Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
