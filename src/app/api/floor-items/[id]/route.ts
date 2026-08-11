import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

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

    const item = await db.floorItem.findUnique({
      where: { id },
      include: { floorDesign: { include: { building: { include: { project: true } } } } },
    });

    if (!item || item.floorDesign.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Floor item not found" }, { status: 404 });
    }

    const updateData: Record<string, string | number | null | undefined> = {};
    if (body.cableLength !== undefined) updateData.cableLength = body.cableLength;
    if (body.cableSize !== undefined) updateData.cableSize = body.cableSize;
    if (body.breakerSize !== undefined) updateData.breakerSize = body.breakerSize;
    if (body.installMethod !== undefined) updateData.installMethod = body.installMethod;
    if (body.cableInsulation !== undefined) updateData.cableInsulation = body.cableInsulation;
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const item = await db.floorItem.findUnique({
      where: { id },
      include: { floorDesign: { include: { building: { include: { project: true } } } } },
    });

    if (!item || item.floorDesign.building.project.userId !== user.id) {
      return NextResponse.json({ error: "Floor item not found" }, { status: 404 });
    }

    await db.floorItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
