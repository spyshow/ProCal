import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Floor Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
