import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// T8 — GET /api/admin/leads. requireAdmin returns the admin user here or a
// NextResponse (401/403) for the failure cases.

let gateResult: unknown = null;
const findMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  // requireAdmin returns either the admin user or a NextResponse; the handler
  // checks `instanceof NextResponse`. We simulate all three branches.
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: { contactRequest: { findMany } },
}));

const ADMIN = { id: "a1", username: "boss", name: "Boss", role: "ADMIN", credits: 99, email: "boss@procal.io" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    { id: "cr1", status: "OPEN", message: "need credits", user: { id: "u1", username: "alice", name: "Alice", email: "alice@e.com" } },
  ]);
});

async function get() {
  const { GET } = await import("./route");
  return GET();
}

describe("GET /api/admin/leads", () => {
  it("T8 admin: 200 + leads with nested user", async () => {
    gateResult = ADMIN;
    const res = await get();
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { user: { select: { id: true, username: true, name: true, email: true } } },
    }));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].user.username).toBe("alice");
  });

  it("T8b 401 when unauthed", async () => {
    gateResult = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const res = await get();
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("T8c 403 when non-admin", async () => {
    gateResult = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const res = await get();
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});
