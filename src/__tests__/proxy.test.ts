import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { signJWT } from "../lib/auth";

describe("Next.js proxy middleware", () => {
  function createReq(pathname: string, headers: Record<string, string> = {}, cookies: Record<string, string> = {}) {
    const url = `http://localhost${pathname}`;
    const req = new NextRequest(url, { headers });
    for (const [k, v] of Object.entries(cookies)) {
      req.cookies.set(k, v);
    }
    return req;
  }

  it("passes through public static assets and landing routes", async () => {
    const publicPaths = ["/", "/tools/voltage-drop", "/contact", "/slides/presentation", "/logo.png", "/login", "/signup"];
    for (const path of publicPaths) {
      const req = createReq(path);
      const res = await proxy(req);
      expect(res.headers.get("x-middleware-rewrite") || res.status).toBe(200);
      expect(res.status).not.toBe(307);
    }
  });

  it("passes through all /api/* routes without redirecting to login", async () => {
    const apiPaths = ["/api/projects", "/api/mcp", "/api/api-keys", "/api/buildings/123/recalculate"];
    for (const path of apiPaths) {
      const req = createReq(path);
      const res = await proxy(req);
      expect(res.status).not.toBe(307);
    }
  });

  it("passes through requests carrying Bearer procal_sk_... API key", async () => {
    const req = createReq("/calculator", {
      authorization: "Bearer procal_sk_0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });

  it("redirects unauthenticated requests on protected pages to /login", async () => {
    const req = createReq("/calculator");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("passes through protected pages when valid session_token cookie is present", async () => {
    const token = await signJWT({ userId: "u-1", username: "eng", role: "USER" });
    const req = createReq("/calculator", {}, { session_token: token });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
  });
});
