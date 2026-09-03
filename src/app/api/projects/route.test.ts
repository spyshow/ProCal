import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number },
  projectCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  projectMemberCreate: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => mocks.userFindUnique()),
      update: vi.fn(async (...args) => mocks.userUpdate(...args)),
    },
    project: {
      create: vi.fn(async (...args) => mocks.projectCreate(...args)),
      findMany: vi.fn(async () => []),
    },
    projectMember: {
      create: vi.fn(async (...args) => mocks.projectMemberCreate(...args)),
    },
    $transaction: vi.fn(async (ops) => mocks.transaction(ops)),
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(),
}));

vi.mock("@/lib/project-defaults", () => ({
  seedDefaultProjectTemplates: vi.fn(),
  seedDefaultLoadLibrary: vi.fn(),
}));

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "engineer1", name: "Engineer 1", role: "ADMIN", credits: 10 };
  mocks.projectCreate.mockResolvedValue({ id: "p1", name: "Test Project" });
  mocks.projectMemberCreate.mockResolvedValue({ id: "pm1" });
});

describe("POST /api/projects - Electrical Input Validation (UI-CRIT-02)", () => {
  it("rejects request if project name is missing", async () => {
    const res = await post({ voltage: 400 });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("name is required");
  });

  it("rejects power factor > 1.0 (e.g. 1.85)", async () => {
    const res = await post({
      name: "Invalid PF Project",
      powerFactor: 1.85,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("powerFactor must be between 0.10 and 1.00");
  });

  it("rejects power factor < 0.10", async () => {
    const res = await post({
      name: "Invalid Low PF",
      powerFactor: 0.05,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("powerFactor must be between 0.10 and 1.00");
  });

  it("rejects negative or out-of-range voltage", async () => {
    const resNeg = await post({
      name: "Negative Voltage",
      voltage: -400,
    });
    expect(resNeg.status).toBe(400);
    const dataNeg = await resNeg.json();
    expect(dataNeg.error).toContain("voltage must be between 100 and 1000");

    const resTooHigh = await post({
      name: "Over Voltage",
      voltage: 1500,
    });
    expect(resTooHigh.status).toBe(400);
  });

  it("rejects out-of-range frequency (e.g. 0 Hz or 100 Hz)", async () => {
    const res = await post({
      name: "Invalid Freq",
      frequency: 0,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("frequency must be between 45 and 65");
  });

  it("accepts valid physical electrical parameters and creates project", async () => {
    const res = await post({
      name: "Valid Hospital Project",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("p1");
    expect(mocks.projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Valid Hospital Project",
          voltage: 400,
          frequency: 50,
          powerFactor: 0.85,
        }),
      })
    );
  });
});
