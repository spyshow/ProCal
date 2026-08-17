import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";

// Attach a load-library item to a building (a "Building Load").
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: buildingId } = await params;
    const { loadLibraryItemId, quantity, cableMaterial } = await request.json();

    if (!loadLibraryItemId) {
      return NextResponse.json({ error: "loadLibraryItemId is required" }, { status: 400 });
    }

    const building = await db.building.findUnique({
      where: { id: buildingId },
      include: { project: true },
    });
    if (!building || building.project.userId !== user.id) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    // Ownership: the library item must belong to the same project as the building.
    const libraryItem = await db.loadLibraryItem.findUnique({
      where: { id: loadLibraryItemId },
    });
    if (!libraryItem || libraryItem.projectId !== building.projectId) {
      return NextResponse.json({ error: "Load Library item not found" }, { status: 404 });
    }

    const qty = Math.max(1, parseInt(quantity) || 1);

    // Compute an initial cable size from the library item's power × quantity,
    // mirroring FloorItem creation in /api/floors/[id]/items.
    const totalPower = libraryItem.power * qty; // kW
    const isThreePhase = libraryItem.phase === 3;
    const current = isThreePhase
      ? totalPower / (Math.sqrt(3) * (libraryItem.voltage / 1000) * libraryItem.powerFactor)
      : totalPower / ((libraryItem.voltage / 1000) * libraryItem.powerFactor);
    const material: 'copper' | 'aluminum' =
      cableMaterial === 'aluminum' ? 'aluminum' : 'copper';
    const sizing = sizeCableAndBreaker(current, isThreePhase, {
      material,
      insulation: "XLPE",
      ambientTemp: 30,
      groupingCount: 1,
    });
    // formattedCableSize keeps parallel runs ("2 × 120 mm²").
    const cableSize = sizing.formattedCableSize;

    const created = await db.buildingLoad.create({
      data: {
        buildingId,
        loadLibraryItemId,
        quantity: qty,
        cableSize,
        installMethod: "C",
        cableInsulation: "XLPE",
        cableMaterial: material,
      },
      include: { loadLibraryItem: true },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("POST Building Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
