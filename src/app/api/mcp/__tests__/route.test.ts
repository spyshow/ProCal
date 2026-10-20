import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, OPTIONS, POST } from "../route";

const { mockGetUserByApiKey, mockGetSessionUser } = vi.hoisted(() => ({
  mockGetUserByApiKey: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserByApiKey: mockGetUserByApiKey,
  getSessionUser: mockGetSessionUser,
}));

describe("/api/mcp Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles OPTIONS preflight with standard CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("handles GET with server status, query key documentation, and CORS headers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toContain("ProCal Model Context Protocol (MCP) Server");
    expect(data.status).toBe("active");
    expect(data.description).toContain("?key=procal_sk_...");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 when POST request body is missing or lacks 'method'", async () => {
    const req = new Request("https://procal.example.com/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe(-32600);
  });

  it("permits anonymous 'initialize' and returns 200 OK for Gemini handshake", async () => {
    mockGetUserByApiKey.mockResolvedValue(null);
    mockGetSessionUser.mockResolvedValue(null);

    const req = new Request("https://procal.example.com/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(1);
    expect(json.result.serverInfo.name).toBe("procal-mcp-server");
  });

  it("permits anonymous 'tools/list' and returns all tools for Gemini discovery", async () => {
    mockGetUserByApiKey.mockResolvedValue(null);
    mockGetSessionUser.mockResolvedValue(null);

    const req = new Request("https://procal.example.com/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.tools).toHaveLength(11);
  });

  it("authenticates user from URL query parameter '?key=procal_sk_...'", async () => {
    const fakeUser = {
      id: "user-query-1",
      role: "USER",
      credits: 25,
      name: "Gemini Tester",
      username: "gemini_tester",
    };
    mockGetUserByApiKey.mockResolvedValue(fakeUser);

    const req = new Request(
      "https://procal.example.com/api/mcp?key=procal_sk_validapikey123",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "get_engineering_catalog",
            arguments: { country: "Germany" },
          },
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGetUserByApiKey).toHaveBeenCalledWith("procal_sk_validapikey123");
    const json = await res.json();
    const content = JSON.parse(json.result.content[0].text);
    expect(content.country).toBe("Germany");
    expect(content.electricalDefaults.frequency).toBe(50);
  });

  it("returns user-friendly auth requirement when anonymous user calls protected tool", async () => {
    mockGetUserByApiKey.mockResolvedValue(null);
    mockGetSessionUser.mockResolvedValue(null);

    const req = new Request("https://procal.example.com/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "create_project_from_spec",
          arguments: {
            name: "Unauthenticated Tower",
            isConfirmedByUser: true,
            apartmentTemplates: [],
            buildings: [],
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain("Authentication required");
    expect(json.result.content[0].text).toContain("?key=procal_sk_...");
  });
});
