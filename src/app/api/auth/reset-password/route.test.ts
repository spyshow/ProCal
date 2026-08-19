import { describe, it, expect, vi, beforeEach } from "vitest";
import { signPasswordResetToken } from "@/lib/auth";

const mocks = {
  findUnique: vi.fn(),
  update: vi.fn(),
  hash: vi.fn(),
};

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
    hash: vi.fn(async (...args) => mocks.hash(...args)),
  },
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/auth/reset-password", () => {
  let validToken: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    validToken = await signPasswordResetToken("user-test-id", "test@example.com");
    mocks.findUnique.mockResolvedValue({ id: "user-test-id", disabled: false });
    mocks.update.mockResolvedValue({ id: "user-test-id" });
    mocks.hash.mockResolvedValue("new_hashed_password");
  });

  it("returns 400 if token or password is missing", async () => {
    const res1 = await post({ newPassword: "password123" });
    expect(res1.status).toBe(400);

    const res2 = await post({ token: validToken });
    expect(res2.status).toBe(400);
  });

  it("returns 400 if password is less than 6 characters", async () => {
    const res = await post({ token: validToken, newPassword: "123" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("6 characters");
  });

  it("returns 400 if passwords do not match", async () => {
    const res = await post({
      token: validToken,
      newPassword: "password123",
      confirmPassword: "password456",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("do not match");
  });

  it("returns 400 if token is invalid or expired", async () => {
    const res = await post({
      token: "invalid.fake.token",
      newPassword: "password123",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid or expired");
  });

  it("updates user password hash and returns success", async () => {
    const res = await post({
      token: validToken,
      newPassword: "newSecurePassword123!",
      confirmPassword: "newSecurePassword123!",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mocks.hash).toHaveBeenCalledWith("newSecurePassword123!", 10);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-test-id" },
      data: { passwordHash: "new_hashed_password" },
    });
  });
});
