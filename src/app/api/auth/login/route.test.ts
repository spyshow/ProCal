import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as any,
  update: vi.fn(),
  compare: vi.fn(),
  signJWT: vi.fn(async (_args?: any) => "mock-jwt-token"),
};

vi.mock("@/lib/auth", () => ({
  signJWT: vi.fn(async (args) => mocks.signJWT(args)),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (...args) => mocks.compare(...args)),
    hash: vi.fn(async () => "hashed_password"),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  clientKey: vi.fn(() => "mock-ip"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(async ({ where }) => {
        if (!mocks.user) return null;
        // Simulate prisma OR matching for username and email (case-insensitive)
        const orConditions = where?.OR || [];
        for (const cond of orConditions) {
          if (cond.username && cond.username.equals) {
            if (mocks.user.username.toLowerCase() === cond.username.equals.toLowerCase()) {
              return mocks.user;
            }
          }
          if (cond.email && cond.email.equals) {
            if (mocks.user.email && mocks.user.email.toLowerCase() === cond.email.equals.toLowerCase()) {
              return mocks.user;
            }
          }
        }
        return null;
      }),
      update: vi.fn(async (...args) => mocks.update(...args)),
    },
  },
}));

async function postLogin(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/auth/login", {
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
    email: "john.engineer@example.com",
    role: "USER",
    passwordHash: "hashed_password",
    theme: "blueprint",
    disabled: false,
  };
  mocks.compare.mockImplementation(async (pw: string) => pw === "correct_password");
});

describe("POST /api/auth/login", () => {
  it("authenticates successfully using username", async () => {
    const res = await postLogin({
      username: "john_engineer",
      password: "correct_password",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe("john_engineer");
    expect(data.user.theme).toBe("blueprint");

    const cookies = res.headers.get("set-cookie") || "";
    expect(cookies).toContain("session_token=mock-jwt-token");
    expect(cookies).toContain("procal_theme=blueprint");
  });

  it("authenticates successfully using email (case-insensitive)", async () => {
    const res = await postLogin({
      username: "JOHN.ENGINEER@EXAMPLE.COM",
      password: "correct_password",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe("john_engineer");
  });

  it("authenticates successfully using identifier field", async () => {
    const res = await postLogin({
      identifier: "john.engineer@example.com",
      password: "correct_password",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe("john_engineer");
  });

  it("rejects invalid password with 401", async () => {
    const res = await postLogin({
      username: "john_engineer",
      password: "wrong_password",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid credentials");
  });

  it("rejects non-existent user with 401", async () => {
    const res = await postLogin({
      username: "unknown_user",
      password: "correct_password",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid credentials");
  });

  it("rejects disabled user with 403", async () => {
    mocks.user.disabled = true;
    const res = await postLogin({
      username: "john_engineer",
      password: "correct_password",
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Account disabled");
  });

  it("returns 400 when missing username/email or password", async () => {
    const res1 = await postLogin({ password: "some_password" });
    expect(res1.status).toBe(400);

    const res2 = await postLogin({ username: "john_engineer" });
    expect(res2.status).toBe(400);
  });

  it("updates and sets theme when a different valid theme is passed", async () => {
    mocks.update.mockResolvedValueOnce({ ...mocks.user, theme: "warm" });

    const res = await postLogin({
      username: "john_engineer",
      password: "correct_password",
      theme: "warm",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.theme).toBe("warm");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { theme: "warm" },
    });
    const cookies = res.headers.get("set-cookie") || "";
    expect(cookies).toContain("procal_theme=warm");
  });
});
