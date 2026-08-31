import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

let gateResult: unknown = null;
const findMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
const projectCount = vi.fn();

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
    project: {
      count: projectCount,
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
  projectCount.mockResolvedValue(5);
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
      projects: [{ id: "p1" }],
      projectMembers: [{ projectId: "p1" }, { projectId: "p2" }],
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
  it("returns users including email and correctly calculates distinct projects", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].email).toBe("alice@example.com");
    // alice has 1 owned (p1) and 2 member (p1, p2) -> total distinct: 2
    expect(data[0]._count.projects).toBe(2);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        email: true,
        projects: { select: { id: true } },
        projectMembers: { select: { projectId: true } },
      }),
    }));
  });

  it("calculates distinct owned and member projects for ADMIN users as well", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "admin-1",
        username: "adminuser",
        name: "Admin User",
        email: "admin@example.com",
        role: "ADMIN",
        credits: 99,
        disabled: false,
        createdAt: new Date().toISOString(),
        projects: [{ id: "p1" }, { id: "p2" }],
        projectMembers: [],
      },
    ]);

    const res = await get();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0]._count.projects).toBe(2);
  });
});
