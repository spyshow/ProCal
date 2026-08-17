import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  projectFindUnique: vi.fn(),
  revisionCount: vi.fn(),
  revisionFindMany: vi.fn(),
  revisionCreate: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    projectRevision: {
      count: mocks.revisionCount,
      findMany: mocks.revisionFindMany,
      create: mocks.revisionCreate,
    },
  },
}));

async function get(id: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/projects/${id}/revisions`), {
    params: Promise.resolve({ id }),
  });
}

async function post(id: string, body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/projects/${id}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: null };
});

describe("GET /api/projects/[id]/revisions", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.user = null;
    const res = await get("p1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the project is not owned by the user", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    const res = await get("p1");
    expect(res.status).toBe(404);
  });

  it("lists revisions mapped to the client DTO shape", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1" });
    mocks.revisionFindMany.mockResolvedValue([
      {
        id: "r1",
        projectId: "p1",
        rev: "R0",
        description: "Initial issue",
        createdById: "u1",
        snapshotJson: "{}",
        createdAt: new Date("2026-08-01T10:00:00Z"),
        createdBy: { username: "alice" },
      },
    ]);

    const res = await get("p1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: "r1",
      projectId: "p1",
      rev: "R0",
      description: "Initial issue",
      createdById: "u1",
      createdByUsername: "alice",
      snapshotJson: "{}",
      createdAt: "2026-08-01T10:00:00.000Z",
    });
  });
});

describe("POST /api/projects/[id]/revisions", () => {
  it("returns 400 when description is missing", async () => {
    const res = await post("p1", {});
    expect(res.status).toBe(400);
  });

  it("creates R0 with a snapshot of the serialized project", async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Test Tower",
      buildings: [{ id: "b1", name: "Tower A", floorDesigns: [], buildingLoads: [] }],
      apartmentTemplates: [],
      loadLibraryItems: [],
    });
    mocks.revisionCount.mockResolvedValue(0);
    mocks.revisionCreate.mockResolvedValue({
      id: "r1",
      projectId: "p1",
      rev: "R0",
      description: "Issued for comment",
      createdById: "u1",
      snapshotJson: JSON.stringify({ id: "p1", name: "Test Tower" }),
      createdAt: new Date("2026-08-01T10:00:00Z"),
      createdBy: { username: "alice" },
    });

    const res = await post("p1", { description: "Issued for comment" });
    expect(res.status).toBe(201);

    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          rev: "R0",
          description: "Issued for comment",
          createdById: "u1",
        }),
      })
    );
    // The snapshot must embed the serialized project state.
    const createCall = mocks.revisionCreate.mock.calls[0][0];
    const snapshot = JSON.parse(createCall.data.snapshotJson);
    expect(snapshot.id).toBe("p1");
    expect(snapshot.buildings[0].name).toBe("Tower A");

    const data = await res.json();
    expect(data.rev).toBe("R0");
    expect(data.createdByUsername).toBe("alice");
  });

  it("increments the rev number per existing revision", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1", buildings: [], apartmentTemplates: [], loadLibraryItems: [] });
    mocks.revisionCount.mockResolvedValue(3);
    mocks.revisionCreate.mockResolvedValue({
      id: "r4", projectId: "p1", rev: "R3", description: "Fourth issue",
      createdById: "u1", snapshotJson: "{}", createdAt: new Date(),
      createdBy: { username: "alice" },
    });

    const res = await post("p1", { description: "Fourth issue" });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.rev).toBe("R3");
  });
});
