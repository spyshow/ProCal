import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyProjectAccess(id);
    if (auth instanceof NextResponse) return auth;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            floorDesigns: {
              include: {
                items: {
                  include: {
                    apartmentTemplate: {
                      include: { rooms: true },
                    },
                    loadLibraryItem: true,
                  },
                },
              },
            },
            buildingLoads: {
              include: {
                loadLibraryItem: true,
              },
            },
          },
        },
        apartmentTemplates: {
          include: { rooms: true },
        },
        loadLibraryItems: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, username: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...project,
      currentMemberRole: auth.member.role,
      currentMemberPermissions: auth.member.permissions,
      isOwner: auth.project.userId === auth.user.id,
    });
  } catch (error) {
    console.error("GET Project Details Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyProjectAccess(id);
    if (auth instanceof NextResponse) return auth;

    // Only PM or Engineers with permission can edit project settings
    if (auth.member.role === "QA") {
      return NextResponse.json({ error: "Forbidden: QA role is view-only" }, { status: 403 });
    }

    const data = (await request.json()) as Record<string, any>;
    const existingProject = auth.project;

    const updatedProject = await db.project.update({
      where: { id },
      data: {
        name: data.name ?? existingProject.name,
        client: data.client ?? existingProject.client,
        consultant: data.consultant ?? existingProject.consultant,
        contractor: data.contractor ?? existingProject.contractor,
        location: data.location ?? existingProject.location,
        engineer: data.engineer ?? existingProject.engineer,
        date: data.date ?? existingProject.date,
        voltage: data.voltage !== undefined ? parseFloat(String(data.voltage)) : existingProject.voltage,
        frequency: data.frequency !== undefined ? parseFloat(String(data.frequency)) : existingProject.frequency,
        powerFactor: data.powerFactor !== undefined ? parseFloat(String(data.powerFactor)) : existingProject.powerFactor,
        maxDemandFactor: data.maxDemandFactor !== undefined ? parseFloat(String(data.maxDemandFactor)) : existingProject.maxDemandFactor,
        preferredManufacturer: data.preferredManufacturer ?? existingProject.preferredManufacturer,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : existingProject.logoUrl,
        notes: data.notes ?? existingProject.notes,
        maxVoltageDropLighting: data.maxVoltageDropLighting !== undefined ? parseFloat(String(data.maxVoltageDropLighting)) : existingProject.maxVoltageDropLighting,
        maxVoltageDropPower: data.maxVoltageDropPower !== undefined ? parseFloat(String(data.maxVoltageDropPower)) : existingProject.maxVoltageDropPower,
        calculationStandard:
          data.calculationStandard === "NEMA" || data.calculationStandard === "IEC"
            ? data.calculationStandard
            : (existingProject.calculationStandard as string) ?? "IEC",
        transformerSize: data.transformerSize !== undefined ? (data.transformerSize === null ? null : parseFloat(String(data.transformerSize))) : existingProject.transformerSize,
        defaultAcbFamilyId: data.defaultAcbFamilyId !== undefined ? data.defaultAcbFamilyId : existingProject.defaultAcbFamilyId,
        defaultMccbFamilyId: data.defaultMccbFamilyId !== undefined ? data.defaultMccbFamilyId : existingProject.defaultMccbFamilyId,
        defaultMcbFamilyId: data.defaultMcbFamilyId !== undefined ? data.defaultMcbFamilyId : existingProject.defaultMcbFamilyId,
      },
    });

    await logProjectActivity({
      projectId: id,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: id,
      description: `Updated project parameters${data.preferredManufacturer ? ` (Manufacturer: ${data.preferredManufacturer})` : ""}`,
      details: data,
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("PUT Project Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyProjectAccess(id, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    // Only owner or system ADMIN can delete project
    if (auth.project.userId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the primary project creator can delete the project" },
        { status: 403 }
      );
    }

    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Project Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

