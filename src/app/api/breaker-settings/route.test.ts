import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  sessionUser: { id: "user-1", name: "Tester", username: "tester" },
  verifyProjectAccess: vi.fn(),
  breakerUpsert: vi.fn(),
  breakerFindMany: vi.fn(),
  breakerDelete: vi.fn(),
  breakerFindUnique: vi.fn(),
  breakerUpdate: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.sessionUser),
}));

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    breakerSettings: {
      upsert: vi.fn(async (...args) => mocks.breakerUpsert(...args)),
      findMany: vi.fn(async (...args) => mocks.breakerFindMany(...args)),
      delete: vi.fn(async (...args) => mocks.breakerDelete(...args)),
      findUnique: vi.fn(async (...args) => mocks.breakerFindUnique(...args)),
      update: vi.fn(async (...args) => mocks.breakerUpdate(...args)),
    },
  },
}));

const validBody = {
  breakerId: "a2abb0ca-8920-47ba-9ac8-1e515c921988-main-incomer",
  model: "Main Incomer ACB",
  manufacturer: "Schneider",
  frameSize: "630A",
  ir: 1008,
  tr: 12,
  isd: 2520,
  tsd: 0.3,
  ii: 6300,
};

describe("POST /api/breaker-settings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.breakerUpsert.mockResolvedValue({ id: "bs-1", ...validBody });
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "a2abb0ca-8920-47ba-9ac8-1e515c921988" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/breaker-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakerId: "x-1", model: "ACB" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when breakerId is not project-scoped", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/breaker-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, breakerId: "legacy-global-breaker" }),
      })
    );
    expect(res.status).toBe(400);
    expect(mocks.verifyProjectAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when member lacks EDIT on breaker modules", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/breaker-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(403);
    expect(mocks.breakerUpsert).not.toHaveBeenCalled();
  });

  it("allows EDIT on breakerSchedule or coordination", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/breaker-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(200);
    expect(mocks.breakerUpsert).toHaveBeenCalledTimes(1);
    const args = mocks.breakerUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ breakerId: validBody.breakerId });
  });
});

describe("PUT /api/breaker-settings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.breakerUpdate = vi.fn(async () => ({ id: "bs-1", ...validBody }));
    mocks.breakerFindUnique.mockResolvedValue({ id: "bs-1", ...validBody });
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "a2abb0ca-8920-47ba-9ac8-1e515c921988" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 403 when project access is denied", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { PUT } = await import("./[id]/route");
    const res = await PUT(
      new Request("http://localhost/api/breaker-settings/bs-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, ir: 1200 }),
      }),
      { params: Promise.resolve({ id: "bs-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when the setting does not exist", async () => {
    mocks.breakerFindUnique.mockResolvedValue(null);
    const { DELETE } = await import("./[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/breaker-settings/bs-missing", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "bs-missing" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/breaker-settings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.breakerDelete = vi.fn(async () => ({ success: true }));
    mocks.breakerFindUnique.mockResolvedValue({ id: "bs-1", ...validBody });
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "a2abb0ca-8920-47ba-9ac8-1e515c921988" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 403 when project access is denied", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { DELETE } = await import("./[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/breaker-settings/bs-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "bs-1" }) }
    );
    expect(res.status).toBe(403);
    expect(mocks.breakerDelete).not.toHaveBeenCalled();
  });

  it("deletes the setting when authorized", async () => {
    const { DELETE } = await import("./[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/breaker-settings/bs-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "bs-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mocks.breakerDelete).toHaveBeenCalledTimes(1);
  });
});