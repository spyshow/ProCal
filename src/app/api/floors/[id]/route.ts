import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const floor = await db.floorDesign.findUnique({ where: { id } });
    if (!floor) {
      return NextResponse.json({ error: "Floor not found" }, { status: 404 });
    }

    const updated = await db.floorDesign.update({
      where: { id },
      data: {
        hasFloorSubPanels: data.hasFloorSubPanels ?? floor.hasFloorSubPanels,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT FloorDesign Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
