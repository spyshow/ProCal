import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { phaseBalance } from "@/lib/calculations/phaseBalance";

/**
 * Re-balance: run the greedy LPT phase assignment for all 1-phase loads on this
 * floor and persist the results. 3-phase loads keep assignedPhase=null (they
 * draw from all three phases). Manual overrides are overwritten by a
 * re-balance action; use PATCH /api/floor-items/[id] to pin a specific phase.
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

    const { id: floorDesignId } = await params;

    const floorDesign = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: {
        items: {
          include: {
            apartmentTemplate: true,
            loadLibraryItem: true,
          },
        },
        building: { include: { project: true } },
      },
    });

    if (!floorDesign || floorDesign.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const project = floorDesign.building.project;
    const balance = phaseBalance(floorDesign.items as any, project as any);

    // Persist assignments for 1-phase items only.
    const updates = balance.assignments
      .filter((a) => a.phaseCount === 1 && a.assignedPhase >= 1 && a.assignedPhase <= 3)
      .map((a) =>
        db.floorItem.update({
          where: { id: a.id },
          data: { assignedPhase: a.assignedPhase },
        })
      );

    await db.$transaction(updates);

    // Return the updated floor design so callers can refresh.
    const updated = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: {
        items: {
          include: {
            apartmentTemplate: true,
            loadLibraryItem: true,
          },
        },
      },
    });

    return NextResponse.json({ balance, floorDesign: updated });
  } catch (error) {
    console.error("POST Rebalance Floor Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
