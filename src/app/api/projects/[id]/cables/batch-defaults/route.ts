import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";

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
          ambientTemp: ambientTemp !== undefined ? Number(ambientTemp) : undefined,
          groupingCount: groupingCount !== undefined ? Number(groupingCount) : undefined,
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
          ambientTemp: ambientTemp !== undefined ? Number(ambientTemp) : undefined,
          groupingCount: groupingCount !== undefined ? Number(groupingCount) : undefined,
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
          riserAmbientTemp: ambientTemp !== undefined ? Number(ambientTemp) : undefined,
          riserGroupingCount: groupingCount !== undefined ? Number(groupingCount) : undefined,
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
    console.error("POST /api/projects/[id]/cables/batch-defaults error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
