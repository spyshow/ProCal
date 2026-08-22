import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { calculateRoomLoad, getCountryDefaults } from "@/lib/country-defaults";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";

interface RoomInput {
  type: string;
  name: string;
  area: number;
  hasAc: boolean;
  loadDensity: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: {
        rooms: true,
        project: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(template.projectId, {
      requiredAction: "VIEW",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json(template);
  } catch (error) {
    console.error("GET Template Error:", error);
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

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(template.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    // Get country defaults for AC sizing
    const countryDefaults = getCountryDefaults(template.project.country);
    if (!countryDefaults) {
      return NextResponse.json({ error: "Invalid country configuration" }, { status: 400 });
    }

    const name = data.name ?? template.name;
    const phases = data.phases !== undefined ? Number(data.phases) : template.phases;
    const rooms = data.rooms;

    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "At least one room is required" }, { status: 400 });
    }

    // Calculate connected load for each room
    const roomsWithLoad = rooms.map((room: RoomInput) => {
      const connectedLoad = calculateRoomLoad(
        room.area,
        room.loadDensity,
        room.hasAc,
        countryDefaults.acSizingRules
      );

      let acBtu: number | null = null;
      if (room.hasAc) {
        const acRule = countryDefaults.acSizingRules.find((r) => room.area <= r.maxArea)
          || countryDefaults.acSizingRules[countryDefaults.acSizingRules.length - 1];
        acBtu = acRule.btu;
      }

      return {
        type: room.type,
        name: room.name,
        area: room.area,
        hasAc: room.hasAc,
        acBtu,
        loadDensity: room.loadDensity,
        connectedLoad,
      };
    });

    // Delete existing rooms and create new ones
    await db.apartmentRoom.deleteMany({
      where: { templateId: id },
    });

    const updatedTemplate = await db.apartmentTemplate.update({
      where: { id },
      data: {
        name,
        phases,
        rooms: {
          create: roomsWithLoad,
        },
      },
      include: {
        rooms: true,
      },
    });

    // Recalculate any floor items that use this template across all buildings in the project
    const affectedItems = await db.floorItem.findMany({
      where: { apartmentTemplateId: id },
      include: {
        floorDesign: {
          include: {
            building: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (affectedItems.length > 0) {
      const buildingIds = [...new Set(affectedItems.map((item) => item.floorDesign.buildingId))];
      for (const buildingId of buildingIds) {
        const totalAptCount = await db.floorItem.count({
          where: {
            floorDesign: { buildingId },
            type: "APARTMENT",
          },
        });
        const diversityFactor = getApartmentDiversityFactor(totalAptCount);
        const totalConnectedLoadVA = roomsWithLoad.reduce((sum, r) => sum + r.connectedLoad, 0);
        const calculatedConnectedLoad = totalConnectedLoadVA / 1000;
        const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;
        const isThreePhase = Number(phases) === 3;

        const buildingItems = affectedItems.filter((item) => item.floorDesign.buildingId === buildingId);
        const updates = [];
        for (const item of buildingItems) {
          const project = item.floorDesign.building.project;
          const voltageKv = (project.voltage || 400) / 1000;
          const powerFactor = project.powerFactor || 0.85;

          let calculatedCurrent: number;
          if (isThreePhase) {
            calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
          } else {
            calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
          }

          updates.push(
            db.floorItem.update({
              where: { id: item.id },
              data: {
                calculatedConnectedLoad,
                calculatedMaxDemand,
                calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
              },
            })
          );
        }
        if (updates.length > 0) {
          await db.$transaction(updates);
        }
      }
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("PUT Template Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(template.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    // Delete rooms first (cascade should handle this, but being explicit)
    await db.apartmentRoom.deleteMany({
      where: { templateId: id },
    });

    await db.apartmentTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Template Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
