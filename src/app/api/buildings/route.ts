import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const {
      projectId,
      name,
      floors,
      serviceFloors,
      apartmentsPerFloor,
      elevators,
      waterPumps,
      firePump,
      splitAc,
      centralAc,
      supplyVoltage,
      earthingSystem,
      lightningProtection,
      mechanicalLoads,
    } = data;

    if (!projectId || !name || floors === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify project belongs to user
    const project = await db.project.findUnique({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create building
    const building = await db.building.create({
      data: {
        name,
        floors: parseInt(floors) || 1,
        serviceFloors: parseInt(serviceFloors) || 0,
        apartmentsPerFloor: parseInt(apartmentsPerFloor) || 0,
        elevators: parseInt(elevators) || 0,
        waterPumps: parseInt(waterPumps) || 0,
        firePump: !!firePump,
        splitAc: parseInt(splitAc) || 0,
        centralAc: parseFloat(centralAc) || 0,
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
