import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { seedDefaultProjectTemplates, seedDefaultLoadLibrary } from "@/lib/project-defaults";
import { logProjectActivity } from "@/lib/audit-logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
    if (auth instanceof NextResponse) return auth;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        apartmentTemplates: { include: { rooms: true } },
        loadLibraryItems: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let templatesAdded = 0;
    if (project.apartmentTemplates.length === 0) {
      const created = await seedDefaultProjectTemplates(project.id, project.country);
      templatesAdded = created.length;
    }

    let loadsAdded = 0;
    if (project.loadLibraryItems.length === 0) {
      await seedDefaultLoadLibrary(project.id);
      loadsAdded = 5;
    }

    await logProjectActivity({
      projectId: project.id,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project.id,
      description: `Generated default apartment templates (${templatesAdded}) and standard loads (${loadsAdded})`,
    });

    // Return the updated project with all relations
    const updated = await db.project.findUnique({
      where: { id: projectId },
      include: {
        buildings: {
          include: {
            floorDesigns: {
              include: {
                items: {
                  include: {
                    apartmentTemplate: { include: { rooms: true } },
                    loadLibraryItem: true,
                  },
                },
              },
            },
            buildingLoads: {
              include: { loadLibraryItem: true },
            },
          },
        },
        apartmentTemplates: {
          include: { rooms: true },
        },
        loadLibraryItems: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST seed-defaults error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
