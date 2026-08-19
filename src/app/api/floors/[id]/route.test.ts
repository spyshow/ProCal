import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  floorFindUnique: vi.fn(),
  floorUpdate: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    floorDesign: {
      findUnique: vi.fn(async (...args) => mocks.floorFindUnique(...args)),
      update: vi.fn(async (...args) => mocks.floorUpdate(...args)),
    },
  },
}));

async function patchFloor(floorId: string, body: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request(`http://localhost/api/floors/${floorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: floorId }) }
  );
}

async function putFloor(floorId: string, body: unknown) {
  const { PUT } = await import("./route");
  return PUT(
    new Request(`http://localhost/api/floors/${floorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: floorId }) }
  );
}

const validFloor = {
  id: "floor-1",
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
  buildingId: "bldg-1",
  building: { projectId: "proj-1", project: { id: "proj-1" } },
};

describe("PATCH /api/floors/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.floorFindUnique.mockResolvedValue(validFloor);
    mocks.floorUpdate.mockResolvedValue({ ...validFloor, riserCableLength: 42 });
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "proj-1" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 404 if floor does not exist", async () => {
    mocks.floorFindUnique.mockResolvedValue(null);
    const res = await patchFloor("floor-none", { riserCableLength: 42 });
    expect(res.status).toBe(404);
    expect(mocks.verifyProjectAccess).not.toHaveBeenCalled();
  });

  it("returns 403 if project access is denied", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await patchFloor("floor-1", { riserCableLength: 42 });
    expect(res.status).toBe(403);
    expect(mocks.floorUpdate).not.toHaveBeenCalled();
  });

  it("requires EDIT on the calculator module", async () => {
    await patchFloor("floor-1", { riserCableLength: 42 });
    expect(mocks.verifyProjectAccess).toHaveBeenCalledWith("proj-1", {
      requiredAction: "EDIT",
      pageKey: "calculator",
    });
  });

  it("updates the floor when authorized", async () => {
    const res = await patchFloor("floor-1", { riserCableLength: 42 });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.riserCableLength).toBe(42);
  });
});

describe("PUT /api/floors/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.floorFindUnique.mockResolvedValue(validFloor);
    mocks.floorUpdate.mockResolvedValue({ ...validFloor, hasFloorSubPanels: true });
    mocks.verifyProjectAccess.mockResolvedValue({
      project: { id: "proj-1" },
      memberRole: "ENGINEER",
    });
  });

  it("returns 403 if project access is denied", async () => {
    mocks.verifyProjectAccess.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await putFloor("floor-1", { hasFloorSubPanels: true });
    expect(res.status).toBe(403);
    expect(mocks.floorUpdate).not.toHaveBeenCalled();
  });

  it("updates the floor when authorized", async () => {
    const res = await putFloor("floor-1", { hasFloorSubPanels: true });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasFloorSubPanels).toBe(true);
  });
});