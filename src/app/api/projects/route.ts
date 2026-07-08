import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: { userId: user.id },
      include: {
        buildings: true,
        apartmentTemplates: true,
        loadLibraryItems: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET Projects Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const {
      name,
      client,
      consultant,
      contractor,
      location,
      engineer,
      date,
      voltage,
      frequency,
      powerFactor,
      maxDemandFactor,
      notes,
      preferredManufacturer,
    } = data;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name,
        client: client || "",
        consultant: consultant || "",
        contractor: contractor || "",
        location: location || "",
        engineer: engineer || user.name,
        date: date || new Date().toISOString().split("T")[0],
        voltage: parseFloat(voltage) || 400,
        frequency: parseFloat(frequency) || 50,
        powerFactor: parseFloat(powerFactor) || 0.85,
        maxDemandFactor: parseFloat(maxDemandFactor) || 0.8,
        notes: notes || "",
        preferredManufacturer: preferredManufacturer || "MIXED",
        userId: user.id,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("POST Project Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
