import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// T6-T7 — PATCH /api/admin/leads/[id] (close/reopen). requireAdmin gates it;
// the handler allow-lists status and stamps closedAt on CLOSED, clears on OPEN.

let gateResult: unknown = null;
const update = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: { contactRequest: { update } },
}));

const ADMIN = { id: "a1", username: "boss", name: "Boss", role: "ADMIN", credits: 99, email: "boss@procal.io" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  gateResult = ADMIN;
});

async function patch(id: string, body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request(`http://localhost/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as any,
  );
}

describe("PATCH /api/admin/leads/[id]", () => {
  it("T6 close happy: CLOSED stamps closedAt", async () => {
    update.mockResolvedValue({ id: "cr1", status: "CLOSED", closedAt: new Date() });
    const res = await patch("cr1", { status: "CLOSED" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cr1" },
      data: expect.objectContaining({ status: "CLOSED", closedAt: expect.any(Date) }),
    }));
  });

  it("T6b reopen: OPEN clears closedAt to null", async () => {
    update.mockResolvedValue({ id: "cr1", status: "OPEN", closedAt: null });
    const res = await patch("cr1", { status: "OPEN" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "OPEN", closedAt: null }),
    }));
  });

  it("T6c bad status → 400", async () => {
    const res = await patch("cr1", { status: "BOGUS" });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("T7a 401 when unauthed", async () => {
    gateResult = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const res = await patch("cr1", { status: "CLOSED" });
    expect(res.status).toBe(401);
  });

  it("T7b 403 when non-admin", async () => {
    gateResult = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const res = await patch("cr1", { status: "CLOSED" });
    expect(res.status).toBe(403);
  });
});
