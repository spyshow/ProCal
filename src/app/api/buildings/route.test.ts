import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  authResult: null as any,
  buildingCount: vi.fn(),
  buildingCreate: vi.fn(),
  floorDesignCreateMany: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async () => mocks.authResult),
}));

vi.mock("@/lib/db", () => ({
  db: {
    building: {
      count: vi.fn(async (...args) => mocks.buildingCount(...args)),
      create: vi.fn(async (...args) => mocks.buildingCreate(...args)),
    },
    floorDesign: {
      createMany: vi.fn(async (...args) => mocks.floorDesignCreateMany(...args)),
    },
  },
}));

async function postBuilding(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.authResult = {
    user: { id: "u1", role: "USER", credits: 5 },
    member: { role: "PROJECT_MANAGER" },
    project: { id: "p1", isTrial: false },
  };
  mocks.buildingCount.mockResolvedValue(0);
  mocks.buildingCreate.mockImplementation(async ({ data }: any) => ({
    id: "b1",
    ...data,
  }));
  mocks.floorDesignCreateMany.mockResolvedValue({ count: 2 });
});

describe("POST /api/buildings", () => {
  it("rejects when required fields are missing", async () => {
    const res = await postBuilding({ projectId: "p1" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("propagates project access denial", async () => {
    mocks.authResult = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const res = await postBuilding({ projectId: "p1", name: "Tower 1", floors: 2 });
    expect(res.status).toBe(401);
  });

  describe("Trial Project Enforcement", () => {
    beforeEach(() => {
      mocks.authResult.project.isTrial = true;
    });

    it("rejects creating a second building on a trial project", async () => {
      mocks.buildingCount.mockResolvedValue(1); // already 1 building exists

      const res = await postBuilding({ projectId: "p1", name: "Tower 2", floors: 1 });
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.code).toBe("TRIAL_LIMIT");
      expect(data.error).toContain("Free trial projects are limited to 1 building");
      expect(mocks.buildingCreate).not.toHaveBeenCalled();
    });

    it("rejects creating a building with > 2 floors", async () => {
      mocks.buildingCount.mockResolvedValue(0);

      const res = await postBuilding({ projectId: "p1", name: "Tower 1", floors: 3 });
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.code).toBe("TRIAL_LIMIT");
      expect(data.error).toContain("Free trial projects are limited to 2 levels");
      expect(mocks.buildingCreate).not.toHaveBeenCalled();
    });

    it("rejects when floors + serviceFloors > 2", async () => {
      mocks.buildingCount.mockResolvedValue(0);

      const res = await postBuilding({ projectId: "p1", name: "Tower 1", floors: 1, serviceFloors: 2 });
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.code).toBe("TRIAL_LIMIT");
      expect(data.error).toContain("Free trial projects are limited to 2 levels");
      expect(mocks.buildingCreate).not.toHaveBeenCalled();
    });

    it("allows creating 1 building with 2 floors total on trial project", async () => {
      mocks.buildingCount.mockResolvedValue(0);

      const res = await postBuilding({ projectId: "p1", name: "Tower 1", floors: 2, serviceFloors: 0 });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("b1");
      expect(mocks.buildingCreate).toHaveBeenCalled();
      expect(mocks.floorDesignCreateMany).toHaveBeenCalledWith({
        data: [
          { floorNumber: 1, buildingId: "b1" },
          { floorNumber: 2, buildingId: "b1" },
        ],
      });
    });

    it("allows creating 1 building with 1 residential floor + 1 service floor", async () => {
      mocks.buildingCount.mockResolvedValue(0);

      const res = await postBuilding({ projectId: "p1", name: "Tower 1", floors: 1, serviceFloors: 1 });
      expect(res.status).toBe(200);
      expect(mocks.buildingCreate).toHaveBeenCalled();
    });
  });

  describe("Non-Trial (Standard) Project", () => {
    it("allows multiple buildings and unlimited floors", async () => {
      mocks.authResult.project.isTrial = false;
      mocks.buildingCount.mockResolvedValue(4);

      const res = await postBuilding({ projectId: "p1", name: "Tower 5", floors: 25, serviceFloors: 3 });
      expect(res.status).toBe(200);
      expect(mocks.buildingCreate).toHaveBeenCalled();
    });
  });
});
