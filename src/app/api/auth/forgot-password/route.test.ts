import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  findFirst: vi.fn(),
  sendPasswordResetNotification: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(async (...args) => mocks.findFirst(...args)),
    },
  },
}));

vi.mock("@/lib/notify", () => ({
  sendPasswordResetNotification: vi.fn(async (...args) => mocks.sendPasswordResetNotification(...args)),
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sendPasswordResetNotification.mockResolvedValue({ ok: true, messageId: "mock-msg-123" });
  });

  it("returns 400 if identifier is empty or missing", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns generic success even if user not found (no enumeration)", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await post({ identifier: "unknown_user" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mocks.sendPasswordResetNotification).not.toHaveBeenCalled();
  });

  it("returns generic success if user has no email address", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "u-1",
      username: "no_email_user",
      name: "No Email",
      email: null,
      disabled: false,
    });
    const res = await post({ identifier: "no_email_user" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mocks.sendPasswordResetNotification).not.toHaveBeenCalled();
  });

  it("generates a reset token and sends notification when valid user exists", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "u-valid",
      username: "engineer_ahmad",
      name: "Ahmad Engineer",
      email: "ahmad@example.com",
      disabled: false,
    });

    const res = await post({ identifier: "ahmad@example.com" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mocks.sendPasswordResetNotification).toHaveBeenCalledTimes(1);
    const callArgs = mocks.sendPasswordResetNotification.mock.calls[0][0];
    expect(callArgs.toEmail).toBe("ahmad@example.com");
    expect(callArgs.username).toBe("engineer_ahmad");
    expect(callArgs.resetUrl).toContain("/reset-password?token=");
  });
});
