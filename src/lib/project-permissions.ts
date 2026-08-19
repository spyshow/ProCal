/**
 * Project Roles and Granular Permission System
 *
 * Supports 3 project-level roles:
 * - PROJECT_MANAGER: Full administrative control, team management, permissions, and engineering edits.
 * - ENGINEER: Granular per-page access (VIEW, EDIT, or NONE).
 * - QA: Read-only access across engineering modules + QA review/punch list capabilities.
 */

export const MAX_PROJECT_MEMBERS = 5;

export type ProjectRole = "PROJECT_MANAGER" | "ENGINEER" | "QA";

export type PermissionAction = "VIEW" | "EDIT" | "NONE";

export const PROJECT_PAGE_KEYS = [
  "calculator",
  "breakerSchedule",
  "coordination",
  "cableSchedule",
  "panelDesigner",
  "riserDiagram",
  "sldDesigner",
  "reports",
] as const;

export type ProjectPageKey = (typeof PROJECT_PAGE_KEYS)[number];

export const PAGE_LABELS: Record<ProjectPageKey, { labelKey: string; defaultLabel: string }> = {
  calculator: { labelKey: "nav.calculator", defaultLabel: "Load Calculator" },
  breakerSchedule: { labelKey: "nav.breakerSchedule", defaultLabel: "Breaker Schedule" },
  coordination: { labelKey: "nav.coordination", defaultLabel: "Coordination & Selectivity" },
  cableSchedule: { labelKey: "nav.cableSchedule", defaultLabel: "Cable Sizing & Schedule" },
  panelDesigner: { labelKey: "nav.panelDesigner", defaultLabel: "Panel Designer" },
  riserDiagram: { labelKey: "nav.riserDiagram", defaultLabel: "Riser Diagram" },
  sldDesigner: { labelKey: "nav.sldDesigner", defaultLabel: "Single Line Diagram (SLD)" },
  reports: { labelKey: "nav.reports", defaultLabel: "Reports & Revisions" },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<ProjectRole, Record<ProjectPageKey, PermissionAction>> = {
  PROJECT_MANAGER: {
    calculator: "EDIT",
    breakerSchedule: "EDIT",
    coordination: "EDIT",
    cableSchedule: "EDIT",
    panelDesigner: "EDIT",
    riserDiagram: "EDIT",
    sldDesigner: "EDIT",
    reports: "EDIT",
  },
  ENGINEER: {
    calculator: "EDIT",
    breakerSchedule: "EDIT",
    coordination: "EDIT",
    cableSchedule: "EDIT",
    panelDesigner: "EDIT",
    riserDiagram: "EDIT",
    sldDesigner: "EDIT",
    reports: "EDIT",
  },
  QA: {
    calculator: "VIEW",
    breakerSchedule: "VIEW",
    coordination: "VIEW",
    cableSchedule: "VIEW",
    panelDesigner: "VIEW",
    riserDiagram: "VIEW",
    sldDesigner: "VIEW",
    reports: "VIEW",
  },
};

/**
 * Parses stored permissions string or returns default permissions for the role.
 */
export function parseMemberPermissions(
  permissions: string | Record<string, PermissionAction> | null | undefined,
  role: string
): Record<ProjectPageKey, PermissionAction> {
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role as ProjectRole] || DEFAULT_ROLE_PERMISSIONS.ENGINEER;

  if (role === "PROJECT_MANAGER") {
    return { ...DEFAULT_ROLE_PERMISSIONS.PROJECT_MANAGER };
  }

  if (role === "QA") {
    return { ...DEFAULT_ROLE_PERMISSIONS.QA };
  }

  if (!permissions) {
    return { ...defaultPerms };
  }

  let parsed: Record<string, string> = {};
  if (typeof permissions === "string") {
    try {
      parsed = JSON.parse(permissions);
    } catch {
      return { ...defaultPerms };
    }
  } else if (typeof permissions === "object") {
    parsed = permissions as Record<string, string>;
  }

  const result: Record<ProjectPageKey, PermissionAction> = { ...defaultPerms };
  for (const key of PROJECT_PAGE_KEYS) {
    if (parsed[key] === "EDIT" || parsed[key] === "VIEW" || parsed[key] === "NONE") {
      result[key] = parsed[key] as PermissionAction;
    }
  }

  return result;
}

/**
 * Checks if a member has permission to perform an action on a specific page.
 */
export function hasProjectPagePermission(
  memberRole: string,
  permissions: string | Record<string, PermissionAction> | null | undefined,
  pageKey: string,
  requiredAction: "VIEW" | "EDIT" = "VIEW"
): boolean {
  if (memberRole === "PROJECT_MANAGER") {
    return true;
  }

  if (memberRole === "QA") {
    return requiredAction === "VIEW";
  }

  const memberPerms = parseMemberPermissions(permissions, memberRole);
  const action = memberPerms[pageKey as ProjectPageKey] || "NONE";

  if (requiredAction === "VIEW") {
    return action === "VIEW" || action === "EDIT";
  }

  if (requiredAction === "EDIT") {
    return action === "EDIT";
  }

  return false;
}
