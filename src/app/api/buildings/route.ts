import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { trialBuildingsError, trialLevelsError } from "@/lib/trial";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      projectId,
      name,
      floors,
      serviceFloors,
      apartmentsPerFloor,
      supplyVoltage,
      earthingSystem,
      lightningProtection,
      mechanicalLoads,
    } = data;

    if (!projectId || !name || floors === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    if (auth.project.isTrial) {
      const existing = await db.building.count({ where: { projectId } });
      const trialError =
        trialBuildingsError(existing) ||
        trialLevelsError(parseInt(floors) || 1, parseInt(serviceFloors) || 0);
      if (trialError) {
        return NextResponse.json({ error: trialError, code: "TRIAL_LIMIT" }, { status: 402 });
      }
    }

    // Create building
    const building = await db.building.create({
      data: {
        name,
        floors: parseInt(floors) || 1,
        serviceFloors: parseInt(serviceFloors) || 0,
        apartmentsPerFloor: parseInt(apartmentsPerFloor) || 0,
        supplyVoltage: supplyVoltage || "400V 3-Phase",
        earthingSystem: earthingSystem || "TN-S",
        lightningProtection: !!lightningProtection,
        mechanicalLoads: mechanicalLoads || "[]",
        projectId,
      },
    });

    // Automatically create FloorDesign templates for each floor
    const totalFloors = building.floors + building.serviceFloors;
    if (totalFloors > 0) {
      const floorsData = Array.from({ length: totalFloors }, (_, i) => ({
        floorNumber: i + 1,
        buildingId: building.id,
      }));
      await db.floorDesign.createMany({
        data: floorsData,
      });
    }

    return NextResponse.json(building);
  } catch (error) {
    console.error("POST Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
