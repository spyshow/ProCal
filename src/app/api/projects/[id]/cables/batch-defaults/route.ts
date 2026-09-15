import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
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
    const totalUpdated = results[0].count + results[1].count + results[2].count;

    const detailsList: string[] = [];
    if (installMethod) detailsList.push(`Method: ${installMethod}`);
    if (cableInsulation) detailsList.push(`Insulation: ${cableInsulation}`);
    if (cableMaterial) detailsList.push(`Material: ${cableMaterial}`);
    if (temp !== undefined) detailsList.push(`Temp: ${temp}°C`);
    if (grouping !== undefined) detailsList.push(`Grouping: ${grouping}`);

    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "UPDATE",
      entityType: "CABLE",
      entityId: projectId,
      description: `Applied batch cable defaults (${detailsList.join(", ")}) across ${totalUpdated} circuits`,
      details: {
        installMethod,
        cableInsulation,
        cableMaterial,
        ambientTemp: temp,
        groupingCount: grouping,
        updatedCircuits: totalUpdated,
      },
    });

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
