import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

let gateResult: unknown = null;
const findMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => gateResult),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany,
      findUnique,
      create,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "hashed_password"),
  },
}));

const ADMIN = { id: "a1", username: "boss", name: "Boss", role: "ADMIN", credits: 99, email: "boss@procal.io" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  gateResult = ADMIN;
  findUnique.mockResolvedValue(null);
  create.mockImplementation(async ({ data }) => ({
    id: "u-new",
    username: data.username,
    name: data.name,
    email: data.email,
    role: data.role,
    credits: data.credits,
    disabled: false,
    createdAt: new Date().toISOString(),
    _count: { projects: 0 },
  }));
  findMany.mockResolvedValue([
    {
      id: "u1",
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
      role: "USER",
      credits: 10,
      disabled: false,
      createdAt: new Date().toISOString(),
      _count: { projects: 2 },
    },
  ]);
});

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

async function get(search = "") {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/admin/users${search ? `?search=${search}` : ""}`));
}

describe("POST /api/admin/users", () => {
  it("creates user with email and returns 200", async () => {
    const res = await post({
      username: "engineer1",
      name: "Engineer One",
      email: "engineer1@example.com",
      password: "password123",
      role: "USER",
      credits: 5,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("engineer1@example.com");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        username: "engineer1",
        name: "Engineer One",
        email: "engineer1@example.com",
      }),
    }));
  });

  it("rejects invalid email format", async () => {
    const res = await post({
      username: "engineer1",
      name: "Engineer One",
      email: "invalid-email-address",
      password: "password123",
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid email/i);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/users", () => {
  it("returns users including email", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@example.com");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        email: true,
      }),
    }));
  });
});
