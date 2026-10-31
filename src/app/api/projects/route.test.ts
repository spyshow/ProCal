import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; hasUsedTrial?: boolean },
  projectCreate: vi.fn(),
  projectFindMany: vi.fn(),
  projectCount: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userUpdateMany: vi.fn(),
  projectMemberCreate: vi.fn(),
  transaction: vi.fn(),
  seedDefaultProjectTemplates: vi.fn(),
  seedDefaultLoadLibrary: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => mocks.userFindUnique()),
      update: vi.fn(async (...args) => mocks.userUpdate(...args)),
      updateMany: vi.fn(async (...args) => mocks.userUpdateMany(...args)),
    },
    project: {
      create: vi.fn(async (...args) => mocks.projectCreate(...args)),
      findMany: vi.fn(async (...args) => mocks.projectFindMany(...args)),
      count: vi.fn(async (...args) => mocks.projectCount(...args)),
    },
    projectMember: {
      create: vi.fn(async (...args) => mocks.projectMemberCreate(...args)),
    },
    $transaction: vi.fn(async (ops) => mocks.transaction(ops)),
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(),
}));

vi.mock("@/lib/project-defaults", () => ({
  seedDefaultProjectTemplates: vi.fn((...args) => mocks.seedDefaultProjectTemplates(...args)),
  seedDefaultLoadLibrary: vi.fn((...args) => mocks.seedDefaultLoadLibrary(...args)),
}));

async function get(url = "http://localhost/api/projects") {
  const { GET } = await import("./route");
  return GET(new Request(url));
}

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "engineer1", name: "Engineer 1", role: "ADMIN", credits: 10 };
  mocks.projectCreate.mockResolvedValue({ id: "p1", name: "Test Project" });
  mocks.projectFindMany.mockResolvedValue([]);
  mocks.projectCount.mockResolvedValue(0);
  mocks.projectMemberCreate.mockResolvedValue({ id: "pm1" });
  mocks.userFindUnique.mockResolvedValue({ credits: 10, hasUsedTrial: false });
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (ops) => {
    if (Array.isArray(ops)) {
      return [null, { id: "p1", name: "Test Project" }];
    }
    if (typeof ops === "function") {
      return ops({
        user: { update: mocks.userUpdate, updateMany: mocks.userUpdateMany },
        project: { create: mocks.projectCreate },
      });
    }
    return ops;
  });
});

