import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  floorFindUnique: vi.fn(),
  floorFindMany: vi.fn(),
  floorItemCount: vi.fn(),
  floorItemCreateMany: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    floorDesign: {
      findUnique: vi.fn(async (...args) => mocks.floorFindUnique(...args)),
      findMany: vi.fn(async (...args) => mocks.floorFindMany(...args)),
    },
    floorItem: {
      count: vi.fn(async (...args) => mocks.floorItemCount(...args)),
      createMany: vi.fn(async (...args) => mocks.floorItemCreateMany(...args)),
    },
  },
}));

async function postCopy(floorId: string, body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/floors/${floorId}/copy-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: floorId }) }
  );
}

describe("POST /api/floors/[id]/copy-items", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "proj-1" },
      memberRole: "ENGINEER",
    });
    mocks.floorItemCount.mockResolvedValue(0);
    mocks.floorItemCreateMany.mockResolvedValue({ count: 4 });
  });

  it("returns 400 when targetFloorIds is missing or empty", async () => {
    const res = await postCopy("floor-1", {});
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("targetFloorIds");
  });

  it("returns 404 if source floor does not exist", async () => {
    mocks.floorFindUnique.mockResolvedValue(null);
    const res = await postCopy("floor-none", { targetFloorIds: ["floor-2"] });
    expect(res.status).toBe(404);
  });

  it("returns 403 if project access is denied", async () => {
    mocks.floorFindUnique.mockResolvedValue({
      id: "floor-1",
      buildingId: "bldg-1",
      building: { projectId: "proj-1", project: { voltage: 400, powerFactor: 0.85 } },
      items: [{ id: "item-1", type: "APARTMENT", name: "Apt 1" }],
    });
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const res = await postCopy("floor-1", { targetFloorIds: ["floor-2"] });
    expect(res.status).toBe(403);
  });

  it("successfully bulk copies items to multiple target floors in one batch query", async () => {
    mocks.floorFindUnique.mockResolvedValue({
      id: "floor-1",
      floorNumber: 1,
      buildingId: "bldg-1",
      building: {
        projectId: "proj-1",
        project: { voltage: 400, powerFactor: 0.85 },
      },
      items: [
        {
          id: "item-1",
          type: "APARTMENT",
          name: "Apartment 101",
          apartmentTemplateId: "tpl-1",
          loadLibraryItemId: null,
          calculatedConnectedLoad: 18.5,
          calculatedMaxDemand: 14.8,
          calculatedCurrent: 25.1,
          breakerSize: "32A",
          cableSize: "6 mm²",
          cableLength: 20,
          voltageDrop: 0.1,
          installMethod: "C",
          cableInsulation: "XLPE",
          cableMaterial: "copper",
          ambientTemp: 30,
          groupingCount: 1,
          assignedPhase: 1,
          apartmentTemplate: {
            phases: 1,
            rooms: [{ connectedLoad: 18500 }],
          },
        },
        {
          id: "item-2",
          type: "SERVICE_PANEL",
          name: "Corridor DB",
          apartmentTemplateId: null,
          loadLibraryItemId: null,
          calculatedConnectedLoad: 4.5,
          calculatedMaxDemand: 4.5,
          calculatedCurrent: 6.5,
          breakerSize: "16A",
          cableSize: "2.5 mm²",
          cableLength: 15,
          voltageDrop: 0.1,
          installMethod: "C",
          cableInsulation: "XLPE",
          cableMaterial: "copper",
          ambientTemp: 30,
          groupingCount: 1,
          assignedPhase: 2,
        },
      ],
    });

    mocks.floorFindMany.mockResolvedValue([
      { id: "floor-2" },
      { id: "floor-3" },
      { id: "floor-4" },
    ]);

    const res = await postCopy("floor-1", {
      targetFloorIds: ["floor-2", "floor-3", "floor-4"],
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.copiedItemsCount).toBe(6); // 2 items × 3 floors
    expect(data.targetFloorsCount).toBe(3);

    expect(mocks.floorItemCreateMany).toHaveBeenCalledTimes(1);
    const createData = mocks.floorItemCreateMany.mock.calls[0][0].data;
    expect(createData.length).toBe(6);
    expect(createData.map((d: { floorDesignId: string }) => d.floorDesignId)).toEqual([
      "floor-2", "floor-2",
      "floor-3", "floor-3",
      "floor-4", "floor-4",
    ]);
  });
});
