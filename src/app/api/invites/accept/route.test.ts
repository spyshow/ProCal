import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  sessionUser: null as null | { id: string; username: string; email: string },
  inviteFindUnique: vi.fn(),
  inviteUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  memberUpsert: vi.fn(),
  logProjectActivity: vi.fn(),
  signJWT: vi.fn(async (_payload?: any) => "jwt-session-token"),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.sessionUser),
  signJWT: vi.fn(async (payload?: any) => mocks.signJWT(payload)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hashed_${pw}`),
    compare: vi.fn(async (pw: string, hash: string) => hash === `hashed_${pw}` || hash === "valid_hash"),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    projectInvite: {
      findUnique: vi.fn(async (...args) => mocks.inviteFindUnique(...args)),
      update: vi.fn(async (...args) => mocks.inviteUpdate(...args)),
    },
    user: {
      findFirst: vi.fn(async (...args) => mocks.userFindFirst(...args)),
      findUnique: vi.fn(async (...args) => mocks.userFindUnique(...args)),
      create: vi.fn(async (...args) => mocks.userCreate(...args)),
    },
    projectMember: {
      upsert: vi.fn(async (...args) => mocks.memberUpsert(...args)),
    },
  },
}));

async function postAccept(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  mocks.sessionUser = null;
  mocks.inviteFindUnique.mockResolvedValue({
    id: "inv-1",
    email: "newuser@example.com",
    name: "New Engineer",
    role: "ENGINEER",
    permissions: JSON.stringify({ cableSchedule: "EDIT" }),
    projectId: "proj-1",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 86400000), // tomorrow
    project: { id: "proj-1", name: "Tower Alpha" },
  });

  mocks.userFindFirst.mockResolvedValue(null); // new user
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.userCreate.mockImplementation(async ({ data }) => ({
    id: "user-new",
    ...data,
  }));
  mocks.memberUpsert.mockImplementation(async ({ create }) => ({
    id: "mem-new",
    ...create,
  }));
});

describe("POST /api/invites/accept", () => {
  it("successfully registers a new user, links project membership, and sets session cookie", async () => {
    const res = await postAccept({
      token: "valid-token-string",
      name: "New Engineer",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.projectId).toBe("proj-1");

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "newuser@example.com",
          name: "New Engineer",
        }),
      })
    );

    expect(mocks.memberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          projectId: "proj-1",
          userId: "user-new",
          role: "ENGINEER",
        }),
      })
    );

    expect(mocks.inviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { status: "ACCEPTED" },
      })
    );

    // Verify session_token cookie is attached to response
    expect(res.cookies.get("session_token")?.value).toBe("jwt-session-token");
  });

  it("rejects when password is shorter than 6 characters for a new user", async () => {
    const res = await postAccept({
      token: "valid-token-string",
      name: "New Engineer",
      password: "123",
      confirmPassword: "123",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at least 6 characters/i);
  });

  it("rejects when passwords do not match", async () => {
    const res = await postAccept({
      token: "valid-token-string",
      name: "New Engineer",
      password: "password123",
      confirmPassword: "different-password",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/passwords do not match/i);
  });

  it("rejects when invitation has expired", async () => {
    mocks.inviteFindUnique.mockResolvedValue({
      id: "inv-1",
      email: "newuser@example.com",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    });

    const res = await postAccept({
      token: "valid-token-string",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/expired/i);
  });
});
