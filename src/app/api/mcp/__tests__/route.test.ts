import { describe, it, expect, vi } from "vitest";
import { GET, OPTIONS } from "../route";

describe("/api/mcp Route Handlers", () => {
  it("handles OPTIONS preflight with standard CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("handles GET with server status and CORS headers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toContain("ProCal Model Context Protocol (MCP) Server");
    expect(data.status).toBe("active");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
