import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { optimizePhaseBalance } from "@/lib/calculations/phaseBalance";
import type { FloorItem, Project } from "@/types";

/**
 * Re-balance: run the greedy LPT phase assignment for all 1-phase loads on this
 * floor and persist the results. 3-phase loads keep assignedPhase=null (they
 * draw from all three phases). Items with a manual assignedPhase pin are
 * preserved; only auto-assigned (null) items get rebalanced.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: floorDesignId } = await params;

    const floorDesign = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: {
        items: {
          include: {
            apartmentTemplate: { include: { rooms: true } },
            loadLibraryItem: true,
          },
        },
        building: { include: { project: true } },
      },
    });

    if (!floorDesign) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(floorDesign.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as {
      decomposeThreePhaseApartments?: boolean;
      ignorePins?: boolean;
    };
    const decomposeThreePhaseApartments = Boolean(body?.decomposeThreePhaseApartments);
    const ignorePins = Boolean(body?.ignorePins);

    const project = floorDesign.building.project;
    const balance = optimizePhaseBalance(
      floorDesign.items as unknown as FloorItem[],
      project as unknown as Project,
      { decomposeThreePhaseApartments, ignorePins }
    );

    // Persist assignments for 1-phase items only, preserving manual overrides unless ignorePins=true.
    const pinnedIds = ignorePins
      ? new Set<string>()
      : new Set(
          floorDesign.items
            .filter((item) => item.assignedPhase != null)
            .map((item) => item.id)
        );
    const updates = balance.assignments
      .filter((a) => a.phaseCount === 1 && a.assignedPhase >= 1 && a.assignedPhase <= 3 && !pinnedIds.has(a.id))
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
