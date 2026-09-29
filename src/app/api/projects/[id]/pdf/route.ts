import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { getLogoAsset } from "@/lib/app-settings";
import { wrapReportMarkup } from "@/lib/reports/render-report-html";
import { generateServerPdf } from "@/lib/reports/server-pdf";
import { generateReportPdfFromPrintRoute } from "@/lib/reports/print-report-pdf";
import { createPrintTicket } from "@/lib/reports/print-ticket";
import { loadReportData } from "@/lib/reports/load-report-data";
import { inlineImagesInHtml } from "@/lib/reports/inline-images";

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
    const auth = await verifyProjectAccess(id);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId") || undefined;
    const manufacturer = searchParams.get("manufacturer") || undefined;
    const data = await loadReportData(id);
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // The report schedules are client components, so they cannot be rendered to a
    // string on the server. Drive the print route in headless Chromium instead and
    // reuse the browser-POST export's wrapping so both paths produce the same PDF.
    const origin = new URL(request.url).origin;
    const ticket = createPrintTicket({
      projectId: id,
      userId: auth.user.id,
      ...(buildingId ? { buildingId } : {}),
      ...(manufacturer ? { manufacturer } : {}),
    });
    const printUrl = `${origin}/print/report?ticket=${encodeURIComponent(ticket)}`;

    const pdfBuffer = await generateReportPdfFromPrintRoute(
      printUrl,
      `${data.project.name} - Engineering Package`
    );

    const safeProjectName = data.project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
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
