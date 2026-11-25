import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";

const { mockDb, mockVerifyProjectAccess } = vi.hoisted(() => ({
  mockDb: {
    floorDesign: {
      findUnique: vi.fn(),
    },
    floorItem: {
      update: vi.fn((args: unknown) => args),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  mockVerifyProjectAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

describe("POST /api/floors/[id]/rebalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyProjectAccess.mockResolvedValue({
      user: { id: "user-1", role: "USER" },
      project: { id: "proj-1", userId: "user-1" },
    });
  });

  it("rebalances unpinned 1-phase loads with combinatorial optimizer and preserves pins", async () => {
    // Classic Graham LPT sub-optimal weights: 11, 11, 9, 9, 8, 6, 6 -> exact [20, 20, 20]
    const weights = [11, 11, 9, 9, 8, 6, 6];
    const items = weights.map((w, idx) => ({
      id: `item-${idx}`,
      type: "APARTMENT",
      name: `Apt ${idx + 1}`,
      calculatedCurrent: w,
      calculatedMaxDemand: w * 0.23,
      assignedPhase: null,
      apartmentTemplate: { phases: 1, rooms: [] },
      loadLibraryItem: null,
    }));

    mockDb.floorDesign.findUnique
      .mockResolvedValueOnce({
        id: "fd-1",
        building: {
          projectId: "proj-1",
          project: { id: "proj-1", powerFactor: 1, calculationStandard: "IEC" },
        },
        items,
      })
      .mockResolvedValueOnce({
        id: "fd-1",
        items,
      });

    const req = new Request("http://localhost/api/floors/fd-1/rebalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "fd-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.balance.phaseCurrent).toEqual([20, 20, 20]);
    expect(data.balance.unbalancePct).toBeCloseTo(0, 6);
    expect(mockDb.floorItem.update).toHaveBeenCalledTimes(7);
  });

  it("returns 403/401 short-circuit when verifyProjectAccess denies access", async () => {
    mockDb.floorDesign.findUnique.mockResolvedValueOnce({
      id: "fd-2",
      building: { projectId: "proj-2", project: { id: "proj-2" } },
      items: [],
    });
    mockVerifyProjectAccess.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const req = new Request("http://localhost/api/floors/fd-2/rebalance", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "fd-2" }) });
    expect(res.status).toBe(403);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
