import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { computeCableCircuitDiff } from "@/lib/audit-diff";
import { getApartmentDiversityFactor } from "@/lib/calculations/loads";
import { parseCableSize } from "@/lib/calculations/cables";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const item = await db.floorItem.findUnique({
      where: { id },
      include: {
        floorDesign: {
          include: {
            building: { include: { project: true } },
            items: {
              select: { id: true },
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Floor item not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(item.floorDesign.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const updateData: Record<string, string | number | null | undefined> = {};
    if (body.cableLength !== undefined) updateData.cableLength = body.cableLength;
    if (body.cableSize !== undefined) {
      // Reject strings the engine's grammar can't parse — a stored garbage
      // cable size silently falls back to catalog defaults downstream.
      if (parseCableSize(body.cableSize) === null) {
        return NextResponse.json({ error: `Invalid cable size: ${body.cableSize}` }, { status: 400 });
      }
      updateData.cableSize = body.cableSize;
    }
    if (body.breakerSize !== undefined) updateData.breakerSize = body.breakerSize;
    if (body.installMethod !== undefined) updateData.installMethod = body.installMethod;
    if (body.cableInsulation !== undefined) updateData.cableInsulation = body.cableInsulation;
    if (body.cableMaterial !== undefined) updateData.cableMaterial = body.cableMaterial;
    if (body.ambientTemp !== undefined) updateData.ambientTemp = body.ambientTemp;
    if (body.groupingCount !== undefined) updateData.groupingCount = body.groupingCount;
    if (body.assignedPhase !== undefined) {
      const ap = body.assignedPhase;
      updateData.assignedPhase = ap === null || ap === '' ? null : Math.max(1, Math.min(3, parseInt(ap)));
    }

    const updated = await db.floorItem.update({
      where: { id },
      data: updateData,
    });

    const buildingName = item.floorDesign.building?.name || "Building";
    const floorNumber = item.floorDesign.floorNumber;
    const floorLabel = (item.floorDesign as any).name || (floorNumber != null ? `Floor ${floorNumber}` : "Floor");

    let cableTag = (typeof body.cableName === "string" && body.cableName.trim()) ? body.cableName.trim() : "";
    if (!cableTag && item.floorDesign.items) {
      const itemIdx = item.floorDesign.items.findIndex((it) => it.id === item.id);
      if (itemIdx >= 0) {
        const letter = String.fromCharCode(97 + itemIdx);
        const cableTagBase = floorNumber != null ? `Wf${floorNumber}` : "Wf";
        cableTag = `${cableTagBase}${letter}`;
      }
    }

    const locationContext = cableTag
      ? `Cable ${cableTag} · ${floorLabel}`
      : floorLabel;

    const diff = computeCableCircuitDiff(
      item.name,
      locationContext,
      item,
      updateData,
      cableTag,
      buildingName,
      floorLabel
    );

    if (diff.changes.length > 0) {
      const userName = auth.user?.name || auth.user?.username || "Engineer";
      const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

      await logProjectActivity({
        projectId: item.floorDesign.building.projectId,
        userId: auth.user?.id || null,
        userName,
        userRole,
        action: "UPDATE",
        entityType: diff.category,
        entityId: id,
        description: diff.description,
        details: {
          ...diff.details,
          cableName: cableTag || null,
          floorNumber,
          floorName: floorLabel,
          buildingName: item.floorDesign.building.name,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const item = await db.floorItem.findUnique({
      where: { id },
      include: { floorDesign: { include: { building: { include: { project: true } } } } },
    });

    if (!item) {
      return NextResponse.json({ error: "Floor item not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(item.floorDesign.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    if (item.type === "APARTMENT") {
      const buildingId = item.floorDesign.buildingId;
      const remainingApartments = await db.floorItem.findMany({
        where: {
          id: { not: id },
          floorDesign: { buildingId },
          type: "APARTMENT",
        },
        include: {
          apartmentTemplate: true,
        },
      });

      const newCount = remainingApartments.length;
      const diversityFactor = getApartmentDiversityFactor(newCount);
      const project = item.floorDesign.building.project;
      const voltageKv = (project.voltage || 400) / 1000;
      const powerFactor = project.powerFactor || 0.85;

      const updates = remainingApartments.map((other) => {
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

      await db.$transaction([
        db.floorItem.delete({ where: { id } }),
        ...updates,
      ]);
    } else {
      await db.floorItem.delete({
        where: { id },
      });
    }

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";
    const itemTypeLabel = item.type === "APARTMENT"
      ? "apartment"
      : item.type.toLowerCase().replace(/_/g, " ");

    const floorLabel = (item.floorDesign as any).name || (item.floorDesign.floorNumber != null ? `Floor ${item.floorDesign.floorNumber}` : "Floor");

    await logProjectActivity({
      projectId: item.floorDesign.building.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "DELETE",
      entityType: "LOAD",
      entityId: id,
      description: `Deleted ${itemTypeLabel} "${item.name}" from floor "${floorLabel}" in "${item.floorDesign.building.name}"`,
      details: {
        itemId: id,
        name: item.name,
        type: item.type,
        floorName: floorLabel,
        buildingName: item.floorDesign.building.name,
        connectedLoadKw: item.calculatedConnectedLoad,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
