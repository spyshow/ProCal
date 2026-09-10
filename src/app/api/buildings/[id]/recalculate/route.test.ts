import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  buildingFindUnique: vi.fn(),
  floorItemFindMany: vi.fn(),
  floorItemUpdate: vi.fn(),
  projectUpdate: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    building: {
      findUnique: vi.fn(async (...args) => mocks.buildingFindUnique(...args)),
    },
    floorItem: {
      findMany: vi.fn(async (...args) => mocks.floorItemFindMany(...args)),
      update: vi.fn(async (...args) => mocks.floorItemUpdate(...args)),
    },
    project: {
      update: vi.fn(async (...args) => mocks.projectUpdate(...args)),
    },
    $transaction: vi.fn(async (...args) => mocks.transaction(...args)),
  },
}));

async function postRecalculate(buildingId: string, body?: any) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/buildings/${buildingId}/recalculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ id: buildingId }) }
  );
}

describe("POST /api/buildings/[id]/recalculate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "proj-1" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 404 without touching auth or data when the building does not exist", async () => {
    mocks.buildingFindUnique.mockResolvedValue(null);
    const res = await postRecalculate("bldg-none");
    expect(res.status).toBe(404);
    expect(mocks.verifyProjectAccess).not.toHaveBeenCalled();
    expect(mocks.floorItemFindMany).not.toHaveBeenCalled();
  });

  it("REGRESSION (sessionless compute endpoint): rejects the request before any write when project access is denied", async () => {
    // This route sits under a middleware-excluded prefix (/api/buildings), so
    // it must self-guard. Before the fix it recalculated and WROTE demand
    // values for any building ID with no session at all.
    mocks.buildingFindUnique.mockResolvedValue({
      id: "bldg-1",
      projectId: "proj-1",
      project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
    });
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        type: "APARTMENT",
        apartmentTemplate: {
          phases: 1,
          rooms: [{ connectedLoad: 5000 }],
        },
      },
    ]);
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const res = await postRecalculate("bldg-1");
    expect(res.status).toBe(403);

    // Auth gate runs BEFORE reads/writes of item data.
    expect(mocks.floorItemFindMany).not.toHaveBeenCalled();
    expect(mocks.floorItemUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recalculates apartment demands with the post-insert diversity count", async () => {
    mocks.buildingFindUnique.mockResolvedValue({
      id: "bldg-1",
      projectId: "proj-1",
      project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
    });
    // Two apartments exist BEFORE this building's seed created them; the
    // recalculation uses the full count (2 → factor 0.8).
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        type: "APARTMENT",
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 4000 }, { connectedLoad: 6000 }] },
      },
      {
        id: "item-2",
        type: "APARTMENT",
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 10000 }] },
      },
    ]);
    mocks.floorItemUpdate.mockResolvedValue({});
    mocks.transaction.mockResolvedValue([]);

    const res = await postRecalculate("bldg-1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.updated).toBe(2);
    expect(data.diversityFactor).toBe(0.8); // getApartmentDiversityFactor(2)

    // 10 kW connected × 0.8 = 8 kW → I = 8/(√3·0.4·0.85) ≈ 13.6 A stored rounded.
    expect(mocks.floorItemUpdate).toHaveBeenCalledTimes(2);
    const [firstUpdate] = mocks.floorItemUpdate.mock.calls[0];
    expect(firstUpdate.where).toEqual({ id: "item-1" });
    expect(firstUpdate.data.calculatedMaxDemand).toBeCloseTo(8, 5);

    // The recalculation stamps the project with the current engine version.
    expect(mocks.projectUpdate).toHaveBeenCalledTimes(1);
    const [projectUpdate] = mocks.projectUpdate.mock.calls[0];
    expect(projectUpdate.where).toEqual({ id: "proj-1" });
    expect(typeof projectUpdate.data.engineVersion).toBe("string");
    expect(projectUpdate.data.engineVersion.length).toBeGreaterThan(0);
  });

  it("clears undersized apartment breakers that cannot carry connected load", async () => {
    mocks.buildingFindUnique.mockResolvedValue({
      id: "bldg-1",
      projectId: "proj-1",
      project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
    });
    // 10 kW 1-phase apartment has connected design current = 10 / (0.23 * 0.85) = 51.15 A.
    // An apartment breaker of 16A or 25A is dangerously undersized (violates Ib <= In).
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: "item-undersized",
        type: "APARTMENT",
        breakerSize: "16A",
        cableSize: "2.5 mm²",
        voltageDrop: 0.1,
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 10000 }] },
      },
      {
        id: "item-compliant",
        type: "APARTMENT",
        breakerSize: "63A",
        cableSize: "16 mm²",
        voltageDrop: 1.2,
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 10000 }] },
      },
    ]);
    mocks.floorItemUpdate.mockResolvedValue({});
    mocks.transaction.mockResolvedValue([]);

    const res = await postRecalculate("bldg-1");
    expect(res.status).toBe(200);

    const [firstCall, secondCall] = mocks.floorItemUpdate.mock.calls;
    expect(firstCall[0].where).toEqual({ id: "item-undersized" });
    expect(firstCall[0].data.breakerSize).toBeNull();
    expect(firstCall[0].data.cableSize).toBeNull();
    expect(firstCall[0].data.voltageDrop).toBeNull();

    expect(secondCall[0].where).toEqual({ id: "item-compliant" });
    expect(secondCall[0].data.breakerSize).toBeUndefined();
    expect(secondCall[0].data.cableSize).toBeUndefined();
    expect(secondCall[0].data.voltageDrop).toBeUndefined();
  });

  it("resets sizing and voltage drop when resetSizing is requested", async () => {
    mocks.buildingFindUnique.mockResolvedValue({
      id: "bldg-1",
      projectId: "proj-1",
      project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
    });
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        type: "APARTMENT",
        breakerSize: "63A",
        cableSize: "16 mm²",
        voltageDrop: 1.5,
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 10000 }] },
      },
    ]);
    mocks.floorItemUpdate.mockResolvedValue({});
    mocks.transaction.mockResolvedValue([]);

    const res = await postRecalculate("bldg-1", { resetSizing: true });
    expect(res.status).toBe(200);

    const [updateCall] = mocks.floorItemUpdate.mock.calls;
    expect(updateCall[0].where).toEqual({ id: "item-1" });
    expect(updateCall[0].data.breakerSize).toBeNull();
    expect(updateCall[0].data.cableSize).toBeNull();
    expect(updateCall[0].data.voltageDrop).toBeNull();
  });

  it("applies uniform project-wide residential diversity factor across multiple towers (Fix 2)", async () => {
    // Multi-building project: Tower 1 has 32 apartments, Tower 2 has 18 apartments -> total 50.
    // When Tower 2 (with 18 apartments) is recalculated, it should use the uniform project-wide
    // residential count (50 -> factor 0.50), rather than its isolated count (18 -> factor 0.55).
    mocks.buildingFindUnique.mockResolvedValue({
      id: "bldg-tower-2",
      name: "Residential Tower 2",
      projectId: "proj-multi",
      project: {
        id: "proj-multi",
        voltage: 400,
        powerFactor: 0.85,
        buildings: [
          {
            id: "bldg-tower-1",
            name: "Residential Tower 1",
            floorDesigns: [{ items: Array.from({ length: 32 }, () => ({ type: "APARTMENT" })) }],
          },
          {
            id: "bldg-tower-2",
            name: "Residential Tower 2",
            floorDesigns: [{ items: Array.from({ length: 18 }, () => ({ type: "APARTMENT" })) }],
          },
        ],
      },
    });
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: "item-t2-1",
        type: "APARTMENT",
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 10000 }] },
      },
    ]);
    mocks.floorItemUpdate.mockResolvedValue({});
    mocks.transaction.mockResolvedValue([]);

    const res = await postRecalculate("bldg-tower-2");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // 50 total apartments -> getBuildingDiversityFactor(50) = 0.50 (instead of isolated 0.55)
    expect(data.diversityFactor).toBe(0.5);
    const [updateCall] = mocks.floorItemUpdate.mock.calls;
    expect(updateCall[0].data.calculatedMaxDemand).toBe(5); // 10 kW * 0.50
  });
});
