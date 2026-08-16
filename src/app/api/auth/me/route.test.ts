import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  update: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: vi.fn(async (...args) => mocks.update(...args)),
    },
  },
}));

async function getMe() {
  const { GET } = await import("./route");
  return GET();
}

async function patchMe(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request("http://localhost/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = {
    id: "user-123",
    username: "john_engineer",
    name: "John Engineer",
    role: "USER",
    credits: 5,
    email: "john@example.com",
  };
  mocks.update.mockImplementation(async ({ data }) => ({
    id: "user-123",
    username: "john_engineer",
    name: data.name ?? "John Engineer",
    role: "USER",
    credits: 5,
    email: data.email ?? "john@example.com",
  }));
});

describe("GET /api/auth/me", () => {
  it("returns current session user", async () => {
    const res = await getMe();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user?.username).toBe("john_engineer");
  });

  it("returns null user when unauthenticated", async () => {
    mocks.user = null;
    const res = await getMe();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeNull();
  });
});

describe("PATCH /api/auth/me", () => {
  it("updates email and returns updated user", async () => {
    const res = await patchMe({ email: "updated.engineer@domain.com" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("updated.engineer@domain.com");
  });

  it("rejects invalid email with 400", async () => {
    const res = await patchMe({ email: "bad-email" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
  });
});
