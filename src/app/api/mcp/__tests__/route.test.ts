import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessionUser, mockHandleMcpRequest } = vi.hoisted(() => ({
  mockSessionUser: {
    user: null as null | { id: string; role: string; credits: number; name: string },
  },
  mockHandleMcpRequest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => mockSessionUser.user),
}));

vi.mock("@/lib/mcp/server", () => ({
  handleMcpRequest: vi.fn(async (...args) => mockHandleMcpRequest(...args)),
}));

describe("POST and GET /api/mcp route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser.user = {
      id: "user-1",
      role: "USER",
      credits: 5,
      name: "Engineer",
    };
  });

  it("GET /api/mcp returns server status and documentation description", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("active");
    expect(data.protocolVersion).toBe("2024-11-05");
  });

  it("POST /api/mcp returns 401 JSON-RPC error when unauthenticated", async () => {
    mockSessionUser.user = null;
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.jsonrpc).toBe("2.0");
    expect(data.error.code).toBe(-32000);
    expect(data.error.message).toContain("Unauthorized");
  });

  it("POST /api/mcp dispatches valid request to handleMcpRequest", async () => {
    mockHandleMcpRequest.mockResolvedValueOnce({
      jsonrpc: "2.0",
      id: 123,
      result: { tools: [] },
    });

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 123, method: "tools/list" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(123);
    expect(mockHandleMcpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "tools/list" }),
      mockSessionUser.user,
      "http://localhost"
    );
  });
});
