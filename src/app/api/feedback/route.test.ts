import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  dbContactRequestCreate: vi.fn(),
  sendResult: { ok: true, messageId: "test-feedback-mid" } as const,
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/notify", () => ({
  sendFeedbackNotification: vi.fn(async () => mocks.sendResult),
  __resetTransporterForTests: vi.fn(),
}));

const create = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { contactRequest: { create } },
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: "alice@example.com" };
  mocks.sendResult = { ok: true, messageId: "test-feedback-mid" } as const;
  create.mockResolvedValue({ id: "cr1" });
});

describe("POST /api/feedback", () => {
  it("rejects invalid request body or short message", async () => {
    const res1 = await post({ message: "" });
    expect(res1.status).toBe(400);

    const res2 = await post({ message: "ab" });
    expect(res2.status).toBe(400);
  });

  it("submits feedback successfully, notifies admin, and persists to DB", async () => {
    const res = await post({
      category: "Bug Report",
      subject: "Voltage Drop Error",
      message: "The voltage drop on Cable 4 exceeds 5% in calculation",
      pageUrl: "/cable-schedule",
      projectId: "proj-123",
      projectName: "Tower Alpha",
      errorDetails: "TypeError: calculation mismatch",
      systemInfo: "Chrome 120 / Windows 11",
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const { sendFeedbackNotification } = await import("@/lib/notify");
    expect(sendFeedbackNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Bug Report",
        subject: "Voltage Drop Error",
        message: "The voltage drop on Cable 4 exceeds 5% in calculation",
        pageUrl: "/cable-schedule",
        projectId: "proj-123",
        projectName: "Tower Alpha",
      })
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          status: "OPEN",
          email: "alice@example.com",
        }),
      })
    );
  });

  it("allows unauthenticated or guest feedback submissions with notification", async () => {
    mocks.user = null;
    const res = await post({
      category: "General Inquiry",
      subject: "Question about IEC standards",
      message: "How does ProCal handle ambient temperature derating?",
      email: "guest@engineer.org",
    });

    expect(res.status).toBe(201);
    const { sendFeedbackNotification } = await import("@/lib/notify");
    expect(sendFeedbackNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "General Inquiry",
        replyToEmail: "guest@engineer.org",
      })
    );
  });

  it("handles feedback submissions with an included screenshot", async () => {
    const res = await post({
      category: "Bug Report",
      subject: "SLD rendering issue",
      message: "Busbar overlaps breaker icon on high resolution display",
      screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });

    expect(res.status).toBe(201);
    const { sendFeedbackNotification } = await import("@/lib/notify");
    expect(sendFeedbackNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      })
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining("Screenshot: Attached"),
        }),
      })
    );
  });
});
