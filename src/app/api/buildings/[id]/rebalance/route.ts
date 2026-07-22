import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { phaseBalance } from "@/lib/calculations/phaseBalance";

/**
 * Re-balance: run the greedy LPT phase assignment for all 1-phase building
 * loads and persist the results. 3-phase loads keep assignedPhase=null.
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
        buildingLoads: { include: { loadLibraryItem: true } },
      },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const balance = phaseBalance(building.buildingLoads as any, building.project as any);

    const updates = balance.assignments
      .filter((a) => a.phaseCount === 1 && a.assignedPhase >= 1 && a.assignedPhase <= 3)
      .map((a) =>
        db.buildingLoad.update({
          where: { id: a.id },
          data: { assignedPhase: a.assignedPhase },
        })
      );

    await db.$transaction(updates);

    const updated = await db.building.findUnique({
      where: { id: buildingId },
      include: {
        buildingLoads: { include: { loadLibraryItem: true } },
      },
    });

    return NextResponse.json({ balance, building: updated });
  } catch (error) {
    console.error("POST Rebalance Building Loads Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
