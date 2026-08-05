import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-handler tests run in node (default env); we mock the three modules the
// handler touches so nothing real runs. The handler is spawned fresh per call
// via a dynamic import after the mocks are wired, so beforeEach can reset state.

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  sessions: 0,
  dbUserFindFirst: vi.fn(),
  dbContactRequestCreate: vi.fn(),
  dbContactRequestFindMany: vi.fn(),
  sendResult: { ok: true, messageId: "test-mid" } as const,
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));
vi.mock("@/lib/notify", () => ({
  sendLeadNotification: vi.fn(async () => mocks.sendResult),
  __resetTransporterForTests: vi.fn(),
}));
const findFirst = vi.fn();
const create = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { contactRequest: { findFirst, findMany: mocks.dbContactRequestFindMany, create } },
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  // Next handlers receive a Web Request; body via the standard Request API.
  return POST(new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: "alice@example.com" };
  mocks.sendResult = { ok: true, messageId: "test-mid" } as const;
  findFirst.mockResolvedValue(null); // no existing OPEN by default
  create.mockResolvedValue({ id: "cr1" });
});

describe("POST /api/contact", () => {
  it("T1 happy path: 201, persists, sends once", async () => {
    const res = await post({ email: "alice@example.com", message: "I need 3 credits for a tower design" });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u1", email: "alice@example.com", status: "OPEN", requestedCredits: null,
      }),
    }));
    const { sendLeadNotification } = await import("@/lib/notify");
    expect(sendLeadNotification).toHaveBeenCalledOnce();
  });

  it("T2 send-fail-no-row: sendLeadNotification {ok:false} → 502, NO row persisted", async () => {
    mocks.sendResult = { ok: false, error: "SMTP down" } as any;
    const res = await post({ email: "alice@example.com", message: "hello" });
    expect(res.status).toBe(502);
    expect(create).not.toHaveBeenCalled(); // D4 hard merge gate — the tested invariant
  });

  it("T2b unauth → 401 (CQ-B self-auth JSON)", async () => {
    mocks.user = null;
    const res = await post({ email: "alice@example.com", message: "hello" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("T3 dedupe OPEN → 409, no send (CQ-C)", async () => {
    findFirst.mockResolvedValue({ id: "existing-cr" }); // already an OPEN lead
    const res = await post({ email: "alice@example.com", message: "hello again" });
    expect(res.status).toBe(409);
    const { sendLeadNotification } = await import("@/lib/notify");
    expect(sendLeadNotification).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("T4a bad email → 400", async () => {
    const res = await post({ email: "not-an-email", message: "hello" });
    expect(res.status).toBe(400);
  });

  it("T4b empty message → 400", async () => {
    const res = await post({ email: "alice@example.com", message: "   " });
    expect(res.status).toBe(400);
  });

  it("T5: non-integer requestedCredits coered to null, message still passes", async () => {
    const res = await post({ email: "alice@example.com", message: "need credits", requestedCredits: 2.5 });
    expect(res.status).toBe(201);
    // 2.5 is non-integer → coerced away to null, not rejected; persisted on .data
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestedCredits: null }),
    }));
  });
});
