import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  buildingFindUnique: vi.fn(),
  floorItemFindMany: vi.fn(),
  floorItemUpdate: vi.fn(),
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
    $transaction: vi.fn(async (...args) => mocks.transaction(...args)),
  },
}));

async function postRecalculate(buildingId: string) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/buildings/${buildingId}/recalculate`, {
      method: "POST",
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
  });
});
