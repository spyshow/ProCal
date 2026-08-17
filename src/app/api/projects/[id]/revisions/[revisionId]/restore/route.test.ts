import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  projectFindUnique: vi.fn(),
  revisionFindUnique: vi.fn(),
  breakerFamilyFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
  revisionCount: vi.fn(),
  revisionCreate: vi.fn(),
  // Two-way sync delegates (used inside the transaction)
  loadLibraryItem: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  apartmentTemplate: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  apartmentRoom: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  building: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  buildingLoad: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  floorDesign: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  floorItem: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    projectRevision: { findUnique: mocks.revisionFindUnique },
    $transaction: mocks.$transaction,
  },
}));

// The transaction executor passes the same delegate mock set as `tx`.
beforeEach(() => {
  mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return fn({
      breakerFamily: { findUnique: mocks.breakerFamilyFindUnique },
      project: { update: mocks.projectUpdate, findUnique: mocks.projectFindUnique },
      projectRevision: { count: mocks.revisionCount, create: mocks.revisionCreate },
      loadLibraryItem: mocks.loadLibraryItem,
      apartmentTemplate: mocks.apartmentTemplate,
      apartmentRoom: mocks.apartmentRoom,
      building: mocks.building,
      buildingLoad: mocks.buildingLoad,
      floorDesign: mocks.floorDesign,
      floorItem: mocks.floorItem,
    });
  });
});

const snapshot = {
  id: "p1",
  name: "Test Tower",
  client: "Client A",
  consultant: "",
  contractor: "",
  location: "Damascus",
  engineer: "Eng. A",
  date: "2026-08-01",
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  maxDemandFactor: 0.8,
  transformerSize: 630,
  notes: null,
  preferredManufacturer: "SCHNEIDER",
  defaultAcbFamilyId: "fam-acb",
  defaultMccbFamilyId: null,
  defaultMcbFamilyId: null,
  country: "Syria",
  logoUrl: null,
  calculationStandard: "IEC",
  maxVoltageDropLighting: 3,
  maxVoltageDropPower: 5,
  ambientTemp: 30,
  groupingCount: 1,
  buildings: [
    {
      id: "b1",
      name: "Tower A",
      floors: 8,
      serviceFloors: 1,
      apartmentsPerFloor: 4,
      mechanicalLoads: null,
      generator: null,
      transformer: null,
      supplyVoltage: "400V 3-Phase",
      earthingSystem: "TN-S",
      lightningProtection: true,
      floorDesigns: [
        {
          id: "fd1",
          floorNumber: 1,
          hasFloorSubPanels: false,
          riserCableLength: null,
          riserCableSize: null,
          riserBreakerSize: null,
          riserInstallMethod: "C",
          riserCableInsulation: "XLPE",
          riserCableMaterial: "copper",
          riserAmbientTemp: 30,
          riserGroupingCount: 1,
          items: [
            {
              id: "i1",
              type: "APARTMENT",
              name: "Apartment 1",
              apartmentTemplateId: "t1",
              loadLibraryItemId: null,
              calculatedConnectedLoad: 9000,
              calculatedMaxDemand: 4000,
              calculatedCurrent: 17.4,
              breakerSize: "20A",
              cableSize: "2.5 mm²",
              cableLength: 25,
              voltageDrop: 1.2,
              installMethod: "C",
              cableInsulation: "XLPE",
              cableMaterial: "copper",
              ambientTemp: 30,
              groupingCount: 1,
              assignedPhase: null,
            },
          ],
        },
      ],
      buildingLoads: [
        {
          id: "bl1",
          loadLibraryItemId: "lli1",
          quantity: 2,
          cableSize: "6 mm²",
          cableLength: 40,
          installMethod: "C",
          cableInsulation: "XLPE",
          cableMaterial: "copper",
          ambientTemp: 30,
          groupingCount: 1,
          assignedPhase: null,
        },
      ],
    },
  ],
  apartmentTemplates: [
    {
      id: "t1",
      name: "Standard",
      phases: 1,
      rooms: [{ id: "r1", type: "BEDROOM", name: "Master", area: 18, hasAc: false, acBtu: null, loadDensity: 100, connectedLoad: 1800 }],
    },
  ],
  loadLibraryItems: [
    { id: "lli1", name: "Water Pump", category: "Pump", power: 5.5, voltage: 400, phase: 3, powerFactor: 0.8, demandFactor: 1, quantity: 2, runningCurrent: 9.9, startingCurrent: 60, notes: null },
  ],
};

const revisionRecord = {
  id: "r1",
  projectId: "p1",
  rev: "R0",
  description: "Issued for comment",
  createdById: "u1",
  snapshotJson: JSON.stringify(snapshot),
  createdAt: new Date("2026-08-01T10:00:00Z"),
  createdBy: { username: "alice" },
};

async function post(id: string, revisionId: string) {
  const { POST } = await import("./route");
  return POST(
    new Request(`http://localhost/api/projects/${id}/revisions/${revisionId}/restore`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id, revisionId }) }
  );
}

