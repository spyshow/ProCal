import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseMemberPermissions } from "@/lib/project-permissions";
import { logProjectActivity } from "@/lib/audit-logger";
import { seedDefaultProjectTemplates, seedDefaultLoadLibrary } from "@/lib/project-defaults";
import { validateProjectSettings } from "@/lib/calculations/validate";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: {
        OR: [
          { userId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: {
        id: true,
        name: true,
        client: true,
        consultant: true,
        contractor: true,
        location: true,
        engineer: true,
        country: true,
        voltage: true,
        frequency: true,
        powerFactor: true,
        calculationStandard: true,
        preferredManufacturer: true,
        updatedAt: true,
        userId: true,
        buildings: {
          select: { id: true, name: true, floors: true },
        },
        members: {
          where: { userId: user.id },
          select: { role: true, permissions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const enriched = projects.map((p) => {
      const isOwner = p.userId === user.id;
      const memberEntry = p.members?.[0];
      const role = isOwner ? "PROJECT_MANAGER" : memberEntry?.role || (user.role === "ADMIN" ? "PROJECT_MANAGER" : "ENGINEER");
      const perms = parseMemberPermissions(memberEntry?.permissions, role);

      return {
        ...p,
        currentMemberRole: role,
        currentMemberPermissions: perms,
        isOwner,
      };
    });

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    console.error("GET Projects Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: `Failed to load projects: ${message}` }, { status: 500 });
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
      maxVoltageDropLighting,
      maxVoltageDropPower,
      calculationStandard,
    } = data;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const vNum = voltage !== undefined && voltage !== "" ? parseFloat(voltage) : 400;
    const fNum = frequency !== undefined && frequency !== "" ? parseFloat(frequency) : 50;
    const pfNum = powerFactor !== undefined && powerFactor !== "" ? parseFloat(powerFactor) : 0.85;
    const dfNum = maxDemandFactor !== undefined && maxDemandFactor !== "" ? parseFloat(maxDemandFactor) : 0.8;
    const vdLNum = maxVoltageDropLighting !== undefined && maxVoltageDropLighting !== "" ? parseFloat(maxVoltageDropLighting) : 3;
    const vdPNum = maxVoltageDropPower !== undefined && maxVoltageDropPower !== "" ? parseFloat(maxVoltageDropPower) : 5;

    try {
      validateProjectSettings({
        voltage: vNum,
        frequency: fNum,
        powerFactor: pfNum,
        maxDemandFactor: dfNum,
        maxVoltageDropLighting: vdLNum,
        maxVoltageDropPower: vdPNum,
      });
    } catch (validationErr: any) {
      return NextResponse.json({ error: validationErr.message }, { status: 400 });
    }

    // Admins bypass the credit gate (they manage the system).
    if (user.role !== "ADMIN") {
      const fresh = await db.user.findUnique({ where: { id: user.id }, select: { credits: true } });
      if (!fresh || fresh.credits < 1) {
        return NextResponse.json({ error: "No credits remaining" }, { status: 402 });
      }
    }

    const projectData = {
      name,
      client: client || "",
      consultant: consultant || "",
      contractor: contractor || "",
      location: location || "",
      engineer: engineer || user.name,
      date: date || new Date().toISOString().split("T")[0],
      voltage: vNum,
      frequency: fNum,
      powerFactor: pfNum,
      maxDemandFactor: dfNum,
      notes: notes || "",
      preferredManufacturer: preferredManufacturer || "MIXED",
      maxVoltageDropLighting: vdLNum,
      maxVoltageDropPower: vdPNum,
      calculationStandard:
        calculationStandard === "NEMA" || calculationStandard === "IEC"
          ? calculationStandard
          : "IEC",
      userId: user.id,
    };

    let project;
    if (user.role === "ADMIN") {
      project = await db.project.create({ data: projectData });
    } else {
      [, project] = await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { credits: { decrement: 1 } } }),
        db.project.create({ data: projectData }),
      ]);
    }

    // Automatically create ProjectMember record for creator as PROJECT_MANAGER
    await db.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: "PROJECT_MANAGER",
      },
    });

    // Auto-seed standard apartment templates and equipment loads
    try {
      await seedDefaultProjectTemplates(project.id, project.country);
      await seedDefaultLoadLibrary(project.id);
    } catch (seedErr) {
      console.warn("Failed to auto-seed project defaults:", seedErr);
    }

    await logProjectActivity({
      projectId: project.id,
      userId: user.id,
      userName: user.name || user.username,
      userRole: "PROJECT_MANAGER",
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project.id,
      description: `Created project "${project.name}"`,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("POST Project Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

