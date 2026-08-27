import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { errorResponse } from "@/lib/api-errors";

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

    const auth = await verifyProjectAccess(building.projectId);
    if (auth instanceof NextResponse) return auth;

    if (auth.member.role === "QA") {
      return NextResponse.json({ error: "Forbidden: QA role is view-only" }, { status: 403 });
    }

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
        incomerCableSize: data.incomerCableSize !== undefined ? data.incomerCableSize : building.incomerCableSize,
        incomerCableLength: data.incomerCableLength !== undefined ? (data.incomerCableLength == null ? null : parseFloat(data.incomerCableLength)) : building.incomerCableLength,
        incomerInstallMethod: data.incomerInstallMethod !== undefined ? data.incomerInstallMethod : building.incomerInstallMethod,
        incomerCableInsulation: data.incomerCableInsulation !== undefined ? data.incomerCableInsulation : building.incomerCableInsulation,
        incomerCableMaterial: data.incomerCableMaterial !== undefined ? data.incomerCableMaterial : building.incomerCableMaterial,
        incomerAmbientTemp: data.incomerAmbientTemp !== undefined ? (data.incomerAmbientTemp == null ? null : parseFloat(data.incomerAmbientTemp)) : building.incomerAmbientTemp,
        incomerGroupingCount: data.incomerGroupingCount !== undefined ? (data.incomerGroupingCount == null ? null : parseInt(data.incomerGroupingCount, 10)) : building.incomerGroupingCount,
      },
    });

    const newTotalFloors = updatedBuilding.floors + updatedBuilding.serviceFloors;

    // Adjust FloorDesign objects
    if (newTotalFloors > oldTotalFloors) {
      // Add missing floors in bulk
      const missingFloors = Array.from(
        { length: newTotalFloors - oldTotalFloors },
        (_, i) => ({
          floorNumber: oldTotalFloors + 1 + i,
          buildingId: building.id,
        })
      );
      await db.floorDesign.createMany({
        data: missingFloors,
      });
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
    return errorResponse(error, "PUT Building Error");
  }
}

export async function PATCH(
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

    const auth = await verifyProjectAccess(building.projectId);
    if (auth instanceof NextResponse) return auth;

    if (auth.member.role === "QA") {
      return NextResponse.json({ error: "Forbidden: QA role is view-only" }, { status: 403 });
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.floors !== undefined) updateData.floors = parseInt(data.floors, 10);
    if (data.serviceFloors !== undefined) updateData.serviceFloors = parseInt(data.serviceFloors, 10);
    if (data.apartmentsPerFloor !== undefined) updateData.apartmentsPerFloor = parseInt(data.apartmentsPerFloor, 10);
    if (data.supplyVoltage !== undefined) updateData.supplyVoltage = data.supplyVoltage;
    if (data.earthingSystem !== undefined) updateData.earthingSystem = data.earthingSystem;
    if (data.lightningProtection !== undefined) updateData.lightningProtection = !!data.lightningProtection;
    if (data.mechanicalLoads !== undefined) updateData.mechanicalLoads = data.mechanicalLoads;
    if (data.generator !== undefined) updateData.generator = data.generator == null ? null : parseFloat(data.generator);
    if (data.transformer !== undefined) updateData.transformer = data.transformer == null ? null : parseFloat(data.transformer);
    if (data.incomerCableSize !== undefined) updateData.incomerCableSize = data.incomerCableSize;
    if (data.incomerCableLength !== undefined) updateData.incomerCableLength = data.incomerCableLength == null ? null : parseFloat(data.incomerCableLength);
    if (data.incomerInstallMethod !== undefined) updateData.incomerInstallMethod = data.incomerInstallMethod;
    if (data.incomerCableInsulation !== undefined) updateData.incomerCableInsulation = data.incomerCableInsulation;
    if (data.incomerCableMaterial !== undefined) updateData.incomerCableMaterial = data.incomerCableMaterial;
    if (data.incomerAmbientTemp !== undefined) updateData.incomerAmbientTemp = data.incomerAmbientTemp == null ? null : parseFloat(data.incomerAmbientTemp);
    if (data.incomerGroupingCount !== undefined) updateData.incomerGroupingCount = data.incomerGroupingCount == null ? null : parseInt(data.incomerGroupingCount, 10);

    const updatedBuilding = await db.building.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedBuilding);
  } catch (error) {
    return errorResponse(error, "PATCH Building Error");
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
