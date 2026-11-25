import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { verifyReportDownloadToken } from "@/lib/auth";
import { wrapReportMarkup } from "@/lib/reports/render-report-html";
import { generateServerPdf } from "@/lib/reports/server-pdf";
import { sanitizeClientReportHtml } from "@/lib/reports/sanitize-report-html";
import {
  inlineImagesInHtml,
  loadProjectReportHtml,
} from "@/lib/reports/load-project-report";

export const maxDuration = 60;

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
      select: { name: true, isTrial: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    let fullHtml: string;

    if (Boolean(project.isTrial)) {
      // Trial PDFs always use server-authoritative HTML so client CSS cannot suppress watermarks
      const rendered = await loadProjectReportHtml(id, {
        buildingId: typeof body.buildingId === "string" ? body.buildingId : undefined,
        manufacturer: typeof body.manufacturer === "string" ? body.manufacturer : undefined,
      });
      if (!rendered) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      fullHtml = rendered.html;
    } else {
      const htmlContent = body.html;
      if (!htmlContent || typeof htmlContent !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid 'html' in request body" },
          { status: 400 }
        );
      }

      const sanitizedHtml = sanitizeClientReportHtml(htmlContent);
      const inlinedHtml = await inlineImagesInHtml(sanitizedHtml);
      fullHtml = wrapReportMarkup(inlinedHtml, `${project.name} - Executive Engineering Package`, false);
    }

    const pdfBuffer = await generateServerPdf(fullHtml, { isTrial: Boolean(project.isTrial) });

    const safeProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeProjectName}_Executive_Engineering_Package.pdf`;

    return new Response(pdfBuffer as unknown as BodyInit, {
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
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (token) {
      const verified = await verifyReportDownloadToken(token, id);
      if (!verified) {
        return NextResponse.json(
          { error: "Invalid or expired report download token" },
          { status: 401 }
        );
      }
    } else {
      const auth = await verifyProjectAccess(id);
      if (auth instanceof NextResponse) return auth;
    }
    const buildingId = searchParams.get("buildingId") || undefined;
    const manufacturer = searchParams.get("manufacturer") || undefined;

    const rendered = await loadProjectReportHtml(id, { buildingId, manufacturer });
    if (!rendered) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const pdfBuffer = await generateServerPdf(rendered.html, { isTrial: rendered.isTrial });

    const safeProjectName = rendered.projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeProjectName}_Executive_Engineering_Package.pdf`;

    return new Response(pdfBuffer as unknown as BodyInit, {
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
