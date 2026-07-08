import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { calculateRoomLoad, getCountryDefaults } from "@/lib/country-defaults";

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: {
        rooms: true,
        project: true,
      },
    });

    if (!template || template.project.userId !== user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!template || template.project.userId !== user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get country defaults for AC sizing
    const countryDefaults = getCountryDefaults(template.project.country);
    if (!countryDefaults) {
      return NextResponse.json({ error: "Invalid country configuration" }, { status: 400 });
    }

    const name = data.name ?? template.name;
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
        rooms: {
          create: roomsWithLoad,
        },
      },
      include: {
        rooms: true,
      },
    });

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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.apartmentTemplate.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!template || template.project.userId !== user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

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
