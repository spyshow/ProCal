import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// T6-T7 — PATCH /api/admin/leads/[id] (close/reopen). requireAdmin gates it;
// the handler allow-lists status and stamps closedAt on CLOSED, clears on OPEN.

let gateResult: unknown = null;
const update = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: { contactRequest: { update, delete: remove } },
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
    { params: Promise.resolve({ id }) }
  );
}

async function del(id: string) {
  const { DELETE } = await import("./route");
  return DELETE(
    new Request(`http://localhost/api/admin/leads/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) }
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

describe("DELETE /api/admin/leads/[id]", () => {
  it("T7c 401 when unauthed", async () => {
    gateResult = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const res = await del("cr1");
    expect(res.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it("T7d 403 when non-admin", async () => {
    gateResult = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const res = await del("cr1");
    expect(res.status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the lead and returns ok", async () => {
    remove.mockResolvedValue({ id: "cr1" });
    const res = await del("cr1");
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith({ where: { id: "cr1" } });
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("404 when the lead does not exist", async () => {
    remove.mockRejectedValue(Object.assign(new Error("P2025"), { code: "P2025" }));
    const res = await del("cr1");
    expect(res.status).toBe(404);
  });
});
