import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

let gateResult: unknown = null;
const update = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update,
    },
  },
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
    new Request(`http://localhost/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

describe("PATCH /api/admin/users/[id]", () => {
  it("updates user email and name successfully", async () => {
    update.mockResolvedValue({
      id: "u1",
      username: "alice",
      name: "Alice Updated",
      email: "alice.updated@example.com",
      role: "USER",
      credits: 10,
      disabled: false,
    });

    const res = await patch("u1", {
      name: "Alice Updated",
      email: "alice.updated@example.com",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("alice.updated@example.com");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({
        name: "Alice Updated",
        email: "alice.updated@example.com",
      }),
    }));
  });

  it("allows clearing email to null", async () => {
    update.mockResolvedValue({
      id: "u1",
      username: "alice",
      name: "Alice",
      email: null,
      role: "USER",
      credits: 10,
      disabled: false,
    });

    const res = await patch("u1", { email: "" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({ email: null }),
    }));
  });

  it("rejects invalid email format", async () => {
    const res = await patch("u1", { email: "invalid-email" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
  });
});
