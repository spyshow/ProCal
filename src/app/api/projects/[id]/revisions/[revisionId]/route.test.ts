import { describe, it, expect, vi, beforeEach } from "vitest";

// DELETE /api/projects/[id]/revisions/[revisionId] — owner-only removal.
// Mirrors the restore route's opaque-404 posture: the project must be owned
// by the session user, and the revision must belong to that project.

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  projectFindUnique: vi.fn(),
  revisionFindUnique: vi.fn(),
  revisionDelete: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    projectRevision: {
      findUnique: mocks.revisionFindUnique,
      delete: mocks.revisionDelete,
    },
  },
}));

async function del(id: string, revisionId: string) {
  const { DELETE } = await import("./route");
  return DELETE(new Request(`http://localhost/api/projects/${id}/revisions/${revisionId}`, {
    method: "DELETE",
  }), { params: Promise.resolve({ id, revisionId }) });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: null };
});

describe("DELETE /api/projects/[id]/revisions/[revisionId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.user = null;
    const res = await del("p1", "r1");
    expect(res.status).toBe(401);
    expect(mocks.revisionDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the project is not owned by the user", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    const res = await del("p1", "r1");
    expect(res.status).toBe(404);
    expect(mocks.revisionFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the revision does not exist", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1" });
    mocks.revisionFindUnique.mockResolvedValue(null);
    const res = await del("p1", "r1");
    expect(res.status).toBe(404);
    expect(mocks.revisionDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the revision belongs to another project", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1" });
    mocks.revisionFindUnique.mockResolvedValue({ id: "r1", projectId: "p2" });
    const res = await del("p1", "r1");
    expect(res.status).toBe(404);
    expect(mocks.revisionDelete).not.toHaveBeenCalled();
  });

  it("deletes the revision and returns ok", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1" });
    mocks.revisionFindUnique.mockResolvedValue({ id: "r1", projectId: "p1" });
    mocks.revisionDelete.mockResolvedValue({ id: "r1" });
    const res = await del("p1", "r1");
    expect(res.status).toBe(200);
    expect(mocks.revisionDelete).toHaveBeenCalledWith({ where: { id: "r1" } });
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });
});