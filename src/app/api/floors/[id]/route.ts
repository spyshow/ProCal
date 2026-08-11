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

export async function PATCH(
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
        riserCableLength: data.riserCableLength ?? floor.riserCableLength,
        riserCableSize: data.riserCableSize ?? floor.riserCableSize,
        riserInstallMethod: data.riserInstallMethod ?? floor.riserInstallMethod,
        riserCableInsulation: data.riserCableInsulation ?? floor.riserCableInsulation,
        riserAmbientTemp: data.riserAmbientTemp ?? floor.riserAmbientTemp,
        riserGroupingCount: data.riserGroupingCount ?? floor.riserGroupingCount,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH FloorDesign Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
