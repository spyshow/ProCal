import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  buildingFindUnique: vi.fn(),
  buildingUpdate: vi.fn(),
  buildingDelete: vi.fn(),
  floorDesignCreateMany: vi.fn(),
  floorDesignDeleteMany: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    building: {
      findUnique: vi.fn(async (...args) => mocks.buildingFindUnique(...args)),
      update: vi.fn(async (...args) => mocks.buildingUpdate(...args)),
      delete: vi.fn(async (...args) => mocks.buildingDelete(...args)),
    },
    floorDesign: {
      createMany: vi.fn(async (...args) => mocks.floorDesignCreateMany(...args)),
      deleteMany: vi.fn(async (...args) => mocks.floorDesignDeleteMany(...args)),
    },
  },
}));

async function patchBuilding(buildingId: string, body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request(`http://localhost/api/buildings/${buildingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: buildingId }) }
  );
}

async function putBuilding(buildingId: string, body: unknown) {
  const { PUT } = await import("./route");
  return PUT(
    new Request(`http://localhost/api/buildings/${buildingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: buildingId }) }
  );
}

const validBuilding = {
  id: "bldg-1",
  name: "Building 1",
  floors: 5,
  serviceFloors: 1,
  apartmentsPerFloor: 4,
  supplyVoltage: "400V 3-Phase",
  earthingSystem: "TN-S",
  lightningProtection: false,
  mechanicalLoads: null,
  generator: null,
  transformer: null,
  incomerCableSize: null,
  incomerCableLength: null,
  incomerInstallMethod: null,
  incomerCableInsulation: null,
  incomerCableMaterial: "copper",
  incomerAmbientTemp: 30,
  incomerGroupingCount: 1,
  projectId: "proj-1",
  project: { id: "proj-1", userId: "user-1" },
};

describe("Building API /api/buildings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      user: { id: "user-1", role: "USER" },
      member: { role: "PROJECT_MANAGER" },
      project: { id: "proj-1" },
    });
    mocks.buildingFindUnique.mockResolvedValue(validBuilding);
  });

  describe("PATCH /api/buildings/[id]", () => {
    it("updates incomer cable properties successfully", async () => {
      mocks.buildingUpdate.mockResolvedValue({
        ...validBuilding,
        incomerCableSize: "6 × 600 kcmil",
        incomerInstallMethod: "F",
        incomerGroupingCount: 1,
      });

      const res = await patchBuilding("bldg-1", {
        incomerCableSize: "6 × 600 kcmil",
        incomerInstallMethod: "F",
        incomerGroupingCount: 1,
      });

      expect(res.status).toBe(200);
      expect(mocks.buildingUpdate).toHaveBeenCalledWith({
        where: { id: "bldg-1" },
        data: expect.objectContaining({
          incomerCableSize: "6 × 600 kcmil",
          incomerInstallMethod: "F",
          incomerGroupingCount: 1,
        }),
      });
    });

    it("returns 404 when building does not exist", async () => {
      mocks.buildingFindUnique.mockResolvedValue(null);

      const res = await patchBuilding("bldg-nonexistent", {
        incomerCableSize: "300 mm²",
      });

      expect(res.status).toBe(404);
      expect(mocks.buildingUpdate).not.toHaveBeenCalled();
    });

    it("returns 402 TRIAL_LIMIT when increasing floors > 2 on a trial building", async () => {
      mocks.buildingFindUnique.mockResolvedValue({
        ...validBuilding,
        floors: 1,
        serviceFloors: 0,
        project: { id: "proj-1", userId: "user-1", isTrial: true },
      });

      const res = await patchBuilding("bldg-1", { floors: 3 });

      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.code).toBe("TRIAL_LIMIT");
      expect(data.error).toContain("Free trial projects are limited to 2 levels");
      expect(mocks.buildingUpdate).not.toHaveBeenCalled();
    });

    it("returns 403 when user is QA", async () => {
      mocks.verifyProjectAccess.mockResolvedValue({
        user: { id: "qa-1", role: "USER" },
        member: { role: "QA" },
        project: { id: "proj-1" },
      });

      const res = await patchBuilding("bldg-1", {
        incomerCableSize: "300 mm²",
      });

      expect(res.status).toBe(403);
      expect(mocks.buildingUpdate).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/buildings/[id]", () => {
    it("updates full building attributes including incomer fields", async () => {
      mocks.buildingUpdate.mockResolvedValue({
        ...validBuilding,
        name: "Renamed Building",
        incomerCableSize: "4 × 500 kcmil",
      });

      const res = await putBuilding("bldg-1", {
        name: "Renamed Building",
        floors: 5,
        serviceFloors: 1,
        incomerCableSize: "4 × 500 kcmil",
      });

      expect(res.status).toBe(200);
      expect(mocks.buildingUpdate).toHaveBeenCalledWith({
        where: { id: "bldg-1" },
        data: expect.objectContaining({
          name: "Renamed Building",
          incomerCableSize: "4 × 500 kcmil",
        }),
      });
    });

    describe("Trial Project Enforcement", () => {
      const trialBuilding = {
        ...validBuilding,
        floors: 1,
        serviceFloors: 0,
        project: { id: "proj-1", userId: "user-1", isTrial: true },
      };

      beforeEach(() => {
        mocks.buildingFindUnique.mockResolvedValue(trialBuilding);
      });

      it("rejects increasing floors beyond 2 levels on a trial project", async () => {
        const res = await putBuilding("bldg-1", { floors: 3 });
        expect(res.status).toBe(402);
        const data = await res.json();
        expect(data.code).toBe("TRIAL_LIMIT");
        expect(data.error).toContain("Free trial projects are limited to 2 levels");
        expect(mocks.buildingUpdate).not.toHaveBeenCalled();
      });

      it("rejects updating serviceFloors such that floors + serviceFloors > 2", async () => {
        const res = await putBuilding("bldg-1", { serviceFloors: 2 });
        expect(res.status).toBe(402);
        const data = await res.json();
        expect(data.code).toBe("TRIAL_LIMIT");
        expect(mocks.buildingUpdate).not.toHaveBeenCalled();
      });

      it("allows updating within the 2-level cap on trial project", async () => {
        mocks.buildingUpdate.mockResolvedValue({
          ...trialBuilding,
          floors: 1,
          serviceFloors: 1,
        });

        const res = await putBuilding("bldg-1", { floors: 1, serviceFloors: 1 });
        expect(res.status).toBe(200);
        expect(mocks.buildingUpdate).toHaveBeenCalled();
      });

      it("allows updating name without changing floors on trial project", async () => {
        mocks.buildingUpdate.mockResolvedValue({
          ...trialBuilding,
          name: "Renamed Trial Tower",
        });

        const res = await putBuilding("bldg-1", { name: "Renamed Trial Tower" });
        expect(res.status).toBe(200);
        expect(mocks.buildingUpdate).toHaveBeenCalled();
      });
    });
  });
});
