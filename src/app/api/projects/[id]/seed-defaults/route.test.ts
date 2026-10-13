import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  verifyProjectAccess: vi.fn(),
  projectFindUnique: vi.fn(),
  seedDefaultProjectTemplates: vi.fn(),
  seedDefaultLoadLibrary: vi.fn(),
  logProjectActivity: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("@/lib/project-defaults", () => ({
  seedDefaultProjectTemplates: vi.fn(async (...args) => mocks.seedDefaultProjectTemplates(...args)),
  seedDefaultLoadLibrary: vi.fn(async (...args) => mocks.seedDefaultLoadLibrary(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: vi.fn(async (...args) => mocks.projectFindUnique(...args)),
    },
  },
}));

async function postSeed(projectId: string, body?: unknown) {
  const { POST } = await import("./route");
  const req = body !== undefined
    ? new Request(`http://localhost/api/projects/${projectId}/seed-defaults`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    : new Request(`http://localhost/api/projects/${projectId}/seed-defaults`, {
        method: "POST",
      });
  return POST(req, { params: Promise.resolve({ id: projectId }) });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.verifyProjectAccess.mockResolvedValue({
    user: { id: "u1", name: "User 1", username: "u1" },
    member: { role: "PROJECT_MANAGER" },
  });
  mocks.seedDefaultProjectTemplates.mockResolvedValue([{ id: "tpl-1" }, { id: "tpl-2" }, { id: "tpl-3" }]);
  mocks.seedDefaultLoadLibrary.mockResolvedValue(undefined);
});

describe("POST /api/projects/[id]/seed-defaults", () => {
  it("returns 404 if project is not found", async () => {
    mocks.projectFindUnique.mockResolvedValueOnce(null);
    const res = await postSeed("p-missing");
    expect(res.status).toBe(404);
  });

  it("seeds both templates and loads when type is 'all' or omitted and collections are empty", async () => {
    mocks.projectFindUnique
      .mockResolvedValueOnce({
        id: "p1",
        country: "Syria",
        apartmentTemplates: [],
        loadLibraryItems: [],
      })
      .mockResolvedValueOnce({
        id: "p1",
        apartmentTemplates: [{ id: "tpl-1" }],
        loadLibraryItems: [{ id: "load-1" }],
      });

    const res = await postSeed("p1");
    expect(res.status).toBe(200);
    expect(mocks.seedDefaultProjectTemplates).toHaveBeenCalledWith("p1", "Syria");
    expect(mocks.seedDefaultLoadLibrary).toHaveBeenCalledWith("p1");
  });

  it("seeds only templates when type is 'templates'", async () => {
    mocks.projectFindUnique
      .mockResolvedValueOnce({
        id: "p1",
        country: "Syria",
        apartmentTemplates: [],
        loadLibraryItems: [],
      })
      .mockResolvedValueOnce({
        id: "p1",
        apartmentTemplates: [{ id: "tpl-1" }],
        loadLibraryItems: [],
      });

    const res = await postSeed("p1", { type: "templates" });
    expect(res.status).toBe(200);
    expect(mocks.seedDefaultProjectTemplates).toHaveBeenCalledWith("p1", "Syria");
    expect(mocks.seedDefaultLoadLibrary).not.toHaveBeenCalled();
  });

  it("seeds only loads when type is 'loads'", async () => {
    mocks.projectFindUnique
      .mockResolvedValueOnce({
        id: "p1",
        country: "Syria",
        apartmentTemplates: [],
        loadLibraryItems: [],
      })
      .mockResolvedValueOnce({
        id: "p1",
        apartmentTemplates: [],
        loadLibraryItems: [{ id: "load-1" }],
      });

    const res = await postSeed("p1", { type: "loads" });
    expect(res.status).toBe(200);
    expect(mocks.seedDefaultProjectTemplates).not.toHaveBeenCalled();
    expect(mocks.seedDefaultLoadLibrary).toHaveBeenCalledWith("p1");
  });

  it("does not re-seed templates or loads if they already exist", async () => {
    mocks.projectFindUnique
      .mockResolvedValueOnce({
        id: "p1",
        country: "Syria",
        apartmentTemplates: [{ id: "existing-tpl" }],
        loadLibraryItems: [{ id: "existing-load" }],
      })
      .mockResolvedValueOnce({
        id: "p1",
        apartmentTemplates: [{ id: "existing-tpl" }],
        loadLibraryItems: [{ id: "existing-load" }],
      });

    const res = await postSeed("p1", { type: "all" });
    expect(res.status).toBe(200);
    expect(mocks.seedDefaultProjectTemplates).not.toHaveBeenCalled();
    expect(mocks.seedDefaultLoadLibrary).not.toHaveBeenCalled();
  });
});