describe("POST /api/projects - Electrical Input Validation (UI-CRIT-02)", () => {
  it("rejects request if project name is missing", async () => {
    const res = await post({ voltage: 400 });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("name is required");
  });

  it("rejects power factor > 1.0 (e.g. 1.85)", async () => {
    const res = await post({
      name: "Invalid PF Project",
      powerFactor: 1.85,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("powerFactor must be between 0.10 and 1.00");
  });

  it("rejects power factor < 0.10", async () => {
    const res = await post({
      name: "Invalid Low PF",
      powerFactor: 0.05,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("powerFactor must be between 0.10 and 1.00");
  });

  it("rejects negative or out-of-range voltage", async () => {
    const resNeg = await post({
      name: "Negative Voltage",
      voltage: -400,
    });
    expect(resNeg.status).toBe(400);
    const dataNeg = await resNeg.json();
    expect(dataNeg.error).toContain("voltage must be between 100 and 1000");

    const resTooHigh = await post({
      name: "Over Voltage",
      voltage: 1500,
    });
    expect(resTooHigh.status).toBe(400);
  });

  it("rejects out-of-range frequency (e.g. 0 Hz or 100 Hz)", async () => {
    const res = await post({
      name: "Invalid Freq",
      frequency: 0,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("frequency must be between 45 and 65");
  });

  it("accepts valid physical electrical parameters and creates project", async () => {
    const res = await post({
      name: "Valid Hospital Project",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("p1");
    expect(mocks.projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Valid Hospital Project",
          voltage: 400,
          frequency: 50,
          powerFactor: 0.85,
        }),
      })
    );
    expect(mocks.seedDefaultProjectTemplates).not.toHaveBeenCalled();
    expect(mocks.seedDefaultLoadLibrary).not.toHaveBeenCalled();
  });

  it("seeds templates and service loads only when seedDefaults is true", async () => {
    const res = await post({
      name: "Project With Defaults",
      seedDefaults: true,
    });
    expect(res.status).toBe(200);
    expect(mocks.seedDefaultProjectTemplates).toHaveBeenCalledWith("p1", undefined);
    expect(mocks.seedDefaultLoadLibrary).toHaveBeenCalledWith("p1");
  });
});

describe("GET /api/projects - Pagination & Filtering", () => {
  it("returns 401 Unauthorized if user is not logged in", async () => {
    mocks.user = null;
    const res = await get();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns default paginated payload (page 1, limit 20) with pagination metadata", async () => {
    mocks.projectCount.mockResolvedValue(45);
    mocks.projectFindMany.mockResolvedValue([
      { id: "p1", name: "Alpha", userId: "u1", buildings: [], members: [] },
    ]);

    const res = await get("http://localhost/api/projects");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
    expect(data.total).toBe(45);
    expect(data.totalCount).toBe(45);
    expect(data.totalPages).toBe(3);
    expect(data.hasMore).toBe(true);
    expect(data.projects).toHaveLength(1);
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 })
    );
  });

  it("respects custom page and limit parameters", async () => {
    mocks.projectCount.mockResolvedValue(45);
    mocks.projectFindMany.mockResolvedValue([
      { id: "p21", name: "Twenty-One", userId: "u1", buildings: [], members: [] },
    ]);

    const res = await get("http://localhost/api/projects?page=3&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.page).toBe(3);
    expect(data.limit).toBe(10);
    expect(data.totalPages).toBe(5);
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });

  it("supports offset parameter overriding page calculation", async () => {
    mocks.projectCount.mockResolvedValue(15);
    mocks.projectFindMany.mockResolvedValue([]);

    const res = await get("http://localhost/api/projects?offset=5&limit=5");
    expect(res.status).toBe(200);
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 5 })
    );
  });

  it("bypasses take/skip when all=true is specified", async () => {
    mocks.projectCount.mockResolvedValue(55);
    mocks.projectFindMany.mockResolvedValue([
      { id: "p1", name: "A", userId: "u1", buildings: [], members: [] },
    ]);

    const res = await get("http://localhost/api/projects?all=true");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.page).toBe(1);
    expect(data.limit).toBe(55);
    expect(data.totalPages).toBe(1);
    expect(data.hasMore).toBe(false);

    const callArgs = mocks.projectFindMany.mock.calls[0][0];
    expect(callArgs.take).toBeUndefined();
    expect(callArgs.skip).toBeUndefined();
  });

  it("applies case-insensitive search filter across project fields", async () => {
    mocks.projectCount.mockResolvedValue(2);
    mocks.projectFindMany.mockResolvedValue([]);

    await get("http://localhost/api/projects?search=hospital");
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([{ userId: "u1" }]),
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: "hospital", mode: "insensitive" } },
                { client: { contains: "hospital", mode: "insensitive" } },
                { location: { contains: "hospital", mode: "insensitive" } },
                { consultant: { contains: "hospital", mode: "insensitive" } },
                { contractor: { contains: "hospital", mode: "insensitive" } },
                { engineer: { contains: "hospital", mode: "insensitive" } },
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("returns flat array when format=flat is requested", async () => {
    mocks.projectFindMany.mockResolvedValue([
      { id: "p1", name: "Flat Project", userId: "u1", buildings: [], members: [] },
    ]);

    const res = await get("http://localhost/api/projects?format=flat");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe("p1");
    expect(data[0].isOwner).toBe(true);
  });

  it("enriches projects with member role and permissions", async () => {
    mocks.projectFindMany.mockResolvedValue([
      { id: "p-owned", userId: "u1", buildings: [], members: [] },
      {
        id: "p-member",
        userId: "other-user",
        buildings: [],
        members: [{ role: "ENGINEER", permissions: '{"calculator":"VIEW"}' }],
      },
    ]);

    const res = await get("http://localhost/api/projects");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.projects[0].isOwner).toBe(true);
    expect(data.projects[0].currentMemberRole).toBe("PROJECT_MANAGER");
    expect(data.projects[1].isOwner).toBe(false);
    expect(data.projects[1].currentMemberRole).toBe("ENGINEER");
    expect(data.projects[1].currentMemberPermissions).toBeDefined();
  });

  // Regression: ISSUE-009 — Engineering Dashboard always displayed 0 Apartments and 0 Load Items
  // Found by /qa on 2026-10-17
  // Report: .gstack/qa-reports/qa-report-localhost-3000-2026-10-17.md
  it("selects buildings.apartmentsPerFloor and loadLibraryItems so dashboard KPIs are non-zero", async () => {
    mocks.projectCount.mockResolvedValue(1);
    mocks.projectFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Test Project - Mixed Use Complex",
        userId: "u1",
        buildings: [
          { id: "b1", name: "Tower A", floors: 19, apartmentsPerFloor: 4 },
          { id: "b2", name: "Tower B", floors: 9, apartmentsPerFloor: 4 },
        ],
        loadLibraryItems: [{ id: "l1" }, { id: "l2" }],
        members: [],
      },
    ]);

    const res = await get("http://localhost/api/projects?all=true");
    expect(res.status).toBe(200);
    const data = await res.json();

    const callSelect = mocks.projectFindMany.mock.calls[0][0].select;
    expect(callSelect.buildings.select.apartmentsPerFloor).toBe(true);
    expect(callSelect.loadLibraryItems).toEqual({ select: { id: true } });
    expect(data.projects[0].buildings[0].apartmentsPerFloor).toBe(4);
    expect(data.projects[0].loadLibraryItems).toHaveLength(2);
  });
});



