import { db } from "./db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "INVITE"
  | "REVISION"
  | "MEMBER_REMOVE"
  | "MEMBER_ROLE"
  | "RESTORE";

export type AuditEntityType =
  | "PROJECT"
  | "CABLE"
  | "BREAKER"
  | "BUILDING_LOAD"
  | "BUILDING"
  | "FLOOR"
  | "PANEL"
  | "TEAM"
  | "SLD"
  | "QA_NOTE";

export interface LogAuditParams {
  projectId: string;
  userId?: string | null;
  userName: string;
  userRole?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  description: string;
  details?: Record<string, unknown> | null;
}

/**
 * Logs a project activity / audit event asynchronously.
 * Swallows unexpected errors so audit logging failure doesn't block primary user actions.
 */
export async function logProjectActivity(params: LogAuditParams): Promise<void> {
  try {
    await db.projectAuditLog.create({
      data: {
        projectId: params.projectId,
        userId: params.userId || null,
        userName: params.userName || "System",
        userRole: params.userRole || "ENGINEER",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        description: params.description,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error("Failed to write project audit log:", error);
  }
}
