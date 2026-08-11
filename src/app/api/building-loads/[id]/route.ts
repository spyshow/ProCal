import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Update a building load (quantity and/or cable fields).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const load = await db.buildingLoad.findUnique({
      where: { id },
      include: { building: { include: { project: true } } },
    });
    if (!load || load.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building load not found" }, { status: 404 });
    }

    const updateData: Record<string, string | number | null | undefined> = {};
    if (body.quantity !== undefined) updateData.quantity = Math.max(1, parseInt(body.quantity) || 1);
    if (body.cableLength !== undefined) updateData.cableLength = body.cableLength;
    if (body.cableSize !== undefined) updateData.cableSize = body.cableSize;
    if (body.installMethod !== undefined) updateData.installMethod = body.installMethod;
    if (body.cableInsulation !== undefined) updateData.cableInsulation = body.cableInsulation;
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const load = await db.buildingLoad.findUnique({
      where: { id },
      include: { building: { include: { project: true } } },
    });
    if (!load || load.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building load not found" }, { status: 404 });
    }

    await db.buildingLoad.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Building Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
