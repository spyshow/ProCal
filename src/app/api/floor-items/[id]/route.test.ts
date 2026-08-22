import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  floorItemFindUnique: vi.fn(),
  floorItemFindMany: vi.fn(),
  floorItemUpdate: vi.fn(),
  floorItemDelete: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    floorItem: {
      findUnique: vi.fn(async (...args) => mocks.floorItemFindUnique(...args)),
      findMany: vi.fn(async (...args) => mocks.floorItemFindMany(...args)),
      update: vi.fn(async (...args) => mocks.floorItemUpdate(...args)),
      delete: vi.fn(async (...args) => mocks.floorItemDelete(...args)),
    },
    $transaction: vi.fn(async (...args) => mocks.transaction(...args)),
  },
}));

async function patchFloorItem(id: string, body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request(`http://localhost/api/floor-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

async function deleteFloorItem(id: string) {
  const { DELETE } = await import("./route");
  return DELETE(
    new Request(`http://localhost/api/floor-items/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("Floor Items API /api/floor-items/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "proj-1" },
      memberRole: "ENGINEER",
    });
  });

  describe("PATCH /api/floor-items/[id]", () => {
    it("returns 404 when floor item not found", async () => {
      mocks.floorItemFindUnique.mockResolvedValue(null);
      const res = await patchFloorItem("item-none", { cableLength: 25 });
      expect(res.status).toBe(404);
    });

    it("returns 403 when project access is denied", async () => {
      mocks.floorItemFindUnique.mockResolvedValue({
        id: "item-1",
        floorDesign: {
          building: { projectId: "proj-1", project: { id: "proj-1" } },
        },
      });
      mocks.verifyProjectAccess.mockResolvedValue(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
      const res = await patchFloorItem("item-1", { cableLength: 25 });
      expect(res.status).toBe(403);
    });

    it("updates item properties successfully", async () => {
      mocks.floorItemFindUnique.mockResolvedValue({
        id: "item-1",
        floorDesign: {
          building: { projectId: "proj-1", project: { id: "proj-1" } },
        },
      });
      mocks.floorItemUpdate.mockResolvedValue({ id: "item-1", cableLength: 30 });

      const res = await patchFloorItem("item-1", { cableLength: 30, assignedPhase: "2" });
      expect(res.status).toBe(200);
      expect(mocks.floorItemUpdate).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: expect.objectContaining({
          cableLength: 30,
          assignedPhase: 2,
        }),
      });
    });
  });

  describe("DELETE /api/floor-items/[id] - Diversity Factor (Issue 6)", () => {
    it("returns 404 when item not found", async () => {
      mocks.floorItemFindUnique.mockResolvedValue(null);
      const res = await deleteFloorItem("item-none");
      expect(res.status).toBe(404);
    });

    it("deletes non-apartment items directly without diversity recalculation", async () => {
      mocks.floorItemFindUnique.mockResolvedValue({
        id: "item-1",
        type: "SERVICE_PANEL",
        floorDesign: {
          building: { projectId: "proj-1", project: { id: "proj-1" } },
        },
      });
      mocks.floorItemDelete.mockResolvedValue({ id: "item-1" });

      const res = await deleteFloorItem("item-1");
      expect(res.status).toBe(200);
      expect(mocks.floorItemDelete).toHaveBeenCalledWith({ where: { id: "item-1" } });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("recalculates remaining apartments with new diversity factor when an apartment is deleted", async () => {
      mocks.floorItemFindUnique.mockResolvedValue({
        id: "item-del",
        type: "APARTMENT",
        floorDesign: {
          buildingId: "bldg-1",
          building: {
            projectId: "proj-1",
            project: { id: "proj-1", voltage: 400, powerFactor: 0.85 },
          },
        },
      });

      // 2 apartments remain after deletion -> factor becomes 0.8 (count = 2)
      mocks.floorItemFindMany.mockResolvedValue([
        {
          id: "item-remain-1",
          calculatedConnectedLoad: 10,
          apartmentTemplate: { phases: 1 },
        },
        {
          id: "item-remain-2",
          calculatedConnectedLoad: 10,
          apartmentTemplate: { phases: 1 },
        },
      ]);
      mocks.floorItemDelete.mockReturnValue("del-op");
      mocks.floorItemUpdate.mockReturnValue("update-op");
      mocks.transaction.mockResolvedValue([]);

      const res = await deleteFloorItem("item-del");
      expect(res.status).toBe(200);
      expect(mocks.transaction).toHaveBeenCalledTimes(1);

      // Verify that remaining apartments are updated with factor 0.8:
      // maxDemand = 10 * 0.8 = 8.0 kW
      expect(mocks.floorItemUpdate).toHaveBeenCalledTimes(2);
      const firstCall = mocks.floorItemUpdate.mock.calls[0][0];
      expect(firstCall.where).toEqual({ id: "item-remain-1" });
      expect(firstCall.data.calculatedMaxDemand).toBe(8.0);
    });
  });
});
