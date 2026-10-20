import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProjectFromSpec,
  getProjectComplianceSummary,
  getProjectBOM,
} from "../build-project";
import type { ProjectDrawingSpec, ProjectDrawingSpecInput } from "../project-spec-schema";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    projectAuditLog: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    user: {
      update: vi.fn().mockResolvedValue({ id: "user-1", credits: 4 }),
    },
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    apartmentTemplate: {
      create: vi.fn(),
    },
    apartmentRoom: {
      create: vi.fn(),
    },
    building: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    floorDesign: {
      create: vi.fn(),
    },
    floorItem: {
      create: vi.fn(),
    },
    loadLibraryItem: {
      create: vi.fn(),
    },
    buildingLoad: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

describe("build-project service", () => {
  const testUser = {
    id: "user-eng-1",
    role: "USER",
    credits: 5,
    name: "Lead Electrical Engineer",
    username: "lead_eng",
  };

  const sampleSpec: ProjectDrawingSpecInput = {
    name: "Emerald Tower",
    country: "United Arab Emirates",
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    calculationStandard: "IEC",
    isConfirmedByUser: true,
    apartmentTemplates: [
      {
        name: "Type 2BR",
        phases: 1,
        rooms: [
          { name: "Living", type: "LIVING_ROOM", areaM2: 35, hasAc: true },
          { name: "Bed 1", type: "BEDROOM", areaM2: 20, hasAc: true },
          { name: "Special Lab", type: "OTHER", areaM2: 25, explicitLoadKva: 5.0 },
        ],
      },
    ],
    buildings: [
      {
        name: "Tower 1",
        floors: 2,
        floorAssignments: [
          { floorNumber: 1, templateName: "Type 2BR", count: 2 },
          { floorNumber: 2, templateName: "Type 2BR", count: 2 },
        ],
        buildingLoads: [
          {
            name: "Passenger Elevator",
            category: "ELEVATOR",
            powerKw: 15,
            phases: 3,
            quantity: 1,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProjectFromSpec", () => {
    it("throws 402 error when non-ADMIN user has 0 credits", async () => {
      const zeroCreditUser = { ...testUser, credits: 0 };
      await expect(createProjectFromSpec(zeroCreditUser, sampleSpec)).rejects.toMatchObject({
        message: expect.stringContaining("No credits remaining"),
        statusCode: 402,
      });
      expect(mockDb.project.create).not.toHaveBeenCalled();
    });

    it("consolidates multiple apartment templates on the same floor into a single floorDesign", async () => {
      const multiAptFloorSpec: ProjectDrawingSpecInput = {
        name: "Twin Apartment Tower",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        isConfirmedByUser: true,
        apartmentTemplates: [
          {
            name: "Apartment 1 (Upper Unit)",
            rooms: [{ name: "Living", type: "LIVING_ROOM", areaM2: 25 }],
          },
          {
            name: "Apartment 2 (Lower Unit)",
            rooms: [{ name: "Living", type: "LIVING_ROOM", areaM2: 25 }],
          },
        ],
        buildings: [
          {
            name: "Tower 1",
            floors: 1,
            floorAssignments: [
              { floorNumber: 1, templateName: "Apartment 1 (Upper Unit)", count: 1 },
              { floorNumber: 1, templateName: "Apartment 2 (Lower Unit)", count: 1 },
            ],
          },
        ],
      };

      mockDb.project.create.mockResolvedValueOnce({
        id: "proj-twin-1",
        name: "Twin Apartment Tower",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
      });

      mockDb.apartmentTemplate.create
        .mockResolvedValueOnce({ id: "tpl-1", name: "Apartment 1 (Upper Unit)" })
        .mockResolvedValueOnce({ id: "tpl-2", name: "Apartment 2 (Lower Unit)" });

      mockDb.building.create.mockResolvedValueOnce({
        id: "bldg-twin-1",
        name: "Tower 1",
        floors: 1,
      });

      mockDb.floorDesign.create.mockResolvedValueOnce({
        id: "fd-floor-1",
        floorNumber: 1,
      });

      const res = await createProjectFromSpec(testUser, multiAptFloorSpec);

      expect(res.success).toBe(true);
      // Exactly ONE floorDesign created for Floor 1
      expect(mockDb.floorDesign.create).toHaveBeenCalledTimes(1);
      expect(mockDb.floorDesign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            floorNumber: 1,
          }),
        })
      );

      // Both apartments created with the same floorDesignId
      expect(mockDb.floorItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            floorDesignId: "fd-floor-1",
            name: "Apartment 1 (Upper Unit) - 1",
          }),
        })
      );
      expect(mockDb.floorItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            floorDesignId: "fd-floor-1",
            name: "Apartment 2 (Lower Unit) - 1",
          }),
        })
      );
    });

    it("decrements 1 credit and creates project, templates, rooms, buildings, and items in transaction", async () => {
      mockDb.project.create.mockResolvedValueOnce({
        id: "proj-emerald-1",
        name: "Emerald Tower",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
      });

      mockDb.apartmentTemplate.create.mockResolvedValueOnce({
        id: "tpl-2br-1",
        name: "Type 2BR",
      });

      mockDb.building.create.mockResolvedValueOnce({
        id: "bldg-tower-1",
        name: "Tower 1",
        floors: 2,
      });

      mockDb.floorDesign.create
        .mockResolvedValueOnce({ id: "fd-1", floorNumber: 1 })
        .mockResolvedValueOnce({ id: "fd-2", floorNumber: 2 });

      mockDb.loadLibraryItem.create.mockResolvedValueOnce({
        id: "lib-elevator-1",
        name: "Passenger Elevator",
      });

      const res = await createProjectFromSpec(testUser, sampleSpec);

      expect(res.success).toBe(true);
      expect(res.projectId).toBe("proj-emerald-1");
      expect(res.projectName).toBe("Emerald Tower");
      expect(res.buildings).toHaveLength(1);
      expect(res.deepLinks.calculator).toBe("/calculator?projectId=proj-emerald-1");

      // Verify user credit decrement
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: "user-eng-1" },
        data: { credits: { decrement: 1 } },
      });

      // Verify explicitLoadKva conversion: 5 kVA * 0.85 = 4250 W
      expect(mockDb.apartmentRoom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Special Lab",
            connectedLoad: 4250,
          }),
        })
      );
    });

    it("deduplicates requests with same idempotencyKey within 60s without decrementing credit", async () => {
      const idempotencySpec: ProjectDrawingSpecInput = {
        ...sampleSpec,
        idempotencyKey: "unique-agent-request-xyz",
      };

      mockDb.projectAuditLog.findFirst.mockResolvedValueOnce({
        projectId: "existing-proj-id",
        details: JSON.stringify({ idempotencyKey: "unique-agent-request-xyz" }),
      });

      mockDb.project.findUnique.mockResolvedValueOnce({
        id: "existing-proj-id",
        name: "Emerald Tower",
        buildings: [{ id: "bldg-1", name: "Tower 1", floors: 2 }],
      });

      const res = await createProjectFromSpec(testUser, idempotencySpec);

      expect(res.projectId).toBe("existing-proj-id");
      expect(mockDb.user.update).not.toHaveBeenCalled();
      expect(mockDb.project.create).not.toHaveBeenCalled();
    });
  });

  describe("getProjectComplianceSummary", () => {
    it("computes load totals, incomer breaker sizing rule, and phase balance", async () => {
      mockDb.project.findUnique.mockResolvedValueOnce({
        id: "proj-1",
        name: "Tower Project",
        voltage: 400,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        buildings: [
          {
            id: "bldg-1",
            name: "Tower 1",
            floorDesigns: [
              {
                id: "fd-1",
                items: [
                  {
                    id: "item-1",
                    calculatedConnectedLoad: 10,
                    calculatedMaxDemand: 8,
                    calculatedCurrent: 34.8,
                  },
                ],
              },
            ],
            buildingLoads: [],
          },
        ],
        apartmentTemplates: [],
      });

      const summary = await getProjectComplianceSummary("proj-1");

      expect(summary.projectId).toBe("proj-1");
      expect(summary.totals.totalConnectedKw).toBe(10);
      expect(summary.totals.totalMaxDemandKw).toBe(8);
      expect(summary.incomer.protectionRule).toBe("Ib <= Ir <= In <= Iz verified");
      expect(summary.incomer.suggestedFrameIn).toBeGreaterThan(0);
      expect(summary.phaseBalance.phaseCurrentA).toHaveLength(3);
    });
  });

  describe("getProjectBOM", () => {
    it("aggregates switchgear and cable takeoffs", async () => {
      mockDb.project.findUnique.mockResolvedValueOnce({
        id: "proj-bom",
        name: "BOM Tower",
        buildings: [
          {
            id: "b-1",
            floorDesigns: [
              {
                id: "fd-1",
                riserBreakerSize: "160A",
                riserCableSize: "70 mm²",
                riserCableLength: 45,
                riserCableMaterial: "copper",
                items: [
                  {
                    id: "i-1",
                    breakerSize: "32A",
                    cableSize: "6 mm²",
                    cableLength: 25,
                    cableMaterial: "copper",
                  },
                  {
                    id: "i-2",
                    breakerSize: "32A",
                    cableSize: "6 mm²",
                    cableLength: 30,
                    cableMaterial: "copper",
                  },
                ],
              },
            ],
            buildingLoads: [],
          },
        ],
      });

      const bom = await getProjectBOM("proj-bom");

      expect(bom.switchgearTakeoff).toEqual(
        expect.arrayContaining([
          { category: "MCB", rating: "32A", quantity: 2 },
          { category: "MCCB", rating: "160A", quantity: 1 },
        ])
      );

      expect(bom.cablesTakeoff).toEqual(
        expect.arrayContaining([
          { size: "6 mm²", material: "copper", totalLengthM: 55, count: 2 },
          { size: "70 mm²", material: "copper", totalLengthM: 45, count: 1 },
        ])
      );
    });
  });
});
