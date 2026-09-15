import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";
import { errorResponse } from "@/lib/api-errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceFloorId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.targetFloorIds) || body.targetFloorIds.length === 0) {
      return NextResponse.json(
        { error: "targetFloorIds array is required" },
        { status: 400 }
      );
    }

    const targetFloorIds: string[] = body.targetFloorIds.filter(
      (id: unknown) => typeof id === "string" && id !== sourceFloorId
    );

    if (targetFloorIds.length === 0) {
      return NextResponse.json({ count: 0, message: "No target floors specified" });
    }

    const sourceFloor = await db.floorDesign.findUnique({
      where: { id: sourceFloorId },
      include: {
        building: {
          include: {
            project: true,
          },
        },
        items: {
          include: {
            apartmentTemplate: {
              include: { rooms: true },
            },
            loadLibraryItem: true,
          },
        },
      },
    });

    if (!sourceFloor) {
      return NextResponse.json({ error: "Source floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(sourceFloor.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    if (sourceFloor.items.length === 0) {
      return NextResponse.json({ count: 0, message: "Source floor has no items to copy" });
    }

    // Ensure all target floors belong to the same building
    const targetFloors = await db.floorDesign.findMany({
      where: {
        id: { in: targetFloorIds },
        buildingId: sourceFloor.buildingId,
      },
      select: { id: true },
    });

    if (targetFloors.length === 0) {
      return NextResponse.json({ error: "No valid target floors found in this building" }, { status: 400 });
    }

    const validTargetFloorIds = targetFloors.map((f) => f.id);

    // Calculate total apartment count after copying to accurately compute diversity factor
    const existingAptCount = await db.floorItem.count({
      where: {
        floorDesign: { buildingId: sourceFloor.buildingId },
        type: "APARTMENT",
      },
    });

    const aptItemsInSource = sourceFloor.items.filter((i) => i.type === "APARTMENT").length;
    const totalNewApts = aptItemsInSource * validTargetFloorIds.length;
    const newTotalAptCount = existingAptCount + totalNewApts;
    const diversityFactor = getApartmentDiversityFactor(newTotalAptCount);

    const project = sourceFloor.building.project;
    const voltageKv = project.voltage / 1000;
    const powerFactor = project.powerFactor;

    // Prepare items to create
    const itemsToCreate = validTargetFloorIds.flatMap((targetFloorId) =>
      sourceFloor.items.map((item) => {
        let calculatedConnectedLoad = item.calculatedConnectedLoad;
        let calculatedMaxDemand = item.calculatedMaxDemand;
        let calculatedCurrent = item.calculatedCurrent;
        let breakerSize = item.breakerSize;
        let cableSize = item.cableSize;

        if (item.type === "APARTMENT" && item.apartmentTemplate) {
          const totalConnectedLoadVA = item.apartmentTemplate.rooms.reduce(
            (sum, room) => sum + room.connectedLoad,
            0
          );
          calculatedConnectedLoad = totalConnectedLoadVA / 1000;
          calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;

          const isThreePhase = item.apartmentTemplate.phases === 3;
          if (isThreePhase) {
            calculatedCurrent = calculatedMaxDemand / (Math.sqrt(3) * voltageKv * powerFactor);
          } else {
            calculatedCurrent = calculatedMaxDemand / ((voltageKv / Math.sqrt(3)) * powerFactor);
          }
          calculatedCurrent = parseFloat(calculatedCurrent.toFixed(2));
        }

        return {
          type: item.type,
          name: item.name,
          apartmentTemplateId: item.apartmentTemplateId,
          loadLibraryItemId: item.loadLibraryItemId,
          floorDesignId: targetFloorId,
          calculatedConnectedLoad,
          calculatedMaxDemand,
          calculatedCurrent,
          breakerSize,
          cableSize,
          cableLength: item.cableLength,
          voltageDrop: item.voltageDrop ?? null,
          installMethod: item.installMethod ?? "C",
          cableInsulation: item.cableInsulation ?? "XLPE",
          cableMaterial: item.cableMaterial ?? "copper",
          ambientTemp: item.ambientTemp ?? 30,
          groupingCount: item.groupingCount ?? 1,
          assignedPhase: item.assignedPhase,
        };
      })
    );

    // Bulk insert all items in a single DB query
    await db.floorItem.createMany({
      data: itemsToCreate,
    });

    // If apartments were copied, sync all pre-existing apartments in the building
    // to the new unified diversity factor.
    if (aptItemsInSource > 0) {
      const existingApartments = await db.floorItem.findMany({
        where: {
          floorDesign: {
            buildingId: sourceFloor.buildingId,
            id: { notIn: validTargetFloorIds },
          },
          type: "APARTMENT",
        },
        include: {
          apartmentTemplate: true,
        },
      });

      if (existingApartments.length > 0) {
        const syncUpdates = existingApartments.map((other) => {
          const is3Ph = other.apartmentTemplate?.phases === 3;
          const maxDem = other.calculatedConnectedLoad * diversityFactor;
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

    const sourceFloorLabel = `Floor ${sourceFloor.floorNumber}`;

    await logProjectActivity({
      projectId: sourceFloor.building.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "CREATE",
      entityType: "LOAD",
      entityId: sourceFloorId,
      description: `Copied ${sourceFloor.items.length} items from floor "${sourceFloorLabel}" to ${validTargetFloorIds.length} floors in "${sourceFloor.building.name}" (${itemsToCreate.length} total items)`,
      details: {
        sourceFloorId,
        sourceFloorNumber: sourceFloor.floorNumber,
        sourceFloorName: sourceFloorLabel,
        buildingName: sourceFloor.building.name,
        itemsPerFloor: sourceFloor.items.length,
        targetFloorsCount: validTargetFloorIds.length,
        totalItemsCreated: itemsToCreate.length,
        changes: [
          { field: "sourceFloor", label: "Source Floor", newValue: sourceFloorLabel },
          { field: "itemsPerFloor", label: "Items Copied", newValue: sourceFloor.items.length },
          { field: "targetFloors", label: "Target Floors Count", newValue: validTargetFloorIds.length },
          { field: "totalItems", label: "Total Created", newValue: itemsToCreate.length },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      copiedItemsCount: itemsToCreate.length,
      targetFloorsCount: validTargetFloorIds.length,
    });
  } catch (error) {
    return errorResponse(error, "POST copy-items Error");
  }
}
