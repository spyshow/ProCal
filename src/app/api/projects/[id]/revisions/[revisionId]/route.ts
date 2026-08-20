import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * DELETE /api/projects/[id]/revisions/[revisionId] — remove a revision.
 *
 * Owner-only (same opaque-404 posture as restore): the project must be owned
 * by the session user, and the revision must belong to that project. Deleting
 * the latest revision after a restore is the typical escape hatch — a restore
 * first snapshots the pre-restore state as a new auto-revision, and if the
 * restore is unwanted that snapshot is the one to remove.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, revisionId } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const revision = await db.projectRevision.findUnique({
      where: { id: revisionId },
      select: { id: true, projectId: true },
    });
    if (!revision || revision.projectId !== id) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    await db.projectRevision.delete({ where: { id: revisionId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE Project Revision Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}