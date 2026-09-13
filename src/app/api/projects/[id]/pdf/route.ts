import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { getCompanySettings, getLogoAsset } from "@/lib/app-settings";
import { renderReportHtml, wrapReportMarkup } from "@/lib/reports/render-report-html";
import { generateServerPdf } from "@/lib/reports/server-pdf";

export const maxDuration = 60;

/**
 * Inlines relative image URLs (such as /api/assets/logo:... and /uploads/...)
 * as self-contained Base64 data URIs so that Headless Chromium running on about:blank
 * can render the logo and images without needing a network roundtrip or session cookies.
 */
async function inlineImagesInHtml(html: string): Promise<string> {
  let result = html;

  // 1. Scan for all img src attributes
  const srcMatches = Array.from(html.matchAll(/src=["']([^"']+)["']/g));
  for (const match of srcMatches) {
    const src = match[1];
    if (src.startsWith("data:")) continue;

    try {
      if (src.includes("/api/assets/")) {
        const rawKey = src.split("/api/assets/")[1]?.split("?")[0]?.split("#")[0] || "";
        const decodedKey = decodeURIComponent(rawKey);
        const asset = await getLogoAsset(decodedKey);
        if (asset?.mime && asset?.data) {
          const dataUri = `data:${asset.mime};base64,${asset.data}`;
          result = result.replaceAll(src, dataUri);
          continue;
        }
      }

      if (src.startsWith("/uploads/") || src.includes("/uploads/")) {
        const cleanPath = src.split("?")[0]?.split("#")[0] || "";
        const relativeUpload = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
        const filePath = path.join(process.cwd(), "public", relativeUpload);
        if (fs.existsSync(filePath)) {
          const bytes = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
          result = result.replaceAll(src, `data:${mime};base64,${bytes.toString("base64")}`);
          continue;
        }
      }
    } catch (err) {
      console.warn("inlineImagesInHtml failed for src:", src, err);
    }
  }

  // 2. Cross-reference company logo URL in database settings
  try {
    const company = await getCompanySettings();
    if (company.logoUrl && company.logoUrl.includes("/api/assets/")) {
      const rawKey = company.logoUrl.split("/api/assets/")[1]?.split("?")[0]?.split("#")[0] || "";
      const decodedKey = decodeURIComponent(rawKey);
      const asset = await getLogoAsset(decodedKey);
      if (asset?.mime && asset?.data) {
        const dataUri = `data:${asset.mime};base64,${asset.data}`;
        result = result.replaceAll(company.logoUrl, dataUri);
        result = result.replaceAll(decodeURIComponent(company.logoUrl), dataUri);
        result = result.replaceAll(encodeURI(company.logoUrl), dataUri);
      }
    }
  } catch (err) {
    console.warn("inlineImagesInHtml company logo check error:", err);
  }

  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyProjectAccess(id);
    if (auth instanceof NextResponse) return auth;

    const project = await db.project.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const htmlContent = body.html;

    if (!htmlContent || typeof htmlContent !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'html' in request body" },
        { status: 400 }
      );
    }

    const inlinedHtml = await inlineImagesInHtml(htmlContent);
    const fullHtml = wrapReportMarkup(inlinedHtml, `${project.name} - Executive Engineering Package`);
    const pdfBuffer = await generateServerPdf(fullHtml);

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
    console.error("POST /api/projects/[id]/pdf Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate server PDF package", details: message },
      { status: 500 }
    );
  }
}

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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to generate server PDF package", details: message },
      { status: 500 }
    );
  }
}
