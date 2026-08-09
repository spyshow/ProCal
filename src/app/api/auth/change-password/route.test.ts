import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  dbUser: null as null | { id: string; passwordHash: string },
  findUnique: vi.fn(),
  update: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async (...args) => mocks.findUnique(...args)),
      update: vi.fn(async (...args) => mocks.update(...args)),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (...args) => mocks.compare(...args)),
    hash: vi.fn(async (...args) => mocks.hash(...args)),
  },
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/auth/change-password", {
      method: "POST",
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
  mocks.dbUser = {
    id: "user-123",
    passwordHash: "old_hashed_password",
  };
  mocks.findUnique.mockResolvedValue(mocks.dbUser);
  mocks.update.mockResolvedValue({ id: "user-123" });
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue("new_hashed_password");
});

describe("POST /api/auth/change-password", () => {
  it("T1 happy path: updates password and returns 200", async () => {
    const res = await post({
      currentPassword: "OldPassword123",
      newPassword: "NewSecurePassword456",
      confirmPassword: "NewSecurePassword456",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/updated successfully/i);

    expect(mocks.compare).toHaveBeenCalledWith("OldPassword123", "old_hashed_password");
    expect(mocks.hash).toHaveBeenCalledWith("NewSecurePassword456", 10);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { passwordHash: "new_hashed_password" },
    });
  });

  it("T2 unauthenticated: returns 401 when no session is active", async () => {
    mocks.user = null;
    const res = await post({
      currentPassword: "OldPassword123",
      newPassword: "NewSecurePassword456",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/unauthorized/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T3 missing fields: returns 400 when fields are missing", async () => {
    const res1 = await post({ currentPassword: "OldPassword123" });
    expect(res1.status).toBe(400);

    const res2 = await post({ newPassword: "NewSecurePassword456" });
    expect(res2.status).toBe(400);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T4 short new password: returns 400 if new password < 6 chars", async () => {
    const res = await post({
      currentPassword: "OldPassword123",
      newPassword: "12345",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at least 6 characters/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T5 password mismatch: returns 400 if confirmPassword !== newPassword", async () => {
    const res = await post({
      currentPassword: "OldPassword123",
      newPassword: "NewSecurePassword456",
      confirmPassword: "DifferentPassword789",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/do not match/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T6 same as current password: returns 400 if new equals current", async () => {
    const res = await post({
      currentPassword: "OldPassword123",
      newPassword: "OldPassword123",
      confirmPassword: "OldPassword123",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/different from current password/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("T7 incorrect current password: returns 400 when bcrypt compare fails", async () => {
    mocks.compare.mockResolvedValue(false);
    const res = await post({
      currentPassword: "WrongPassword123",
      newPassword: "NewSecurePassword456",
      confirmPassword: "NewSecurePassword456",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/incorrect/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
