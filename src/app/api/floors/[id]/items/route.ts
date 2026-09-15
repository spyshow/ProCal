import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";
import { assertNonNegative } from "@/lib/calculations/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: floorDesignId } = await params;
    const data = await request.json();
    const { type, name, apartmentTemplateId, loadLibraryItemId, customKw, cableMaterial } = data;
    const material: 'copper' | 'aluminum' =
      cableMaterial === 'aluminum' ? 'aluminum' : 'copper';

    if (!type || !name) {
      return NextResponse.json({ error: "Type and name are required" }, { status: 400 });
    }

    const floorDesign = await db.floorDesign.findUnique({
      where: { id: floorDesignId },
      include: { building: { include: { project: true } } },
    });

    if (!floorDesign) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(floorDesign.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const project = floorDesign.building.project;
    const voltageKv = project.voltage / 1000; // 400V → 0.4 kV
    const powerFactor = project.powerFactor;

    let calculatedConnectedLoad = 0;
    let calculatedMaxDemand = 0;
    let calculatedCurrent = 0;
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
      // Apply the IEC diversity factor for the POST-INSERT apartment count:
      // this request creates exactly one more APARTMENT, so every apartment in
      // the building resolves against the same final count and shares one
      // factor. The pre-insert count gave the Nth apartment the factor of an
      // N-1 apartment building until the next recalculate healed it.
      const aptCountBeforeInsert = await db.floorItem.count({
        where: { floorDesign: { buildingId: floorDesign.buildingId }, type: "APARTMENT" },
      });
      calculatedMaxDemand =
        calculatedConnectedLoad * getApartmentDiversityFactor(aptCountBeforeInsert + 1);

      // Phase-aware current calculation (kW-based, PF applied)
      const isThreePhase = template.phases === 3;
      if (isThreePhase) {
        calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
      } else {
        // 1-phase: use V_LN = V_LL / √3 (e.g. 230V for a 400V system)
        calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
      }
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
    } else {
      // Manual kW entry (fallback)
      let kw = parseFloat(customKw) || 0;
      // NaN already coerced to 0 above; block negative entries so a negative
      // current never persists. CalculationError → 400 via errorResponse.
      assertNonNegative("customKw", kw);
      let df = 1.0;

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
        cableMaterial: material,
      },
    });

    // If an apartment was added, ensure all existing apartments in the building
    // are synced to the new unified diversity factor.
    if (type === "APARTMENT") {
      const otherApartments = await db.floorItem.findMany({
        where: {
          id: { not: item.id },
          floorDesign: { buildingId: floorDesign.buildingId },
          type: "APARTMENT",
        },
        include: {
          apartmentTemplate: true,
        },
      });

      if (otherApartments.length > 0) {
        const aptDiversityFactor = getApartmentDiversityFactor(otherApartments.length + 1);
        const syncUpdates = otherApartments.map((other) => {
          const is3Ph = other.apartmentTemplate?.phases === 3;
          const maxDem = other.calculatedConnectedLoad * aptDiversityFactor;
          const curr = is3Ph
            ? maxDem / (Math.sqrt(3) * voltageKv * powerFactor)
            : maxDem / ((voltageKv / Math.sqrt(3)) * powerFactor);
          return db.floorItem.update({
            where: { id: other.id },
            data: {
              calculatedMaxDemand: maxDem,
              calculatedCurrent: parseFloat(curr.toFixed(2)),
            },
          });
        });
        await db.$transaction(syncUpdates);
      }
    }

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";
    const itemTypeLabel = item.type === "APARTMENT"
      ? "apartment"
      : item.type.toLowerCase().replace(/_/g, " ");

    const floorLabel = (floorDesign as any).name || (floorDesign.floorNumber != null ? `Floor ${floorDesign.floorNumber}` : "Floor");

    await logProjectActivity({
      projectId: project.id,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "CREATE",
      entityType: "LOAD",
      entityId: item.id,
      description: `Added ${itemTypeLabel} "${item.name}" to floor "${floorLabel}" in "${floorDesign.building.name}" (${item.calculatedConnectedLoad} kW, ${item.calculatedCurrent} A)`,
      details: {
        itemId: item.id,
        name: item.name,
        type: item.type,
        floorId: floorDesignId,
        floorNumber: floorDesign.floorNumber,
        floorName: floorLabel,
        buildingId: floorDesign.buildingId,
        buildingName: floorDesign.building.name,
        connectedLoadKw: item.calculatedConnectedLoad,
        maxDemandKw: item.calculatedMaxDemand,
        currentA: item.calculatedCurrent,
        cableMaterial: item.cableMaterial,
        changes: [
          { field: "name", label: "Name", newValue: item.name },
          { field: "type", label: "Type", newValue: item.type },
          { field: "floor", label: "Floor", newValue: floorLabel },
          { field: "building", label: "Building", newValue: floorDesign.building.name },
          { field: "connectedLoad", label: "Connected Load", newValue: `${item.calculatedConnectedLoad} kW` },
          { field: "maxDemand", label: "Max Demand", newValue: `${item.calculatedMaxDemand} kW` },
          { field: "current", label: "Design Current", newValue: `${item.calculatedCurrent} A` },
        ],
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return errorResponse(error, "POST Floor Item Error");
  }
}
