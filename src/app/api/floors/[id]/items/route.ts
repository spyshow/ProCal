import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: floorDesignId } = await params;
    const data = await request.json();
    const { type, name, apartmentTemplateId, loadLibraryItemId, customKw } = data;

    if (!type || !name) {
      return NextResponse.json({ error: "Type and name are required" }, { status: 400 });
    }

    const floorDesign = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: { building: { include: { project: true } } },
    });

    if (!floorDesign || floorDesign.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const project = floorDesign.building.project;
    const voltageKv = project.voltage / 1000; // 400V → 0.4 kV
    const powerFactor = project.powerFactor;

    let calculatedConnectedLoad = 0;
    let calculatedMaxDemand = 0;
    let calculatedCurrent = 0;
    let breakerSize = "";
    let cableSize = "";
    let resolvedLibraryItemId: string | null = null;

    if (type === "APARTMENT") {
      if (!apartmentTemplateId) {
        return NextResponse.json({ error: "Apartment template ID is required" }, { status: 400 });
      }
      const template = await db.apartmentTemplate.findUnique({
        where: { id: apartmentTemplateId },
        include: { rooms: true },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      // Calculate total connected load from rooms
      const totalConnectedLoadVA = template.rooms.reduce(
        (sum, room) => sum + room.connectedLoad,
        0
      );

      calculatedConnectedLoad = totalConnectedLoadVA / 1000; // Convert to kW
      calculatedMaxDemand = calculatedConnectedLoad * 0.4; // Demand factor 0.4

      // Phase-aware current calculation (kW-based, PF applied)
      const isThreePhase = template.phases === 3;
      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
      } else {
        calculatedCurrent = calculatedMaxDemand / (voltageKv * powerFactor);
      }

      // Size breaker and cable based on calculated current
      const sizing = sizeCableAndBreaker(calculatedCurrent, isThreePhase, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 1,
      });
      breakerSize = `${sizing.breakerSize}A`;
      cableSize = `${sizing.cableSize} mm²`;
    } else if (loadLibraryItemId) {
      // Use Load Library item for calculations
      const libraryItem = await db.loadLibraryItem.findUnique({
        where: { id: loadLibraryItemId },
      });
      if (!libraryItem) {
        return NextResponse.json({ error: "Load Library item not found" }, { status: 404 });
      }

      resolvedLibraryItemId = libraryItem.id;
      const isThreePhase = libraryItem.phase === 3;
      const totalPower = libraryItem.power * libraryItem.quantity; // kW

      calculatedConnectedLoad = totalPower;
      calculatedMaxDemand = totalPower * libraryItem.demandFactor;

      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * (libraryItem.voltage / 1000) * libraryItem.powerFactor);
      } else {
        calculatedCurrent = calculatedMaxDemand / ((libraryItem.voltage / 1000) * libraryItem.powerFactor);
      }
      calculatedCurrent = parseFloat(calculatedCurrent.toFixed(2));

      const sizing = sizeCableAndBreaker(calculatedCurrent, isThreePhase, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 2,
      });

      breakerSize = `${sizing.breakerSize}A`;
      cableSize = `${sizing.cableSize} mm²`;
    } else {
      // Manual kW entry (fallback)
      let kw = parseFloat(customKw) || 0;
      let df = 1.0;
      const isThreePhase = true;

      if (type === "SERVICE_PANEL") {
        kw = kw || 15;
        df = 0.8;
      } else if (type === "PUMP_PANEL") {
        kw = kw || 7.5;
        df = 1.0;
      } else if (type === "ELEVATOR_PANEL") {
        kw = kw || 22;
        df = 0.8;
      }

      calculatedConnectedLoad = kw;
      calculatedMaxDemand = kw * df;

      calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
      calculatedCurrent = parseFloat(calculatedCurrent.toFixed(2));

      const sizing = sizeCableAndBreaker(calculatedCurrent, isThreePhase, {
        material: "copper",
        insulation: "XLPE",
        ambientTemp: 30,
        groupingCount: 2,
      });

      breakerSize = `${sizing.breakerSize}A`;
      cableSize = `${sizing.cableSize} mm²`;
    }

    const item = await db.floorItem.create({
      data: {
        type,
        name,
        apartmentTemplateId: type === "APARTMENT" ? apartmentTemplateId : null,
        loadLibraryItemId: resolvedLibraryItemId,
        floorDesignId,
        calculatedConnectedLoad,
        calculatedMaxDemand,
        calculatedCurrent,
        breakerSize,
        cableSize,
        voltageDrop: 0.1,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("POST Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
