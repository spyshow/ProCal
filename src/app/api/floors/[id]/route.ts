import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { computeFloorDiff } from "@/lib/audit-diff";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const floor = await db.floorDesign.findUnique({
      where: { id },
      include: { building: { include: { project: true } } },
    });
    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(floor.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
      cachedProject: floor.building.project,
    });
    if (auth instanceof NextResponse) return auth;

    const updated = await db.floorDesign.update({
      where: { id },
      data: {
        hasFloorSubPanels: data.hasFloorSubPanels ?? floor.hasFloorSubPanels,
      },
    });

    const floorLabel = `Floor ${floor.floorNumber}`;
    const riserCableTag = `Wsdb${floor.floorNumber}`;
    const diff = computeFloorDiff(floorLabel, floor.building.name, floor, data, riserCableTag);
    if (diff.changes.length > 0) {
      const userName = auth.user?.name || auth.user?.username || "Engineer";
      const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

      // Fire and forget audit logging so the client receives the response immediately
      void logProjectActivity({
        projectId: floor.building.projectId,
        userId: auth.user?.id || null,
        userName,
        userRole,
        action: "UPDATE",
        entityType: diff.category,
        entityId: floor.id,
        description: diff.description,
        details: diff.details,
      }).catch((err) => console.error("PUT FloorDesign audit log error:", err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT FloorDesign Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const floor = await db.floorDesign.findUnique({
      where: { id },
      include: { building: { include: { project: true } } },
    });
    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(floor.building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
      cachedProject: floor.building.project,
    });
    if (auth instanceof NextResponse) return auth;

    const updated = await db.floorDesign.update({
      where: { id },
      data: {
        hasFloorSubPanels: data.hasFloorSubPanels ?? floor.hasFloorSubPanels,
        riserCableLength: data.riserCableLength ?? floor.riserCableLength,
        riserCableSize: data.riserCableSize ?? floor.riserCableSize,
        riserBreakerSize: data.riserBreakerSize ?? floor.riserBreakerSize,
        riserInstallMethod: data.riserInstallMethod ?? floor.riserInstallMethod,
        riserCableInsulation: data.riserCableInsulation ?? floor.riserCableInsulation,
        riserCableMaterial: data.riserCableMaterial ?? floor.riserCableMaterial,
        riserAmbientTemp: data.riserAmbientTemp ?? floor.riserAmbientTemp,
        riserGroupingCount: data.riserGroupingCount ?? floor.riserGroupingCount,
      },
    });

    const floorLabel = `Floor ${floor.floorNumber}`;
    const riserCableTag = (typeof data.cableName === 'string' && data.cableName.trim())
      ? data.cableName.trim()
      : `Wsdb${floor.floorNumber}`;
    const diff = computeFloorDiff(floorLabel, floor.building.name, floor, data, riserCableTag);
    if (diff.changes.length > 0) {
      const userName = auth.user?.name || auth.user?.username || "Engineer";
      const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

      // Fire and forget audit logging so the client receives the response immediately
      void logProjectActivity({
        projectId: floor.building.projectId,
        userId: auth.user?.id || null,
        userName,
        userRole,
        action: "UPDATE",
        entityType: diff.category,
        entityId: floor.id,
        description: diff.description,
        details: diff.details,
      }).catch((err) => console.error("PATCH FloorDesign audit log error:", err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH FloorDesign Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