function defaultMocks() {
  mocks.projectFindUnique.mockResolvedValue({ id: "p1" });
  mocks.revisionFindUnique.mockResolvedValue(revisionRecord);
  mocks.breakerFamilyFindUnique.mockResolvedValue({ id: "fam-acb" });
  mocks.revisionCount.mockResolvedValue(0);
  mocks.revisionCreate.mockResolvedValue({
    id: "r2",
    projectId: "p1",
    rev: "R0",
    description: "Auto-snapshot before restoring R0 — Issued for comment",
    createdById: "u1",
    snapshotJson: "{}",
    createdAt: new Date("2026-08-02T10:00:00Z"),
    createdBy: { username: "alice" },
  });
  // No extras anywhere by default → nothing to delete.
  for (const delegate of [
    mocks.loadLibraryItem,
    mocks.apartmentTemplate,
    mocks.apartmentRoom,
    mocks.building,
    mocks.buildingLoad,
    mocks.floorDesign,
    mocks.floorItem,
  ]) {
    delegate.findMany.mockResolvedValue([]);
    delegate.deleteMany.mockResolvedValue({ count: 0 });
    delegate.upsert.mockImplementation(async (args: { where: { id: string } }) => ({ id: args.where.id }));
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: null };
  defaultMocks();
});

describe("POST /api/projects/[id]/revisions/[revisionId]/restore", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.user = null;
    const res = await post("p1", "r1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the project is not owned by the user", async () => {
    mocks.projectFindUnique.mockResolvedValue(null);
    const res = await post("p1", "r1");
    expect(res.status).toBe(404);
  });

  it("returns 404 when the revision does not belong to the project", async () => {
    mocks.revisionFindUnique.mockResolvedValue(null);
    const res = await post("p1", "r1");
    expect(res.status).toBe(404);
  });

  it("returns 400 on a corrupt snapshot", async () => {
    mocks.revisionFindUnique.mockResolvedValue({ ...revisionRecord, snapshotJson: "{not json" });
    const res = await post("p1", "r1");
    expect(res.status).toBe(400);
  });

  it("returns 400 on a snapshot missing required arrays", async () => {
    mocks.revisionFindUnique.mockResolvedValue({ ...revisionRecord, snapshotJson: JSON.stringify({ id: "p1" }) });
    const res = await post("p1", "r1");
    expect(res.status).toBe(400);
  });

  it("re-applies the snapshot: upserts project scalars and entities by id", async () => {
    // One extra building exists live (added after the revision was issued) → must be deleted.
    mocks.building.findMany.mockResolvedValue([{ id: "b-extra" }]);
    mocks.building.deleteMany.mockResolvedValue({ count: 1 });

    const res = await post("p1", "r1");
    expect(res.status).toBe(200);
    const data = await res.json();

    // Project scalars restored.
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        name: "Test Tower",
        voltage: 400,
        transformerSize: 630,
        defaultAcbFamilyId: "fam-acb",
      }),
    });

    // Extras removed, snapshot rows upserted by their original ids.
    expect(mocks.building.deleteMany).toHaveBeenCalledWith({
      where: { projectId: "p1", id: { in: ["b-extra"] } },
    });
    expect(mocks.building.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        create: expect.objectContaining({ id: "b1", name: "Tower A" }),
      })
    );
    expect(mocks.floorDesign.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fd1" },
        create: expect.objectContaining({ id: "fd1", floorNumber: 1 }),
      })
    );
    expect(mocks.floorItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i1" },
        create: expect.objectContaining({ id: "i1", name: "Apartment 1", apartmentTemplateId: "t1" }),
      })
    );
    expect(mocks.buildingLoad.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bl1" },
        create: expect.objectContaining({ id: "bl1", loadLibraryItemId: "lli1" }),
      })
    );
    expect(mocks.apartmentTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        create: expect.objectContaining({ id: "t1", name: "Standard" }),
      })
    );
    expect(mocks.apartmentRoom.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        create: expect.objectContaining({ id: "r1", type: "BEDROOM", templateId: "t1" }),
      })
    );
    expect(mocks.loadLibraryItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lli1" },
        create: expect.objectContaining({ id: "lli1", name: "Water Pump" }),
      })
    );

    // Response carries the pre-restore auto-revision + counts.
    expect(data.revision.rev).toBe("R0");
    expect(data.revision.createdByUsername).toBe("alice");
    expect(data.counts).toEqual({
      buildingsUpserted: 1,
      buildingsDeleted: 1,
      floorDesignsDeleted: 0,
      itemsDeleted: 0,
      buildingLoadsDeleted: 0,
      templatesUpserted: 1,
      loadLibraryItemsUpserted: 1,
    });
  });

  it("snapshots the current live state as an auto-revision before applying", async () => {
    await post("p1", "r1");

    // The pre-restore snapshot loads the full project state.
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          rev: "R0",
          createdById: "u1",
          description: "Auto-snapshot before restoring R0 — Issued for comment",
        }),
      })
    );
    const createCall = mocks.revisionCreate.mock.calls[0][0];
    const preSnapshot = JSON.parse(createCall.data.snapshotJson);
    expect(preSnapshot.id).toBe("p1");
  });

  it("nulls default family ids whose catalog family no longer exists", async () => {
    mocks.breakerFamilyFindUnique.mockResolvedValue(null);
    await post("p1", "r1");

    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        defaultAcbFamilyId: null,
        defaultMccbFamilyId: null,
        defaultMcbFamilyId: null,
      }),
    });
  });
});
