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

async function patchProfile(body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request("http://localhost/api/auth/profile", {
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

describe("PATCH /api/auth/profile", () => {
  it("T1 updates email successfully and returns 200", async () => {
    const res = await patchProfile({ email: "new.email@example.com" });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("new.email@example.com");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { email: "new.email@example.com" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        credits: true,
        email: true,
      },
    });
  });

  it("T2 updates name and email together", async () => {
    const res = await patchProfile({
      name: "John Pro Engineer",
      email: "john.pro@example.com",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.name).toBe("John Pro Engineer");
    expect(data.user.email).toBe("john.pro@example.com");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: {
        name: "John Pro Engineer",
        email: "john.pro@example.com",
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        credits: true,
        email: true,
      },
    });
  });

  it("T3 unauthenticated: returns 401 when not logged in", async () => {
    mocks.user = null;
    const res = await patchProfile({ email: "new@example.com" });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/unauthorized/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T4 invalid email format: returns 400", async () => {
    const res = await patchProfile({ email: "not-an-email" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T5 empty name: returns 400", async () => {
    const res = await patchProfile({ name: "   " });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name cannot be empty/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T6 no fields: returns 400 when body has nothing to update", async () => {
    const res = await patchProfile({});
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/nothing to update/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
