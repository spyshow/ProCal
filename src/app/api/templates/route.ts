import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { assertOneOf } from "@/lib/calculations/validate";
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
    const data = await request.json();
    const { projectId, name, rooms, phases } = data;

    if (!projectId || !name || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // phases persists and gates every downstream 1φ/3φ branch — only 1 or 3
    // are valid. CalculationError → 400 via errorResponse.
    const phasesNum = Number(phases) || 1;
    assertOneOf("phases", phasesNum, [1, 3]);

    const auth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const project = auth.project;

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

    // Engineering Sizing preview — uses the SAME convention as the floor-items
    // route (connected watts → kW, PF applied, phase-aware project voltage).
    // The old preview treated connected W as VA, divided by a hardcoded 230 V
    // and ignored PF/phases — ~17.6% off the stored calculatedCurrent for
    // every apartment built from this template.
    const totalConnectedLoadW = roomsWithLoad.reduce((sum, room) => sum + room.connectedLoad, 0);
    const demandFactor = 0.4; // standard residential apartment demand factor
    const powerFactor = project.powerFactor || 0.85;
    const voltageLL = project.voltage || 400;
    const isThreePhase = phasesNum === 3;
    const connectedLoadKw = totalConnectedLoadW / 1000;
    const maxDemandKw = connectedLoadKw * demandFactor;
    const estimatedCurrentA = isThreePhase
      ? maxDemandKw / (Math.sqrt(3) * (voltageLL / 1000) * powerFactor)
      : maxDemandKw / ((voltageLL / Math.sqrt(3) / 1000) * powerFactor);

    const sizingPreview = sizeCableAndBreaker(estimatedCurrentA, isThreePhase, {
      material: "copper",
      insulation: "XLPE",
      ambientTemp: project.ambientTemp ?? 30,
      groupingCount: 1,
    });

    // Create template with rooms
    const template = await db.apartmentTemplate.create({
      data: {
        name,
        phases: phasesNum,
        projectId,
        rooms: {
          create: roomsWithLoad,
        },
      },
      include: {
        rooms: true,
      },
    });

    return NextResponse.json({
      ...template,
      sizingPreview: {
        connectedLoadKw,
        demandFactor,
        maxDemandKw,
        phases: isThreePhase ? 3 : 1,
        voltageLL,
        powerFactor,
        estimatedCurrentA: parseFloat(estimatedCurrentA.toFixed(2)),
        recommendedBreakerA: sizingPreview.breakerSize,
        recommendedCableSize: sizingPreview.formattedCableSize,
      },
    });
  } catch (error) {
    return errorResponse(error, "POST Template Error");
  }
}
