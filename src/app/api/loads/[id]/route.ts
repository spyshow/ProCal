import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const loadItem = await db.loadLibraryItem.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!loadItem || loadItem.project.userId !== user.id) {
      return NextResponse.json({ error: "Load item not found" }, { status: 404 });
    }

    const name = data.name ?? loadItem.name;
    const category = data.category ?? loadItem.category;
    const power = data.power !== undefined ? parseFloat(data.power) : loadItem.power;
    const voltage = data.voltage !== undefined ? parseFloat(data.voltage) : loadItem.voltage;
    const phase = data.phase !== undefined ? parseInt(data.phase) : loadItem.phase;
    const powerFactor = data.powerFactor !== undefined ? parseFloat(data.powerFactor) : loadItem.powerFactor;
    const demandFactor = data.demandFactor !== undefined ? parseFloat(data.demandFactor) : loadItem.demandFactor;
    const quantity = data.quantity !== undefined ? parseInt(data.quantity) : loadItem.quantity;
    const startingCurrent = data.startingCurrent !== undefined ? (data.startingCurrent ? parseFloat(data.startingCurrent) : null) : loadItem.startingCurrent;
    const notes = data.notes ?? loadItem.notes;

    // Recalculate running current
    let runningCurrent = 0;
    if (phase === 3) {
      runningCurrent = (power * quantity * demandFactor) / (Math.sqrt(3) * (voltage / 1000) * powerFactor);
    } else {
      runningCurrent = (power * quantity * demandFactor) / ((voltage / 1000) * powerFactor);
    }
    runningCurrent = parseFloat(runningCurrent.toFixed(2));

    const updatedLoadItem = await db.loadLibraryItem.update({
      where: { id },
      data: {
        name,
        category,
        power,
        voltage,
        phase,
        powerFactor,
        demandFactor,
        quantity,
        runningCurrent,
        startingCurrent,
        notes,
      },
    });

    return NextResponse.json(updatedLoadItem);
  } catch (error) {
    console.error("PUT Load Error:", error);
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

    const loadItem = await db.loadLibraryItem.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!loadItem || loadItem.project.userId !== user.id) {
      return NextResponse.json({ error: "Load item not found" }, { status: 404 });
    }

    await db.loadLibraryItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
