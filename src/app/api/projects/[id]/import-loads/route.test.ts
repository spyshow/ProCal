import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

const mocks = {
  user: null as null | { id: string; username: string; name: string; role: string; credits: number; email: string | null },
  projectFindUnique: vi.fn(),
  floorItemCreate: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mocks.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: mocks.projectFindUnique },
    floorItem: { create: mocks.floorItemCreate },
  },
}));

function makeWorkbookBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Loads");
  // Copy into a plain ArrayBuffer — Node Buffer/Uint8Array aren't valid BlobParts.
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

async function post(projectId: string, file: File, buildingId = "b1") {
  const { POST } = await import("./route");
  const form = new FormData();
  form.append("file", file);
  form.append("buildingId", buildingId);
  return POST(new Request(`http://localhost/api/projects/${projectId}/import-loads`, { method: "POST", body: form }), {
    params: Promise.resolve({ id: projectId }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.user = { id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: null };
  mocks.floorItemCreate.mockResolvedValue({ id: "new1" });
  mocks.projectFindUnique.mockResolvedValue({
    id: "p1",
    name: "Test Tower",
    voltage: 400,
    powerFactor: 0.85,
    buildings: [
      {
        id: "b1",
        name: "Tower A",
        floorDesigns: [
          { id: "f1", floorNumber: 1 },
          { id: "f2", floorNumber: 2 },
        ],
      },
    ],
  });
});

describe("POST /api/projects/[id]/import-loads", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.user = null;
    const res = await post("p1", new File([makeWorkbookBuffer([])], "loads.xlsx"));
    expect(res.status).toBe(401);
  });

  it("imports rows as manual loads with computed breaker/cable sizing", async () => {
    const buffer = makeWorkbookBuffer([
      { Floor: 1, Name: "Lobby Lights", kW: 5, Type: "MANUAL", Quantity: 1, Material: "Copper" },
      { Floor: 2, Name: "Pump Room", kW: 7.5, Type: "PUMP_PANEL", Quantity: 1, Material: "Aluminum" },
    ]);
    const file = new File([buffer], "loads.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const res = await post("p1", file);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.created).toBe(2);
    expect(data.skipped).toHaveLength(0);

    expect(mocks.floorItemCreate).toHaveBeenCalledTimes(2);

    const first = mocks.floorItemCreate.mock.calls[0][0].data;
    expect(first.name).toBe("Lobby Lights");
    expect(first.floorDesignId).toBe("f1");
    expect(first.type).toBe("MANUAL");
    expect(first.cableMaterial).toBe("copper");
    // 5 kW / (√3 · 0.4 · 0.85) = 8.49 A → 10 A breaker, 2.5 mm² cable
    expect(first.calculatedCurrent).toBeCloseTo(8.49, 1);
    expect(first.breakerSize).toBe("10A");

    const second = mocks.floorItemCreate.mock.calls[1][0].data;
    expect(second.name).toBe("Pump Room");
    expect(second.floorDesignId).toBe("f2");
    expect(second.cableMaterial).toBe("aluminum");
    expect(second.calculatedMaxDemand).toBeCloseTo(7.5, 1);
  });

  it("skips rows whose floor does not exist and reports them", async () => {
    const buffer = makeWorkbookBuffer([
      { Floor: 1, Name: "OK Load", kW: 3 },
      { Floor: 9, Name: "Missing Floor Load", kW: 3 },
    ]);
    const file = new File([buffer], "loads.xlsx");

    const res = await post("p1", file);
    const data = await res.json();

    expect(data.created).toBe(1);
    expect(data.skipped).toHaveLength(1);
    expect(data.skipped[0].reason).toContain('floor 9 does not exist');
    expect(data.floorsMissing).toEqual([9]);
  });

  it("skips rows with validation errors", async () => {
    const buffer = makeWorkbookBuffer([
      { Floor: 1, Name: "", kW: 3 },
      { Floor: 1, Name: "No kW", kW: 0 },
      { Floor: 1, Name: "Good Load", kW: 4 },
    ]);
    const file = new File([buffer], "loads.xlsx");

    const res = await post("p1", file);
    const data = await res.json();

    expect(data.created).toBe(1);
    expect(data.skipped).toHaveLength(2);
  });

  it("rejects a non-workbook file", async () => {
    const file = new File([Buffer.from("not an xlsx")], "loads.xlsx");
    const res = await post("p1", file);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the building is not in the project", async () => {
    const buffer = makeWorkbookBuffer([{ Floor: 1, Name: "Lobby Lights", kW: 5 }]);
    const file = new File([buffer], "loads.xlsx");
    const res = await post("p1", file, "other-building");
    expect(res.status).toBe(404);
  });
});
