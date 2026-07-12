import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { calculateRoomLoad, getCountryDefaults } from "@/lib/country-defaults";

interface RoomInput {
  type: string;
  name: string;
  area: number;
  hasAc: boolean;
  loadDensity: number;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { projectId, name, rooms, phases } = data;

    if (!projectId || !name || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get country defaults for AC sizing
    const countryDefaults = getCountryDefaults(project.country);
    if (!countryDefaults) {
      return NextResponse.json({ error: "Invalid country configuration" }, { status: 400 });
    }

    // Calculate connected load for each room
    const roomsWithLoad = rooms.map((room: RoomInput) => {
      const connectedLoad = calculateRoomLoad(
        room.area,
        room.loadDensity,
        room.hasAc,
        countryDefaults.acSizingRules
      );

      // Auto-calculate AC BTU if hasAc
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

    // Calculate total connected load for sizing
    const totalConnectedLoad = roomsWithLoad.reduce((sum, room) => sum + room.connectedLoad, 0);

    // Engineering Sizing logic
    const demandFactor = 0.4; // standard residential apartment demand factor
    const maxDemandKva = (totalConnectedLoad * demandFactor) / 1000;
    const ib = maxDemandKva / 0.23; // 230V single phase current

    sizeCableAndBreaker(ib, false, {
      material: "copper",
      insulation: "XLPE",
      ambientTemp: 30,
      groupingCount: 1,
    });

    // Create template with rooms
    const template = await db.apartmentTemplate.create({
      data: {
        name,
        phases: Number(phases) || 1,
        projectId,
        rooms: {
          create: roomsWithLoad,
        },
      },
      include: {
        rooms: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("POST Template Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
