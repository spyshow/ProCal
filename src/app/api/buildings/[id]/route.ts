import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const building = await db.building.findUnique({
      where: { id },
      include: { project: true, floorDesigns: true },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const building = await db.building.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const oldTotalFloors = building.floors + building.serviceFloors;
    
    const updatedBuilding = await db.building.update({
      where: { id },
      data: {
        name: data.name ?? building.name,
        floors: data.floors !== undefined ? parseInt(data.floors) : building.floors,
        serviceFloors: data.serviceFloors !== undefined ? parseInt(data.serviceFloors) : building.serviceFloors,
        apartmentsPerFloor: data.apartmentsPerFloor !== undefined ? parseInt(data.apartmentsPerFloor) : building.apartmentsPerFloor,
        elevators: data.elevators !== undefined ? parseInt(data.elevators) : building.elevators,
        waterPumps: data.waterPumps !== undefined ? parseInt(data.waterPumps) : building.waterPumps,
        firePump: data.firePump !== undefined ? !!data.firePump : building.firePump,
        splitAc: data.splitAc !== undefined ? parseInt(data.splitAc) : building.splitAc,
        centralAc: data.centralAc !== undefined ? parseFloat(data.centralAc) : building.centralAc,
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const building = await db.building.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    await db.building.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Building Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
