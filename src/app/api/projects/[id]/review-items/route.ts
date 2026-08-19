import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const pageKey = searchParams.get("pageKey");

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (pageKey) where.pageKey = pageKey;

    const items = await db.projectReviewItem.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET Project Review Items Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { pageKey, severity, title, description } = body;

    const trimmedTitle = (title || "").trim();
    const trimmedDesc = (description || "").trim();

    if (!trimmedTitle) {
      return NextResponse.json({ error: "Review item title is required" }, { status: 400 });
    }

    const validSeverity =
      severity === "CRITICAL" || severity === "NOTE" ? severity : "WARNING";

    const item = await db.projectReviewItem.create({
      data: {
        projectId,
        createdById: auth.user.id,
        pageKey: pageKey || "general",
        severity: validSeverity,
        title: trimmedTitle,
        description: trimmedDesc,
        status: "OPEN",
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "CREATE",
      entityType: "QA_NOTE",
      entityId: item.id,
      description: `Logged QA note on ${pageKey || "general"}: "${trimmedTitle}"`,
      details: {
        severity: validSeverity,
        title: trimmedTitle,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST Project Review Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
