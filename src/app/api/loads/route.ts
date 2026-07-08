import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const project = await db.project.findUnique({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const kw = parseFloat(power);
    const qty = parseInt(quantity) || 1;
    const pf = parseFloat(powerFactor) || 0.85;
    const df = parseFloat(demandFactor) || 1.0;
    const ph = parseInt(phase) || 1;
    const volt = parseFloat(voltage) || (ph === 3 ? 400 : 230);

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

    return NextResponse.json(loadItem);
  } catch (error) {
    console.error("POST Load Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
