import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { errorResponse } from "@/lib/api-errors";
import { applyBuildingSizing } from "@/lib/services/recalculate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    const body = await request.json().catch(() => ({}));

    const building = await db.building.findUnique({
      where: { id: buildingId },
      select: { id: true, projectId: true },
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

    // The sizing rule lives in the service so this route and the MCP freshness
    // guard cannot drift into storing different demands for the same design.
    const result = await applyBuildingSizing(buildingId, { resetSizing: body?.resetSizing });
    if (!result) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      updated: result.itemsRecalculated,
      diversityFactor: result.diversityFactor,
    });
  } catch (error) {
    return errorResponse(error, "Building Recalculate Error");
  }
}