describe("POST /api/projects - Free Trial & Credit Enforcement", () => {
  it("allows a non-admin with 0 credits and !hasUsedTrial to create a trial project", async () => {
    mocks.user = { id: "u2", username: "newbie", name: "Newbie", role: "USER", credits: 0, hasUsedTrial: false };
    mocks.userFindUnique.mockResolvedValue({ credits: 0, hasUsedTrial: false });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });

    const res = await post({ name: "My First Trial" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("p1");

    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "u2", hasUsedTrial: false },
      data: { hasUsedTrial: true },
    });
    expect(mocks.projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My First Trial",
          isTrial: true,
          userId: "u2",
        }),
      })
    );
  });

  it("rejects non-admin with 0 credits who has already used their trial", async () => {
    mocks.user = { id: "u2", username: "used-trial", name: "Used Trial", role: "USER", credits: 0, hasUsedTrial: true };
    mocks.userFindUnique.mockResolvedValue({ credits: 0, hasUsedTrial: true });

    const res = await post({ name: "Another Trial Attempt" });
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toContain("No credits remaining");
    expect(mocks.projectCreate).not.toHaveBeenCalled();
  });

  it("rejects if atomic claim of trial fails due to race condition", async () => {
    mocks.user = { id: "u2", username: "racer", name: "Racer", role: "USER", credits: 0, hasUsedTrial: false };
    mocks.userFindUnique.mockResolvedValue({ credits: 0, hasUsedTrial: false });
    mocks.userUpdateMany.mockResolvedValue({ count: 0 }); // raced out

    const res = await post({ name: "Racing Trial" });
    expect(res.status).toBe(402);
    expect(mocks.projectCreate).not.toHaveBeenCalled();
  });

  it("decrements credits when non-admin has available credits", async () => {
    mocks.user = { id: "u3", username: "paid-user", name: "Paid User", role: "USER", credits: 5, hasUsedTrial: true };
    mocks.userFindUnique.mockResolvedValue({ credits: 5, hasUsedTrial: true });

    const res = await post({ name: "Paid Project" });
    expect(res.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalled();
  });
});
