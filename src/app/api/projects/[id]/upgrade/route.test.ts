import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number },
  projectFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  projectUpdateMany: vi.fn(),
  logProjectActivity: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: vi.fn(async (...args) => mocks.projectFindUnique(...args)),
    },
    $transaction: vi.fn(async (cb) => {
      const tx = {
        user: {
          updateMany: vi.fn(async (...args) => mocks.userUpdateMany(...args)),
        },
        project: {
          updateMany: vi.fn(async (...args) => mocks.projectUpdateMany(...args)),
        },
      };
      return cb(tx);
    }),
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

async function postUpgrade(projectId = "p1") {
  const { POST } = await import("./route");
  return POST(new Request(`http://localhost/api/projects/${projectId}/upgrade`, { method: "POST" }), {
    params: Promise.resolve({ id: projectId }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "eng1", name: "Engineer 1", role: "USER", credits: 2 };
  mocks.projectFindUnique.mockResolvedValue({ id: "p1", userId: "u1", isTrial: true });
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  mocks.projectUpdateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/projects/[id]/upgrade", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mocks.user = null;
    const res = await postUpgrade("p1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when project does not exist", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    const res = await postUpgrade("p999");
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is neither owner nor admin", async () => {
    mocks.user = { id: "other-user", username: "other", name: "Other", role: "USER", credits: 5 };
    const res = await postUpgrade("p1");
    expect(res.status).toBe(403);
  });

  it("returns alreadyUpgraded when isTrial is already false", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "p1", userId: "u1", isTrial: false });
    const res = await postUpgrade("p1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyUpgraded).toBe(true);
  });

  it("returns 402 if non-admin has no credits", async () => {
    mocks.user = { id: "u1", username: "eng1", name: "Engineer 1", role: "USER", credits: 0 };
    mocks.userUpdateMany.mockResolvedValue({ count: 0 }); // condition credits: { gte: 1 } matched 0
    const res = await postUpgrade("p1");
    expect(res.status).toBe(402);
  });

  it("successfully upgrades project for owner with credits", async () => {
    const res = await postUpgrade("p1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "u1", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith({
      where: { id: "p1", isTrial: true },
      data: { isTrial: false },
    });
    expect(mocks.logProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        action: "UPDATE",
        description: expect.stringContaining("Upgraded Free Trial"),
      })
    );
  });

  it("allows ADMIN to upgrade project without spending credits", async () => {
    mocks.user = { id: "admin-1", username: "admin", name: "Admin", role: "ADMIN", credits: 0 };
    const res = await postUpgrade("p1");
    expect(res.status).toBe(200);
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.projectUpdateMany).toHaveBeenCalled();
  });
});
