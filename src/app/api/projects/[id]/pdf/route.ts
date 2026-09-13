import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { getCompanySettings } from "@/lib/app-settings";
import { renderReportHtml } from "@/lib/reports/render-report-html";
import { generateServerPdf } from "@/lib/reports/server-pdf";

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyProjectAccess(id);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId") || undefined;
    const manufacturer = searchParams.get("manufacturer") || undefined;

    const [project, company, rawRevisions, rawEquipment, breakerSettings] =
      await Promise.all([
        db.project.findUnique({
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
          },
        }),
        getCompanySettings().catch(() => null),
        db.projectRevision.findMany({
          where: { projectId: id },
          include: {
            createdBy: { select: { username: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.equipmentCatalog.findMany({
          include: { family: true },
          orderBy: [
            { manufacturer: "asc" },
            { category: "asc" },
            { ratedCurrent: "asc" },
          ],
        }),
        db.breakerSettings.findMany({
          orderBy: { model: "asc" },
        }),
      ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const revisions = rawRevisions.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      rev: r.rev,
      description: r.description,
      createdById: r.createdById,
      createdByUsername: r.createdBy?.username,
      createdAt: r.createdAt.toISOString(),
    }));

    const equipment = rawEquipment.map((e) => ({
      ...e,
      familyId: e.family?.id ?? null,
      familyName: e.family?.name ?? null,
    }));

    const html = renderReportHtml({
      project: project as any,
      buildingId,
      manufacturer,
      equipment: equipment as any,
      breakerSettings,
      revisions: revisions as any,
      companyName: company?.companyName || "ProCal — Low-voltage Electrical design, Solved",
      companyLogoUrl: company?.logoUrl || undefined,
    });

    const pdfBuffer = await generateServerPdf(html);

    const safeProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeProjectName}_Executive_Engineering_Package.pdf`;

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/pdf Error:", error);
    return NextResponse.json(
      { error: "Failed to generate server PDF package" },
      { status: 500 }
    );
  }
}
