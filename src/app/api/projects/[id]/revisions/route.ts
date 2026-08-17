import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PROJECT_SNAPSHOT_INCLUDE, REVISION_INCLUDE } from "@/lib/revisions";
import type { ProjectRevision } from "@/types";

function toRevisionDto(
  r: {
    id: string;
    projectId: string;
    rev: string;
    description: string;
    createdById: string;
    snapshotJson: string;
    createdAt: Date;
    createdBy: { username: string };
  }
): ProjectRevision {
  return {
    id: r.id,
    projectId: r.projectId,
    rev: r.rev,
    description: r.description,
    createdById: r.createdById,
    createdByUsername: r.createdBy.username,
    snapshotJson: r.snapshotJson,
    createdAt: r.createdAt.toISOString(),
  };
}

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
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const revisions = await db.projectRevision.findMany({
      where: { projectId: id },
      include: REVISION_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(revisions.map(toRevisionDto));
  } catch (error) {
    console.error("GET Project Revisions Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const description = String(body.description ?? "").trim();

    if (!description) {
      return NextResponse.json(
        { error: "Revision description is required" },
        { status: 400 }
      );
    }

    // Load the full serializable project state (same include as GET
    // /api/projects/[id]) so the snapshot reproduces the issued report.
    const project = await db.project.findUnique({
      where: { id, userId: user.id },
      include: PROJECT_SNAPSHOT_INCLUDE,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existingCount = await db.projectRevision.count({
      where: { projectId: id },
    });

    const revision = await db.projectRevision.create({
      data: {
        projectId: id,
        rev: `R${existingCount}`,
        description,
        createdById: user.id,
        snapshotJson: JSON.stringify(project),
      },
      include: REVISION_INCLUDE,
    });

    return NextResponse.json(toRevisionDto(revision), { status: 201 });
  } catch (error) {
    console.error("POST Project Revision Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
