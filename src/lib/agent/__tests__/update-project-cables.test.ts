import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProjectCables, checkProjectSelectivity } from "../build-project";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    project: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    building: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    floorDesign: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    floorItem: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    buildingLoad: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    breakerSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    equipmentCatalog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/calculations/recalculate-project", () => ({
  recalculateProjectBuildings: vi.fn().mockResolvedValue([]),
}));

describe("updateProjectCables and checkProjectSelectivity", () => {
  const user = { id: "user-1", role: "ENGINEER" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates defaults and circuit lengths, re-calculating cables and voltage drops", async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: "proj-1",
      userId: "user-1",
      name: "Al-Noor Tower",
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      preferredManufacturer: "ABB",
      maxVoltageDropPower: 5,
      buildings: [
        {
          id: "b-1",
          name: "Main Tower",
          incomerCableLength: 15,
          incomerCableMaterial: "copper",
          incomerCableInsulation: "XLPE",
          floorDesigns: [
            {
              id: "fd-1",
              floorNumber: 1,
              riserCableLength: 10,
              items: [
                {
                  id: "item-1",
                  name: "Apartment 101",
                  type: "APARTMENT",
                  calculatedCurrent: 32,
                  calculatedConnectedLoad: 15,
                  calculatedMaxDemand: 12,
                  cableLength: 20,
                  apartmentTemplate: { phases: 1 },
                },
              ],
            },
          ],
          buildingLoads: [
            {
              id: "bl-1",
              quantity: 1,
              cableLength: 25,
              loadLibraryItem: {
                id: "lib-1",
                name: "Passenger Elevator",
                power: 11,
                phase: 3,
                powerFactor: 0.85,
              },
            },
          ],
        },
      ],
      apartmentTemplates: [],
    });

    const res = await updateProjectCables(user, {
      projectId: "proj-1",
      defaults: {
        cableMaterial: "copper",
        cableInsulation: "XLPE",
        installationMethod: "C",
        ambientTemp: 45,
        groupingCount: 2,
      },
      circuitLengths: [
        {
          type: "incomer",
          buildingName: "Main Tower",
          length: 40,
        },
        {
          type: "riser",
          buildingName: "Main Tower",
          floorNumber: 1,
          length: 25,
        },
        {
          type: "floorItem",
          circuitName: "Apartment 101",
          length: 30,
        },
        {
          type: "buildingLoad",
          circuitName: "Passenger Elevator",
          length: 50,
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.projectId).toBe("proj-1");
    expect(res.updatedCircuitsCount).toBe(4);
    expect(res.appliedDefaults?.ambientTemp).toBe(45);
    expect(res.circuits).toHaveLength(4);

    const incomer = res.circuits.find((c) => c.type === "incomer");
    expect(incomer?.lengthM).toBe(40);

    const apt = res.circuits.find((c) => c.type === "floorItem");
    expect(apt?.lengthM).toBe(30);
    expect(apt?.cableSize).toBeDefined();

    const elev = res.circuits.find((c) => c.type === "buildingLoad");
    expect(elev?.lengthM).toBe(50);
  });

  it("checkProjectSelectivity checks coordination and flags overall status", async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: "proj-sel",
      name: "Selectivity Tower",
      voltage: 400,
      powerFactor: 0.85,
      calculationStandard: "IEC",
      preferredManufacturer: "SCHNEIDER",
      buildings: [
        {
          id: "bldg-sel",
          name: "Tower A",
          floorDesigns: [],
          buildingLoads: [],
        },
      ],
    });

    const res = await checkProjectSelectivity("proj-sel");
    expect(res.projectId).toBe("proj-sel");
    expect(res.preferredManufacturer).toBe("SCHNEIDER");
    expect(res.overallStatus).toBe("FULL");
  });
});
