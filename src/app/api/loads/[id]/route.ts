import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
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

    const changes: Array<{ field: string; label: string; oldValue?: any; newValue?: any }> = [];
    if (name !== loadItem.name) changes.push({ field: "name", label: "Name", oldValue: loadItem.name, newValue: name });
    if (category !== loadItem.category) changes.push({ field: "category", label: "Category", oldValue: loadItem.category, newValue: category });
    if (power !== loadItem.power) changes.push({ field: "power", label: "Power", oldValue: `${loadItem.power} kW`, newValue: `${power} kW` });
    if (voltage !== loadItem.voltage) changes.push({ field: "voltage", label: "Voltage", oldValue: `${loadItem.voltage} V`, newValue: `${voltage} V` });
    if (phase !== loadItem.phase) changes.push({ field: "phase", label: "Phase", oldValue: `${loadItem.phase}Φ`, newValue: `${phase}Φ` });
    if (safePowerFactor !== loadItem.powerFactor) changes.push({ field: "powerFactor", label: "Power Factor", oldValue: loadItem.powerFactor, newValue: safePowerFactor });
    if (safeDemandFactor !== loadItem.demandFactor) changes.push({ field: "demandFactor", label: "Demand Factor", oldValue: loadItem.demandFactor, newValue: safeDemandFactor });
    if (quantity !== loadItem.quantity) changes.push({ field: "quantity", label: "Quantity", oldValue: loadItem.quantity, newValue: quantity });

    const descParts = changes.map(c => `${c.label} (${c.oldValue} → ${c.newValue})`).join(", ");
    const description = changes.length === 1
      ? `Updated load "${loadItem.name}": ${descParts}`
      : changes.length > 1
      ? `Updated load "${loadItem.name}" (${changes.length} fields: ${descParts})`
      : `Updated load "${loadItem.name}"`;

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

    await logProjectActivity({
      projectId: loadItem.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "UPDATE",
      entityType: "LOAD",
      entityId: id,
      description,
      details: { changes, raw: data },
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

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

    await logProjectActivity({
      projectId: loadItem.projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "DELETE",
      entityType: "LOAD",
      entityId: id,
      description: `Deleted load "${loadItem.name}" (${loadItem.power} kW, ${loadItem.phase}Φ, ${loadItem.category})`,
      details: {
        name: loadItem.name,
        category: loadItem.category,
        power: loadItem.power,
        phase: loadItem.phase,
        voltage: loadItem.voltage,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
