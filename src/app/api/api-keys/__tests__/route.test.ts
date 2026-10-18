import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockSessionUser } = vi.hoisted(() => ({
  mockDb: {
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSessionUser: {
    user: null as null | { id: string; username: string; role: string },
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockSessionUser.user),
  };
});

describe("/api/api-keys route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser.user = { id: "user-abc", username: "engineer", role: "USER" };
  });

  describe("GET /api/api-keys", () => {
    it("returns 401 when unauthenticated", async () => {
      mockSessionUser.user = null;
      const { GET } = await import("../route");
      const res = await GET();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns keys without exposing keyHash", async () => {
      const mockKeys = [
        {
          id: "k-1",
          name: "Claude Desktop",
          keyPrefix: "procal_sk_123456...",
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
        },
      ];
      mockDb.apiKey.findMany.mockResolvedValueOnce(mockKeys);

      const { GET } = await import("../route");
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.keys).toHaveLength(1);
      expect(data.keys[0].name).toBe("Claude Desktop");
      expect(data.keys[0].keyHash).toBeUndefined();
    });
  });

  describe("POST /api/api-keys", () => {
    it("returns 401 when unauthenticated", async () => {
      mockSessionUser.user = null;
      const { POST } = await import("../route");
      const req = new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cursor" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("creates an API key, hashes it, and returns rawKey once", async () => {
      mockDb.apiKey.count.mockResolvedValueOnce(2);
      mockDb.apiKey.create.mockImplementationOnce(async ({ data }) => ({
        id: "new-key-id",
        name: data.name,
        keyPrefix: data.keyPrefix,
        createdAt: new Date(),
      }));

      const { POST } = await import("../route");
      const req = new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Cursor Agent" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.apiKey.name).toBe("My Cursor Agent");
      expect(data.rawKey.startsWith("procal_sk_")).toBe(true);
      expect(mockDb.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-abc",
            name: "My Cursor Agent",
            keyHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          }),
        })
      );
    });

    it("enforces maximum 25 active keys limit", async () => {
      mockDb.apiKey.count.mockResolvedValueOnce(25);
      const { POST } = await import("../route");
      const req = new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Excess Key" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Maximum active API keys reached");
    });
  });

  describe("DELETE /api/api-keys", () => {
    it("returns 404 when key does not exist or belongs to another user", async () => {
      mockDb.apiKey.findUnique.mockResolvedValueOnce({
        id: "other-key",
        userId: "different-user",
        revokedAt: null,
      });

      const { DELETE } = await import("../route");
      const req = new Request("http://localhost/api/api-keys?id=other-key", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });

    it("revokes key owned by user", async () => {
      mockDb.apiKey.findUnique.mockResolvedValueOnce({
        id: "my-key",
        userId: "user-abc",
        revokedAt: null,
      });

      const { DELETE } = await import("../route");
      const req = new Request("http://localhost/api/api-keys?id=my-key", { method: "DELETE" });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockDb.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "my-key" },
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
