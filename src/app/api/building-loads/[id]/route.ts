import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { computeCableCircuitDiff } from "@/lib/audit-diff";
import { parseCableSize } from "@/lib/calculations/cables";

// Update a building load (quantity and/or cable fields).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const load = await db.buildingLoad.findUnique({
      where: { id },
      include: {
        building: { include: { project: true } },
        loadLibraryItem: true,
      },
    });
    if (!load) {
      return NextResponse.json({ error: "Building load not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(load.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const updateData: Record<string, string | number | null | undefined> = {};
    if (body.quantity !== undefined) updateData.quantity = Math.max(1, parseInt(body.quantity) || 1);
    if (body.breakerSize !== undefined) updateData.breakerSize = body.breakerSize;
    if (body.cableLength !== undefined) updateData.cableLength = body.cableLength;
    if (body.cableSize !== undefined) {
      // Reject strings the engine's grammar can't parse — a stored garbage
      // cable size silently falls back to catalog defaults downstream.
      if (parseCableSize(body.cableSize) === null) {
        return NextResponse.json({ error: `Invalid cable size: ${body.cableSize}` }, { status: 400 });
      }
      updateData.cableSize = body.cableSize;
    }
    if (body.installMethod !== undefined) updateData.installMethod = body.installMethod;
    if (body.cableInsulation !== undefined) updateData.cableInsulation = body.cableInsulation;
    if (body.cableMaterial !== undefined) updateData.cableMaterial = body.cableMaterial;
    if (body.ambientTemp !== undefined) updateData.ambientTemp = body.ambientTemp;
    if (body.groupingCount !== undefined) updateData.groupingCount = body.groupingCount;
    if (body.assignedPhase !== undefined) {
      const ap = body.assignedPhase;
      updateData.assignedPhase = ap === null || ap === '' ? null : Math.max(1, Math.min(3, parseInt(ap)));
    }

    const updated = await db.buildingLoad.update({
      where: { id },
      data: updateData,
      include: { loadLibraryItem: true },
    });

    const buildingName = load.building?.name || "Building";
    let cableTag = (typeof body.cableName === "string" && body.cableName.trim()) ? body.cableName.trim() : "";
    if (!cableTag) {
      const allLoads = await db.buildingLoad.findMany({
        where: { buildingId: load.buildingId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      const idx = allLoads.findIndex((l) => l.id === load.id);
      if (idx >= 0) {
        const letter = String.fromCharCode(97 + idx);
        cableTag = `Wbl${letter}`;
      }
    }

    const locationContext = cableTag
      ? `Cable ${cableTag} · ${buildingName}`
      : buildingName;
    const targetName = load.loadLibraryItem?.name || "Central Load";

    const diff = computeCableCircuitDiff(targetName, locationContext, load, updateData, cableTag, buildingName, null);

    if (diff.changes.length > 0) {
      const userName = auth.user?.name || auth.user?.username || "Engineer";
      const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

      await logProjectActivity({
        projectId: load.building.projectId,
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
          buildingName,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH Building Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const load = await db.buildingLoad.findUnique({
      where: { id },
      include: {
        building: { include: { project: true } },
        loadLibraryItem: true,
      },
    });
    if (!load) {
      return NextResponse.json({ error: "Building load not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(load.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    await db.buildingLoad.delete({ where: { id } });

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

    const loadName = load.loadLibraryItem?.name || "Building Load";
    const buildingName = load.building?.name || "Building";

    await logProjectActivity({
      projectId: load.building.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "DELETE",
      entityType: "BUILDING_LOAD",
      entityId: id,
      description: `Deleted building load "${loadName}" from "${buildingName}"`,
      details: {
        name: loadName,
        buildingName,
        quantity: load.quantity,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Building Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
