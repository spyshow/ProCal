import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const existing = await db.projectReviewItem.findUnique({
      where: { id: itemId },
    });

    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, title, description, severity } = body;

    const data: Record<string, unknown> = {};

    if (status !== undefined) {
      if (status === "RESOLVED" || status === "WONT_FIX" || status === "OPEN") {
        data.status = status;
        data.resolvedAt = status === "RESOLVED" || status === "WONT_FIX" ? new Date() : null;
      }
    }

    if (title !== undefined && title.trim()) data.title = title.trim();
    if (description !== undefined) data.description = description.trim();
    if (severity !== undefined) {
      if (severity === "CRITICAL" || severity === "WARNING" || severity === "NOTE") {
        data.severity = severity;
      }
    }

    const updated = await db.projectReviewItem.update({
      where: { id: itemId },
      data,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (status !== undefined && status !== existing.status) {
      await logProjectActivity({
        projectId,
        userId: auth.user.id,
        userName: auth.user.name || auth.user.username,
        userRole: auth.member.role,
        action: "UPDATE",
        entityType: "QA_NOTE",
        entityId: itemId,
        description: `Marked QA note "${updated.title}" as ${status}`,
        details: { previousStatus: existing.status, newStatus: status },
      });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("PATCH Review Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const existing = await db.projectReviewItem.findUnique({
      where: { id: itemId },
    });

    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    // Only author or PM can delete
    if (existing.createdById !== auth.user.id && auth.member.role !== "PROJECT_MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: Only the author or a Project Manager can delete this review note" },
        { status: 403 }
      );
    }

    await db.projectReviewItem.delete({
      where: { id: itemId },
    });

    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "DELETE",
      entityType: "QA_NOTE",
      entityId: itemId,
      description: `Deleted QA review note: "${existing.title}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Review Item Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
