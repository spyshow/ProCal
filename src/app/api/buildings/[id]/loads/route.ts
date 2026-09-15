import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";

// Attach a load-library item to a building (a "Building Load").
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    const { loadLibraryItemId, quantity, cableMaterial } = await request.json();

    if (!loadLibraryItemId) {
      return NextResponse.json({ error: "loadLibraryItemId is required" }, { status: 400 });
    }

    const building = await db.building.findUnique({
      where: { id: buildingId },
      include: { project: true },
    });
    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(building.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

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

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

    await logProjectActivity({
      projectId: building.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "CREATE",
      entityType: "BUILDING_LOAD",
      entityId: created.id,
      description: `Added building load "${libraryItem.name}" (Qty: ${qty}, ${totalPower} kW) to "${building.name}"`,
      details: {
        buildingId,
        buildingName: building.name,
        loadLibraryItemId,
        name: libraryItem.name,
        quantity: qty,
        totalPowerKw: totalPower,
        cableSize,
        cableMaterial: material,
        changes: [
          { field: "load", label: "Load", newValue: libraryItem.name },
          { field: "building", label: "Building", newValue: building.name },
          { field: "quantity", label: "Quantity", newValue: qty },
          { field: "power", label: "Total Power", newValue: `${totalPower} kW` },
          { field: "cableSize", label: "Cable Size", newValue: cableSize },
        ],
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    return errorResponse(error, "POST Building Load Error");
  }
}
