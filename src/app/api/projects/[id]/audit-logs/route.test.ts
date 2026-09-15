import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  verifyProjectAccess: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCount: vi.fn(),
  breakerFamilyFindMany: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    projectAuditLog: {
      findMany: vi.fn(async (...args) => mocks.auditLogFindMany(...args)),
      count: vi.fn(async (...args) => mocks.auditLogCount(...args)),
    },
    breakerFamily: {
      findMany: vi.fn(async (...args) => mocks.breakerFamilyFindMany(...args)),
    },
  },
}));

async function getLogs(projectId: string, queryString = "") {
  const { GET } = await import("./route");
  const url = `http://localhost/api/projects/${projectId}/audit-logs${queryString ? `?${queryString}` : ""}`;
  return GET(new Request(url), {
    params: Promise.resolve({ id: projectId }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  mocks.verifyProjectAccess.mockResolvedValue({
    project: { id: "proj-1", name: "Tower Alpha" },
    member: { role: "PROJECT_MANAGER" },
    user: { id: "user-1", name: "John PM" },
  });

  mocks.auditLogFindMany.mockImplementation(async ({ select, distinct }) => {
    if (distinct) {
      return [{ userId: "user-1", userName: "John PM" }];
    }
    return [
      {
        id: "log-1",
        projectId: "proj-1",
        userId: "user-1",
        userName: "John PM",
        userRole: "PROJECT_MANAGER",
        action: "UPDATE",
        entityType: "CABLE",
        entityId: "cable-1",
        description: "Upsized feeder cable F1 from 16mm² to 25mm²",
        createdAt: new Date("2026-08-19T10:00:00Z"),
      },
    ];
  });

  mocks.auditLogCount.mockResolvedValue(1);
});

describe("GET /api/projects/[id]/audit-logs", () => {
  it("returns formatted JSON response with logs, activeUsers, and pagination count", async () => {
    const res = await getLogs("proj-1");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.logs).toHaveLength(1);
    expect(data.totalCount).toBe(1);
    expect(data.activeUsers).toBeDefined();
    expect(data.logs[0].entityType).toBe("CABLE");
  });

  it("passes search query and entity filters to database query", async () => {
    const res = await getLogs("proj-1", "search=upsized&entityType=CABLE&action=UPDATE");
    expect(res.status).toBe(200);
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-1",
          entityType: "CABLE",
          action: "UPDATE",
        }),
      })
    );
  });

  it("streams CSV export when format=csv is passed", async () => {
    const res = await getLogs("proj-1", "format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");

    const csvText = await res.text();
    expect(csvText).toContain("Timestamp,User,Role,Action,Category,Description");
    expect(csvText).toContain("John PM");
    expect(csvText).toContain("Upsized feeder cable F1 from 16mm² to 25mm²");
  });

  it("retroactively enriches legacy project update logs with breaker family names", async () => {
    mocks.auditLogFindMany.mockImplementation(async ({ distinct }) => {
      if (distinct) return [];
      return [
        {
          id: "log-legacy",
          projectId: "proj-1",
          userId: "user-1",
          userName: "hermes2",
          userRole: "PROJECT_MANAGER",
          action: "UPDATE",
          entityType: "PROJECT",
          description: "Updated project parameters",
          details: JSON.stringify({
            defaultAcbFamilyId: "fam-acb-1",
            defaultMccbFamilyId: "fam-mccb-1",
            defaultMcbFamilyId: "fam-mcb-1",
          }),
          createdAt: new Date("2026-09-14T10:00:00Z"),
        },
      ];
    });

    mocks.breakerFamilyFindMany.mockResolvedValue([
      { id: "fam-acb-1", name: "Masterpact MTZ", manufacturer: "Schneider" },
      { id: "fam-mccb-1", name: "ComPacT NSXm", manufacturer: "Schneider" },
      { id: "fam-mcb-1", name: "Acti9 iC60N", manufacturer: "Schneider" },
    ]);

    const res = await getLogs("proj-1");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.logs).toHaveLength(1);
    const enrichedLog = data.logs[0];
    expect(enrichedLog.entityType).toBe("BREAKER");
    expect(enrichedLog.description).toContain("Schneider Masterpact MTZ");
    expect(enrichedLog.description).toContain("Schneider ComPacT NSXm");
    expect(enrichedLog.description).toContain("Schneider Acti9 iC60N");

    const parsedDetails = JSON.parse(enrichedLog.details);
    expect(parsedDetails.changes).toHaveLength(3);
    expect(parsedDetails.changes[0].newDisplay).toBe("Schneider Masterpact MTZ");
  });
});
