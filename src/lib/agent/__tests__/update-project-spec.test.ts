import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProjectSpec } from "../build-project";
import { UpdateProjectSpecSchema } from "../project-spec-schema";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    project: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    apartmentTemplate: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    apartmentRoom: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    building: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    floorDesign: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    floorItem: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    loadLibraryItem: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    buildingLoad: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    projectAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

describe("updateProjectSpec & UpdateProjectSpecSchema", () => {
  const testUser = {
    id: "user-eng-1",
    role: "USER",
    credits: 5,
    name: "Lead Electrical Engineer",
    username: "lead_eng",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("requires projectId", () => {
      const res = UpdateProjectSpecSchema.safeParse({});
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].path).toContain("projectId");
      }
    });

    it("accepts valid partial updates", () => {
      const valid = {
        projectId: "proj-123",
        voltage: 380,
        resetSizing: false,
        apartmentTemplates: [
          {
            name: "Type A",
            rooms: [{ name: "Living", type: "LIVING_ROOM", areaM2: 30 }],
          },
        ],
      };
      const res = UpdateProjectSpecSchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.projectId).toBe("proj-123");
        expect(res.data.voltage).toBe(380);
        expect(res.data.resetSizing).toBe(false);
      }
    });

    it("defaults resetSizing to true when omitted", () => {
      const res = UpdateProjectSpecSchema.safeParse({ projectId: "proj-abc" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.resetSizing).toBe(true);
      }
    });

    it("rejects apartment template updates with non-half-step room areas like 19.1", () => {
      const invalid = {
        projectId: "proj-123",
        apartmentTemplates: [
          {
            name: "Type A",
            rooms: [{ name: "Reception", areaM2: 19.1 }],
          },
        ],
      };
      const res = UpdateProjectSpecSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message.includes("must be an integer or end in .5"))).toBe(true);
      }
    });
  });

  describe("updateProjectSpec Service", () => {
    it("throws when project is not found", async () => {
      mockDb.project.findUnique.mockResolvedValue(null);

      await expect(
        updateProjectSpec(testUser, { projectId: "non-existent" })
      ).rejects.toThrow("Project not found: non-existent");
    });

    it("throws 403 when user is neither project owner nor ADMIN", async () => {
      mockDb.project.findUnique.mockResolvedValue({
        id: "proj-other",
        userId: "different-user-id",
        name: "Restricted Project",
        buildings: [],
        apartmentTemplates: [],
      });

      await expect(
        updateProjectSpec(testUser, { projectId: "proj-other" })
      ).rejects.toMatchObject({
        message: expect.stringContaining("Unauthorized to modify this project"),
        statusCode: 403,
      });
    });

    it("updates electrical parameters and does NOT deduct credits", async () => {
      const existingProject = {
        id: "proj-param-1",
        userId: testUser.id,
        name: "Emerald Tower",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        buildings: [],
        apartmentTemplates: [],
      };

      mockDb.project.findUnique.mockResolvedValue(existingProject);

      const res = await updateProjectSpec(testUser, {
        projectId: "proj-param-1",
        voltage: 380,
        powerFactor: 0.9,
      });

      expect(res.success).toBe(true);
      expect(res.projectId).toBe("proj-param-1");
      // Credits must NEVER be deducted for in-place corrections
      expect(mockDb.user.update).not.toHaveBeenCalled();

      expect(mockDb.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "proj-param-1" },
          data: expect.objectContaining({
            voltage: 380,
            powerFactor: 0.9,
          }),
        })
      );
    });

    it("upserts apartment templates: updates existing room schedule and calculates connected kW", async () => {
      const existingProject = {
        id: "proj-tpl-1",
        userId: testUser.id,
        name: "Skyline Tower",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        apartmentTemplates: [
          {
            id: "tpl-1",
            name: "Type 1BR",
            phases: 1,
            connectedLoadKw: 8.5,
            rooms: [
              { id: "room-1", name: "Living", type: "LIVING_ROOM", areaM2: 25 },
            ],
          },
        ],
        buildings: [],
      };

      mockDb.project.findUnique.mockResolvedValue(existingProject);

      const res = await updateProjectSpec(testUser, {
        projectId: "proj-tpl-1",
        apartmentTemplates: [
          {
            name: "Type 1BR",
            rooms: [
              { name: "Living Extended", type: "LIVING_ROOM", areaM2: 40, hasAc: true },
              { name: "Master Bed", type: "BEDROOM", areaM2: 20, hasAc: true },
            ],
          },
        ],
      });

      expect(res.success).toBe(true);
      // Verify existing rooms deleted and recreated with updated values
      expect(mockDb.apartmentRoom.deleteMany).toHaveBeenCalledWith({
        where: { templateId: "tpl-1" },
      });
      expect(mockDb.apartmentRoom.create).toHaveBeenCalledTimes(2);
      expect(mockDb.apartmentTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tpl-1" },
          data: expect.objectContaining({
            phases: 1,
          }),
        })
      );
    });

    it("upserts buildings: updates floor counts, floor items, and mechanical loads", async () => {
      const existingProject = {
        id: "proj-bldg-1",
        userId: testUser.id,
        name: "Marina Residences",
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        apartmentTemplates: [
          { id: "tpl-2br", name: "2-Bed", phases: 1, connectedLoadKw: 12 },
        ],
        buildings: [
          {
            id: "bldg-1",
            name: "Block A",
            floors: 2,
            floorDesigns: [
              {
                id: "fd-1",
                floorNumber: 1,
                items: [
                  { id: "item-1", name: "Unit 101", apartmentTemplateId: "tpl-2br" },
                ],
              },
            ],
            buildingLoads: [],
          },
        ],
      };

      mockDb.project.findUnique.mockResolvedValue(existingProject);
      mockDb.loadLibraryItem.create.mockResolvedValueOnce({ id: "lib-chiller-1", name: "Rooftop Chiller" });

      const res = await updateProjectSpec(testUser, {
        projectId: "proj-bldg-1",
        buildings: [
          {
            name: "Block A",
            floors: 3,
            floorAssignments: [
              { floorNumber: 1, templateName: "2-Bed", count: 3 },
            ],
            buildingLoads: [
              {
                name: "Rooftop Chiller",
                category: "HVAC",
                powerKw: 45,
                phases: 3,
                quantity: 1,
              },
            ],
          },
        ],
      });

      expect(res.success).toBe(true);
      // Floor items on floor 1 were updated
      expect(mockDb.floorItem.deleteMany).toHaveBeenCalledWith({
        where: { floorDesignId: "fd-1" },
      });
      expect(mockDb.floorItem.create).toHaveBeenCalledTimes(3);
      // Chiller was attached to building
      expect(mockDb.buildingLoad.create).toHaveBeenCalled();
    });

    it("throws 402 when a trial project specifies 2 buildings (even with 1 existing building)", async () => {
      mockDb.project.findUnique.mockResolvedValue({
        id: "proj-trial-1",
        userId: testUser.id,
        name: "Trial Project",
        isTrial: true,
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        apartmentTemplates: [],
        buildings: [
          {
            id: "bldg-1",
            name: "Block A",
            floors: 1,
            serviceFloors: 0,
            floorDesigns: [],
            buildingLoads: [],
          },
        ],
      });

      await expect(
        updateProjectSpec(testUser, {
          projectId: "proj-trial-1",
          buildings: [
            { name: "Block A", floors: 1 },
            { name: "Block B", floors: 1 },
          ],
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining("Free trial projects are limited to 1 building"),
        statusCode: 402,
      });
    });

    it("throws 402 when a trial project specifies floors: 2 while existing building has serviceFloors: 1", async () => {
      mockDb.project.findUnique.mockResolvedValue({
        id: "proj-trial-2",
        userId: testUser.id,
        name: "Trial Project",
        isTrial: true,
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        apartmentTemplates: [],
        buildings: [
          {
            id: "bldg-1",
            name: "Block A",
            floors: 1,
            serviceFloors: 1,
            floorDesigns: [],
            buildingLoads: [],
          },
        ],
      });

      await expect(
        updateProjectSpec(testUser, {
          projectId: "proj-trial-2",
          buildings: [{ name: "Block A", floors: 2 }],
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining("Free trial projects are limited to 2 levels"),
        statusCode: 402,
      });
    });

    it("throws 402 when a trial project specifies a floorAssignment with floorNumber > TRIAL_MAX_LEVELS", async () => {
      mockDb.project.findUnique.mockResolvedValue({
        id: "proj-trial-3",
        userId: testUser.id,
        name: "Trial Project",
        isTrial: true,
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
        apartmentTemplates: [{ id: "tpl-a", name: "Type A", phases: 1, rooms: [] }],
        buildings: [
          {
            id: "bldg-1",
            name: "Block A",
            floors: 2,
            serviceFloors: 0,
            floorDesigns: [],
            buildingLoads: [],
          },
        ],
      });

      await expect(
        updateProjectSpec(testUser, {
          projectId: "proj-trial-3",
          buildings: [
            {
              name: "Block A",
              floors: 2,
              floorAssignments: [{ floorNumber: 3, templateName: "Type A", count: 1 }],
            },
          ],
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining("Free trial projects are limited to 2 levels"),
        statusCode: 402,
      });
    });
  });
});
