import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  logProjectActivity: vi.fn(),
  floorFindUnique: vi.fn(),
  apartmentTemplateFindUnique: vi.fn(),
  floorItemCount: vi.fn(),
  floorItemCreate: vi.fn(),
  floorItemFindMany: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    floorDesign: {
      findUnique: vi.fn(async (...args) => mocks.floorFindUnique(...args)),
    },
    apartmentTemplate: {
      findUnique: vi.fn(async (...args) => mocks.apartmentTemplateFindUnique(...args)),
    },
    floorItem: {
      count: vi.fn(async (...args) => mocks.floorItemCount(...args)),
      create: vi.fn(async (...args) => mocks.floorItemCreate(...args)),
      findMany: vi.fn(async (...args) => mocks.floorItemFindMany(...args)),
    },
    $transaction: vi.fn(async (...args) => mocks.transaction(...args)),
  },
}));

async function postFloorItem(floorId: string, body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/floors/${floorId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: floorId }) }
  );
}

describe("POST /api/floors/[id]/items", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      user: { id: "u-1", name: "Engineer Bob" },
      member: { role: "ENGINEER" },
      project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
    });
    mocks.floorFindUnique.mockResolvedValue({
      id: "floor-1",
      name: "Level 1",
      buildingId: "bldg-1",
      building: {
        id: "bldg-1",
        name: "Tower A",
        projectId: "proj-1",
        project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
      },
    });
    mocks.floorItemCount.mockResolvedValue(0);
    mocks.floorItemFindMany.mockResolvedValue([]);
    mocks.transaction.mockResolvedValue([]);
  });

  it("creates a load item (service panel) and logs the activity", async () => {
    const createdItem = {
      id: "item-101",
      type: "SERVICE_PANEL",
      name: "Floor 1 Services",
      floorDesignId: "floor-1",
      calculatedConnectedLoad: 15,
      calculatedMaxDemand: 12,
      calculatedCurrent: 20.38,
      cableMaterial: "copper",
    };
    mocks.floorItemCreate.mockResolvedValue(createdItem);

    const res = await postFloorItem("floor-1", {
      type: "SERVICE_PANEL",
      name: "Floor 1 Services",
      customKw: "15",
    });

    expect(res.status).toBe(200);
    expect(mocks.floorItemCreate).toHaveBeenCalledTimes(1);
    expect(mocks.logProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        userId: "u-1",
        userName: "Engineer Bob",
        action: "CREATE",
        entityType: "LOAD",
        entityId: "item-101",
        description: expect.stringContaining('Added service panel "Floor 1 Services" to floor "Level 1" in "Tower A"'),
        details: expect.objectContaining({
          type: "SERVICE_PANEL",
          floorName: "Level 1",
          buildingName: "Tower A",
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "name", newValue: "Floor 1 Services" }),
            expect.objectContaining({ field: "connectedLoad", newValue: "15 kW" }),
          ]),
        }),
      })
    );
  });

  it("creates an apartment load item from template and logs the activity", async () => {
    mocks.apartmentTemplateFindUnique.mockResolvedValue({
      id: "tpl-1",
      name: "2BR Standard",
      phases: 3,
      rooms: [
        { id: "r1", name: "Living Room", area: 30, connectedLoad: 4000, hasAc: true },
        { id: "r2", name: "Bedroom", area: 20, connectedLoad: 2500, hasAc: true },
      ],
    });

    const createdItem = {
      id: "item-apt-1",
      type: "APARTMENT",
      name: "Apt 101",
      apartmentTemplateId: "tpl-1",
      floorDesignId: "floor-1",
      calculatedConnectedLoad: 6.5,
      calculatedMaxDemand: 6.5,
      calculatedCurrent: 11.04,
      cableMaterial: "copper",
    };
    mocks.floorItemCreate.mockResolvedValue(createdItem);

    const res = await postFloorItem("floor-1", {
      type: "APARTMENT",
      name: "Apt 101",
      apartmentTemplateId: "tpl-1",
    });

    expect(res.status).toBe(200);
    expect(mocks.logProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        action: "CREATE",
        entityType: "LOAD",
        entityId: "item-apt-1",
        description: expect.stringContaining('Added apartment "Apt 101" to floor "Level 1"'),
      })
    );
  });

  it("returns 400 if required fields are missing", async () => {
    const res = await postFloorItem("floor-1", {});
    expect(res.status).toBe(400);
    expect(mocks.logProjectActivity).not.toHaveBeenCalled();
  });
});
