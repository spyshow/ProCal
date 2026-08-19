import { NextResponse } from "next/server";
import { db } from "./db";
import { getSessionUser } from "./auth";
import {
  hasProjectPagePermission,
  parseMemberPermissions,
  type ProjectPageKey,
  type PermissionAction,
} from "./project-permissions";

export interface ProjectAuthSuccess {
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    credits: number;
    email: string | null;
  };
  member: {
    id: string;
    projectId: string;
    userId: string;
    role: string;
    permissions: Record<ProjectPageKey, PermissionAction>;
  };
  project: {
    id: string;
    name: string;
    userId: string;
    [key: string]: any;
  };
}

export type VerifyProjectAccessResult = ProjectAuthSuccess | NextResponse;

/**
 * Server-side guard to verify project access, membership, and granular permissions.
 */
export async function verifyProjectAccess(
  projectId: string,
  options?: {
    requiredRole?: "PROJECT_MANAGER" | "ENGINEER" | "QA";
    pageKey?: ProjectPageKey | string;
    requiredAction?: "VIEW" | "EDIT";
  }
): Promise<VerifyProjectAccessResult> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // System Administrator bypass: full access as Project Manager
  if (user.role === "ADMIN") {
    return {
      user,
      member: {
        id: `admin-${user.id}`,
        projectId: project.id,
        userId: user.id,
        role: "PROJECT_MANAGER",
        permissions: parseMemberPermissions(null, "PROJECT_MANAGER"),
      },
      project,
    };
  }

  // Find membership record
  let memberRecord = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
  });

  // Auto-backfill: If user is the project owner (project.userId === user.id) but no membership record exists yet
  if (!memberRecord && project.userId === user.id) {
    try {
      memberRecord = await db.projectMember.create({
        data: {
          projectId,
          userId: user.id,
          role: "PROJECT_MANAGER",
        },
      });
    } catch {
      // If concurrent create raced, re-fetch
      memberRecord = await db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: user.id,
          },
        },
      });
    }
  }

  if (!memberRecord) {
    return NextResponse.json({ error: "Forbidden: You are not a member of this project" }, { status: 403 });
  }

  const parsedPerms = parseMemberPermissions(memberRecord.permissions, memberRecord.role);

  // Role requirement check
  if (options?.requiredRole) {
    if (options.requiredRole === "PROJECT_MANAGER" && memberRecord.role !== "PROJECT_MANAGER") {
      return NextResponse.json(
        { error: "Forbidden: Project Manager role required for this action" },
        { status: 403 }
      );
    }
  }

  // Page-level permission check
  if (options?.pageKey) {
    const action = options.requiredAction || "VIEW";
    const allowed = hasProjectPagePermission(memberRecord.role, parsedPerms, options.pageKey, action);
    if (!allowed) {
      return NextResponse.json(
        { error: `Forbidden: You do not have permission to ${action.toLowerCase()} this module` },
        { status: 403 }
      );
    }
  }

  return {
    user,
    member: {
      id: memberRecord.id,
      projectId: memberRecord.projectId,
      userId: memberRecord.userId,
      role: memberRecord.role,
      permissions: parsedPerms,
    },
    project,
  };
}
