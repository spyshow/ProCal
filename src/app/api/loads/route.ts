import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";
import {
  assertOneOf,
  assertPositive,
  clampPowerFactor,
} from "@/lib/calculations/validate";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      projectId,
      name,
      category,
      power, // in kW
      voltage, // 230 or 400
      phase, // 1 or 3
      powerFactor,
      demandFactor,
      quantity,
      startingCurrent,
      notes,
    } = data;

    if (!projectId || !name || !category || power === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    // Trust-boundary validation: these values persist and feed every downstream
    // sizing calc, so reject garbage here instead of storing NaN/negative data.
    // CalculationError → 400 via errorResponse.
    const kw = parseFloat(power);
    assertPositive("power (kW)", kw);
    const ph = parseInt(phase) || 1;
    assertOneOf("phase", ph, [1, 3]);
    const pf = clampPowerFactor(parseFloat(powerFactor));
    const df = Math.max(0, parseFloat(demandFactor) || 1.0);
    const qty = Math.max(1, parseInt(quantity) || 1);
    const volt = parseFloat(voltage) || (ph === 3 ? 400 : 230);
    assertPositive("voltage", volt);

    // Calculate running current
    // I = (kW * qty * df) / (V_phase * pf)
    let runningCurrent = 0;
    if (ph === 3) {
      runningCurrent = (kw * qty * df) / (Math.sqrt(3) * (volt / 1000) * pf);
    } else {
      runningCurrent = (kw * qty * df) / ((volt / 1000) * pf);
    }
    runningCurrent = parseFloat(runningCurrent.toFixed(2));

    const loadItem = await db.loadLibraryItem.create({
      data: {
        name,
        category,
        power: kw,
        voltage: volt,
        phase: ph,
        powerFactor: pf,
        demandFactor: df,
        quantity: qty,
        runningCurrent,
        startingCurrent: startingCurrent ? parseFloat(startingCurrent) : null,
        notes: notes || "",
        projectId,
      },
    });

    const userName = auth.user?.name || auth.user?.username || "Engineer";
    const userRole = auth.member?.role || auth.user?.role || "ENGINEER";

    await logProjectActivity({
      projectId,
      userId: auth.user?.id || null,
      userName,
      userRole,
      action: "CREATE",
      entityType: "LOAD",
      entityId: loadItem.id,
      description: `Added load "${loadItem.name}" (${loadItem.power} kW, ${loadItem.phase}Φ, ${loadItem.category})`,
      details: {
        loadId: loadItem.id,
        name: loadItem.name,
        category: loadItem.category,
        power: loadItem.power,
        voltage: loadItem.voltage,
        phase: loadItem.phase,
        powerFactor: loadItem.powerFactor,
        demandFactor: loadItem.demandFactor,
        quantity: loadItem.quantity,
        runningCurrent: loadItem.runningCurrent,
        changes: [
          { field: "name", label: "Load Name", newValue: loadItem.name },
          { field: "category", label: "Category", newValue: loadItem.category },
          { field: "power", label: "Power", newValue: `${loadItem.power} kW` },
          { field: "phase", label: "Phase", newValue: `${loadItem.phase}Φ` },
          { field: "voltage", label: "Voltage", newValue: `${loadItem.voltage} V` },
          { field: "runningCurrent", label: "Running Current", newValue: `${loadItem.runningCurrent} A` },
          { field: "quantity", label: "Quantity", newValue: loadItem.quantity },
        ],
      },
    });

    return NextResponse.json(loadItem);
  } catch (error) {
    return errorResponse(error, "POST Load Error");
  }
}
