import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { errorResponse } from "@/lib/api-errors";
import { assertInRange, assertNonNegative, CalculationError } from "@/lib/calculations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const auth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const {
      installMethod,
      cableInsulation,
      cableMaterial,
      ambientTemp,
      groupingCount,
    } = body;

    // These feed the derating factors in the calc engine — reject garbage
    // before it lands on every cable in the project.
    const temp = ambientTemp !== undefined ? Number(ambientTemp) : undefined;
    if (temp !== undefined) assertInRange("ambientTemp (°C)", temp, -30, 90);
    const grouping = groupingCount !== undefined ? Number(groupingCount) : undefined;
    if (grouping !== undefined) {
      assertNonNegative("groupingCount", grouping);
      if (!Number.isInteger(grouping)) throw new CalculationError("groupingCount must be an integer");
    }

    const updates = [
      // Update all floor items in this project
      db.floorItem.updateMany({
        where: {
          floorDesign: {
            building: {
              projectId,
            },
          },
        },
        data: {
          installMethod: installMethod ?? undefined,
          cableInsulation: cableInsulation ?? undefined,
          cableMaterial: cableMaterial ?? undefined,
          ambientTemp: temp ?? undefined,
          groupingCount: grouping ?? undefined,
        },
      }),

      // Update all building loads in this project
      db.buildingLoad.updateMany({
        where: {
          building: {
            projectId,
          },
        },
        data: {
          installMethod: installMethod ?? undefined,
          cableInsulation: cableInsulation ?? undefined,
          cableMaterial: cableMaterial ?? undefined,
          ambientTemp: temp ?? undefined,
          groupingCount: grouping ?? undefined,
        },
      }),

      // Update all floor risers in this project
      db.floorDesign.updateMany({
        where: {
          building: {
            projectId,
          },
        },
        data: {
          riserInstallMethod: installMethod ?? undefined,
          riserCableInsulation: cableInsulation ?? undefined,
          riserCableMaterial: cableMaterial ?? undefined,
          riserAmbientTemp: temp ?? undefined,
          riserGroupingCount: grouping ?? undefined,
        },
      }),
    ];

    const results = await db.$transaction(updates);

    return NextResponse.json({
      success: true,
      updatedFloorItems: results[0].count,
      updatedBuildingLoads: results[1].count,
      updatedFloorRisings: results[2].count,
    });
  } catch (error) {
    return errorResponse(error, "POST batch-defaults Error");
  }
}
