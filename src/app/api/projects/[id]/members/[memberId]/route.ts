import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { parseMemberPermissions, type ProjectRole } from "@/lib/project-permissions";
import { logProjectActivity } from "@/lib/audit-logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: projectId, memberId } = await params;
    const auth = await verifyProjectAccess(projectId, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    const targetMember = await db.projectMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true, username: true } } },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      return NextResponse.json({ error: "Project member not found" }, { status: 404 });
    }

    const body = await request.json();
    const { role, permissions } = body;

    const nextRole: ProjectRole =
      role === "PROJECT_MANAGER" || role === "QA" ? role : "ENGINEER";

    // Guard: Prevent demoting the project creator away from PROJECT_MANAGER
    if (targetMember.userId === auth.project.userId && nextRole !== "PROJECT_MANAGER") {
      return NextResponse.json(
        { error: "The primary project creator must remain a Project Manager" },
        { status: 400 }
      );
    }

    // Guard: Ensure there is at least one Project Manager remaining
    if (targetMember.role === "PROJECT_MANAGER" && nextRole !== "PROJECT_MANAGER") {
      const pmCount = await db.projectMember.count({
        where: { projectId, role: "PROJECT_MANAGER" },
      });
      if (pmCount <= 1) {
        return NextResponse.json(
          { error: "A project must have at least one Project Manager" },
          { status: 400 }
        );
      }
    }

    const updatedPermissions = permissions ? JSON.stringify(permissions) : null;

    const updated = await db.projectMember.update({
      where: { id: memberId },
      data: {
        role: nextRole,
        permissions: updatedPermissions,
      },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });

    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "MEMBER_ROLE",
      entityType: "TEAM",
      entityId: memberId,
      description: `Updated permissions for ${updated.user.name || updated.user.username} (Role: ${nextRole})`,
      details: {
        memberId,
        previousRole: targetMember.role,
        newRole: nextRole,
        permissions: parseMemberPermissions(updatedPermissions, nextRole),
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        userId: updated.userId,
        name: updated.user.name,
        email: updated.user.email,
        username: updated.user.username,
        role: updated.role,
        permissions: parseMemberPermissions(updated.permissions, updated.role),
      },
    });
  } catch (error) {
    console.error("PATCH Project Member Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: projectId, memberId } = await params;
    const auth = await verifyProjectAccess(projectId, { requiredRole: "PROJECT_MANAGER" });
    if (auth instanceof NextResponse) return auth;

    const targetMember = await db.projectMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true, username: true } } },
    });

    if (!targetMember || targetMember.projectId !== projectId) {
      return NextResponse.json({ error: "Project member not found" }, { status: 404 });
    }

    // Guard: Cannot remove the project creator
    if (targetMember.userId === auth.project.userId) {
      return NextResponse.json(
        { error: "The project creator cannot be removed from the project" },
        { status: 400 }
      );
    }

    await db.projectMember.delete({
      where: { id: memberId },
    });

    await logProjectActivity({
      projectId,
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
      userRole: auth.member.role,
      action: "MEMBER_REMOVE",
      entityType: "TEAM",
      entityId: memberId,
      description: `Removed ${targetMember.user.name || targetMember.user.username} from the project`,
      details: {
        removedUserId: targetMember.userId,
        removedUserName: targetMember.user.name || targetMember.user.username,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Project Member Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
