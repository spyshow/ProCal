import { describe, it, expect } from "vitest";
import {
  parseMemberPermissions,
  hasProjectPagePermission,
  DEFAULT_ROLE_PERMISSIONS,
  MAX_PROJECT_MEMBERS,
  PROJECT_PAGE_KEYS,
} from "./project-permissions";

describe("Project Permissions & RBAC Library", () => {
  it("enforces MAX_PROJECT_MEMBERS to be 5", () => {
    expect(MAX_PROJECT_MEMBERS).toBe(5);
  });

  it("provides correct default permissions for PROJECT_MANAGER (all EDIT)", () => {
    const pmPerms = DEFAULT_ROLE_PERMISSIONS.PROJECT_MANAGER;
    for (const key of PROJECT_PAGE_KEYS) {
      expect(pmPerms[key]).toBe("EDIT");
    }
  });

  it("provides correct default permissions for QA (all VIEW)", () => {
    const qaPerms = DEFAULT_ROLE_PERMISSIONS.QA;
    for (const key of PROJECT_PAGE_KEYS) {
      expect(qaPerms[key]).toBe("VIEW");
    }
  });

  it("provides correct default permissions for ENGINEER (all EDIT)", () => {
    const engPerms = DEFAULT_ROLE_PERMISSIONS.ENGINEER;
    for (const key of PROJECT_PAGE_KEYS) {
      expect(engPerms[key]).toBe("EDIT");
    }
  });

  describe("parseMemberPermissions", () => {
    it("returns role defaults when permissions string is null or undefined", () => {
      const perms = parseMemberPermissions(null, "QA");
      expect(perms.cableSchedule).toBe("VIEW");
      expect(perms.breakerSchedule).toBe("VIEW");
    });

    it("parses valid JSON string with custom overrides for ENGINEER", () => {
      const jsonStr = JSON.stringify({
        cableSchedule: "VIEW",
        breakerSchedule: "NONE",
      });
      const perms = parseMemberPermissions(jsonStr, "ENGINEER");
      expect(perms.cableSchedule).toBe("VIEW");
      expect(perms.breakerSchedule).toBe("NONE");
      expect(perms.calculator).toBe("EDIT"); // fallback to default
    });

    it("handles corrupted or invalid JSON gracefully by falling back to role defaults", () => {
      const perms = parseMemberPermissions("{invalid-json", "ENGINEER");
      expect(perms.cableSchedule).toBe("EDIT");
    });
  });

  describe("hasProjectPagePermission", () => {
    it("allows PROJECT_MANAGER to view and edit any page regardless of stored string", () => {
      expect(hasProjectPagePermission("PROJECT_MANAGER", null, "cableSchedule", "VIEW")).toBe(true);
      expect(hasProjectPagePermission("PROJECT_MANAGER", null, "cableSchedule", "EDIT")).toBe(true);
    });

    it("allows QA to VIEW any page, but rejects EDIT action", () => {
      expect(hasProjectPagePermission("QA", null, "cableSchedule", "VIEW")).toBe(true);
      expect(hasProjectPagePermission("QA", null, "cableSchedule", "EDIT")).toBe(false);
    });

    it("evaluates ENGINEER permissions according to assigned matrix", () => {
      const customPerms = JSON.stringify({
        cableSchedule: "EDIT",
        breakerSchedule: "VIEW",
        sldDesigner: "NONE",
      });

      // Cable Schedule: EDIT allowed, VIEW allowed
      expect(hasProjectPagePermission("ENGINEER", customPerms, "cableSchedule", "EDIT")).toBe(true);
      expect(hasProjectPagePermission("ENGINEER", customPerms, "cableSchedule", "VIEW")).toBe(true);

      // Breaker Schedule: VIEW allowed, EDIT rejected
      expect(hasProjectPagePermission("ENGINEER", customPerms, "breakerSchedule", "VIEW")).toBe(true);
      expect(hasProjectPagePermission("ENGINEER", customPerms, "breakerSchedule", "EDIT")).toBe(false);

      // SLD Designer: VIEW rejected, EDIT rejected
      expect(hasProjectPagePermission("ENGINEER", customPerms, "sldDesigner", "VIEW")).toBe(false);
      expect(hasProjectPagePermission("ENGINEER", customPerms, "sldDesigner", "EDIT")).toBe(false);
    });
  });
});
