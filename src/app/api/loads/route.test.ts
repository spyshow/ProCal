import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = {
  verifyProjectAccess: vi.fn(),
  logProjectActivity: vi.fn(),
  loadCreate: vi.fn(),
  loadFindUnique: vi.fn(),
  loadUpdate: vi.fn(),
  loadDelete: vi.fn(),
};

vi.mock("@/lib/project-auth", () => ({
  verifyProjectAccess: vi.fn(async (...args) => mocks.verifyProjectAccess(...args)),
}));

vi.mock("@/lib/audit-logger", () => ({
  logProjectActivity: vi.fn(async (...args) => mocks.logProjectActivity(...args)),
}));

vi.mock("@/lib/db", () => ({
  db: {
    loadLibraryItem: {
      create: vi.fn(async (...args) => mocks.loadCreate(...args)),
      findUnique: vi.fn(async (...args) => mocks.loadFindUnique(...args)),
      update: vi.fn(async (...args) => mocks.loadUpdate(...args)),
      delete: vi.fn(async (...args) => mocks.loadDelete(...args)),
    },
  },
}));

async function postLoad(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/loads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function putLoad(id: string, body: unknown) {
  const { PUT } = await import("./[id]/route");
  return PUT(
    new Request(`http://localhost/api/loads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

async function deleteLoad(id: string) {
  const { DELETE } = await import("./[id]/route");
  return DELETE(
    new Request(`http://localhost/api/loads/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("Loads API /api/loads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.verifyProjectAccess.mockResolvedValue({
      user: { id: "u-1", name: "Engineer Alice" },
      member: { role: "ENGINEER" },
      project: { id: "proj-1" },
    });
  });

  describe("POST /api/loads", () => {
    it("creates a load item and writes audit log with LOAD entityType", async () => {
      const createdItem = {
        id: "load-123",
        name: "Chiller Pump",
        category: "HVAC",
        power: 15,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 0.9,
        quantity: 2,
        runningCurrent: 27.17,
        projectId: "proj-1",
      };
      mocks.loadCreate.mockResolvedValue(createdItem);

      const res = await postLoad({
        projectId: "proj-1",
        name: "Chiller Pump",
        category: "HVAC",
        power: 15,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 0.9,
        quantity: 2,
      });

      expect(res.status).toBe(200);
      expect(mocks.loadCreate).toHaveBeenCalledTimes(1);
      expect(mocks.logProjectActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          userId: "u-1",
          userName: "Engineer Alice",
          action: "CREATE",
          entityType: "LOAD",
          entityId: "load-123",
          description: expect.stringContaining('Added load "Chiller Pump"'),
          details: expect.objectContaining({
            changes: expect.arrayContaining([
              expect.objectContaining({ field: "name", newValue: "Chiller Pump" }),
              expect.objectContaining({ field: "power", newValue: "15 kW" }),
            ]),
          }),
        })
      );
    });

    it("returns 400 when missing required fields", async () => {
      const res = await postLoad({ projectId: "proj-1", name: "Incomplete" });
      expect(res.status).toBe(400);
      expect(mocks.logProjectActivity).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/loads/[id]", () => {
    it("updates a load item and writes audit log with diff details", async () => {
      const existing = {
        id: "load-1",
        name: "Old Pump",
        category: "Pump",
        power: 10,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 1.0,
        quantity: 1,
        projectId: "proj-1",
      };
      mocks.loadFindUnique.mockResolvedValue(existing);
      mocks.loadUpdate.mockResolvedValue({ ...existing, power: 15, name: "New Pump" });

      const res = await putLoad("load-1", { power: 15, name: "New Pump" });
      expect(res.status).toBe(200);
      expect(mocks.logProjectActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          action: "UPDATE",
          entityType: "LOAD",
          entityId: "load-1",
          description: expect.stringContaining("Updated load"),
          details: expect.objectContaining({
            changes: expect.arrayContaining([
              expect.objectContaining({ field: "power", oldValue: "10 kW", newValue: "15 kW" }),
              expect.objectContaining({ field: "name", oldValue: "Old Pump", newValue: "New Pump" }),
            ]),
          }),
        })
      );
    });
  });

  describe("DELETE /api/loads/[id]", () => {
    it("deletes a load item and logs the DELETE action", async () => {
      const existing = {
        id: "load-1",
        name: "Old Pump",
        category: "Pump",
        power: 10,
        voltage: 400,
        phase: 3,
        projectId: "proj-1",
      };
      mocks.loadFindUnique.mockResolvedValue(existing);
      mocks.loadDelete.mockResolvedValue(existing);

      const res = await deleteLoad("load-1");
      expect(res.status).toBe(200);
      expect(mocks.logProjectActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          action: "DELETE",
          entityType: "LOAD",
          entityId: "load-1",
          description: expect.stringContaining('Deleted load "Old Pump"'),
        })
      );
    });
  });
});
