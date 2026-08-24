import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { assertOneOf, assertPositive, clampPowerFactor } from "@/lib/calculations/validate";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const loadItem = await db.loadLibraryItem.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!loadItem) {
      return NextResponse.json({ error: "Load item not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(loadItem.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const name = data.name ?? loadItem.name;
    const category = data.category ?? loadItem.category;
    const power = data.power !== undefined ? parseFloat(data.power) : loadItem.power;
    const voltage = data.voltage !== undefined ? parseFloat(data.voltage) : loadItem.voltage;
    const phase = data.phase !== undefined ? parseInt(data.phase) : loadItem.phase;
    const powerFactor = data.powerFactor !== undefined ? parseFloat(data.powerFactor) : loadItem.powerFactor;
    const demandFactor = data.demandFactor !== undefined ? parseFloat(data.demandFactor) : loadItem.demandFactor;
    const quantity = data.quantity !== undefined ? Math.max(1, parseInt(data.quantity) || 1) : loadItem.quantity;
    const startingCurrent = data.startingCurrent !== undefined ? (data.startingCurrent ? parseFloat(data.startingCurrent) : null) : loadItem.startingCurrent;
    const notes = data.notes ?? loadItem.notes;

    // Trust-boundary validation on the merged values (CalculationError → 400
    // via errorResponse): these persist and feed every downstream sizing calc.
    assertPositive("power (kW)", power);
    assertPositive("voltage", voltage);
    assertOneOf("phase", phase, [1, 3]);
    const safePowerFactor = clampPowerFactor(powerFactor);
    const safeDemandFactor = Math.max(0, demandFactor ?? 1.0);

    // Recalculate running current
    let runningCurrent = 0;
    if (phase === 3) {
      runningCurrent = (power * quantity * safeDemandFactor) / (Math.sqrt(3) * (voltage / 1000) * safePowerFactor);
    } else {
      runningCurrent = (power * quantity * safeDemandFactor) / ((voltage / 1000) * safePowerFactor);
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
        powerFactor: safePowerFactor,
        demandFactor: safeDemandFactor,
        quantity,
        runningCurrent,
        startingCurrent,
        notes,
      },
    });

    return NextResponse.json(updatedLoadItem);
  } catch (error) {
    return errorResponse(error, "PUT Load Error");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const loadItem = await db.loadLibraryItem.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!loadItem) {
      return NextResponse.json({ error: "Load item not found" }, { status: 404 });
    }

    const auth = await verifyProjectAccess(loadItem.projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    await db.loadLibraryItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
