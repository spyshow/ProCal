import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const building = await db.building.findUnique({
      where: { id },
      include: { project: true, floorDesigns: true },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "VIEW",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json(building);
  } catch (error) {
    console.error("GET Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const building = await db.building.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const oldTotalFloors = building.floors + building.serviceFloors;
    
    const updatedBuilding = await db.building.update({
      where: { id },
      data: {
        name: data.name ?? building.name,
        floors: data.floors !== undefined ? parseInt(data.floors) : building.floors,
        serviceFloors: data.serviceFloors !== undefined ? parseInt(data.serviceFloors) : building.serviceFloors,
        apartmentsPerFloor: data.apartmentsPerFloor !== undefined ? parseInt(data.apartmentsPerFloor) : building.apartmentsPerFloor,
        supplyVoltage: data.supplyVoltage ?? building.supplyVoltage,
        earthingSystem: data.earthingSystem ?? building.earthingSystem,
        lightningProtection: data.lightningProtection !== undefined ? !!data.lightningProtection : building.lightningProtection,
        mechanicalLoads: data.mechanicalLoads ?? building.mechanicalLoads,
        generator: data.generator !== undefined ? parseFloat(data.generator) : building.generator,
        transformer: data.transformer !== undefined ? parseFloat(data.transformer) : building.transformer,
      },
    });

    const newTotalFloors = updatedBuilding.floors + updatedBuilding.serviceFloors;

    // Adjust FloorDesign objects
    if (newTotalFloors > oldTotalFloors) {
      // Add missing floors
      for (let f = oldTotalFloors + 1; f <= newTotalFloors; f++) {
        await db.floorDesign.create({
          data: {
            floorNumber: f,
            buildingId: building.id,
          },
        });
      }
    } else if (newTotalFloors < oldTotalFloors) {
      // Remove excess floors
      await db.floorDesign.deleteMany({
        where: {
          buildingId: building.id,
          floorNumber: { gt: newTotalFloors },
        },
      });
    }

    return NextResponse.json(updatedBuilding);
  } catch (error) {
    console.error("PUT Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const building = await db.building.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    await db.building.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
