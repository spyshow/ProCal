import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { errorResponse } from "@/lib/api-errors";
import { recalculateBuilding } from "@/lib/calculations/recalculate-project";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    const body = await request.json().catch(() => ({}));

    const building = await db.building.findUnique({
      where: { id: buildingId },
      select: { projectId: true },
    });
    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const result = await recalculateBuilding(buildingId, { resetSizing: body?.resetSizing });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Building Recalculate Error");
  }
}

