import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";

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
    for (let f = 1; f <= totalFloors; f++) {
      await db.floorDesign.create({
        data: {
          floorNumber: f,
          buildingId: building.id,
        },
      });
    }

    return NextResponse.json(building);
  } catch (error) {
    console.error("POST Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
