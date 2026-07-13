import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: user.id },
      include: {
        buildings: {
          include: {
            floorDesigns: {
              include: {
                items: {
                  include: {
                    apartmentTemplate: true,
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
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const existingProject = await db.project.findUnique({
      where: { id, userId: user.id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
        voltage: data.voltage ? parseFloat(data.voltage) : existingProject.voltage,
        frequency: data.frequency ? parseFloat(data.frequency) : existingProject.frequency,
        powerFactor: data.powerFactor ? parseFloat(data.powerFactor) : existingProject.powerFactor,
        maxDemandFactor: data.maxDemandFactor ? parseFloat(data.maxDemandFactor) : existingProject.maxDemandFactor,
        preferredManufacturer: data.preferredManufacturer ?? existingProject.preferredManufacturer,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : existingProject.logoUrl,
        notes: data.notes ?? existingProject.notes,
        maxVoltageDropLighting: data.maxVoltageDropLighting ? parseFloat(data.maxVoltageDropLighting) : existingProject.maxVoltageDropLighting,
        maxVoltageDropPower: data.maxVoltageDropPower ? parseFloat(data.maxVoltageDropPower) : existingProject.maxVoltageDropPower,
        transformerSize: data.transformerSize ? parseFloat(data.transformerSize) : existingProject.transformerSize,
        defaultAcbFamilyId: data.defaultAcbFamilyId !== undefined ? data.defaultAcbFamilyId : existingProject.defaultAcbFamilyId,
        defaultMccbFamilyId: data.defaultMccbFamilyId !== undefined ? data.defaultMccbFamilyId : existingProject.defaultMccbFamilyId,
        defaultMcbFamilyId: data.defaultMcbFamilyId !== undefined ? data.defaultMcbFamilyId : existingProject.defaultMcbFamilyId,
      },
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
