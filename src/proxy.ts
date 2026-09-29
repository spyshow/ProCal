import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Fail-fast: a missing JWT_SECRET in production would let anyone forge session
// cookies with the well-known development default (see src/lib/env.ts).
const JWT_SECRET = new TextEncoder().encode(
  (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is not set. Refusing to start without a session signing secret in production.");
    }
    return secret || "procal-jwt-secret-key-default-development";
  })()
);

export async function proxy(request: NextRequest) {
  // Allow-list landing page, auth pages, invite acceptance, auth/invite API calls,
  // and the MCP endpoint.
  //
  // /api/mcp is here because MCP clients (Claude Desktop/Code, Cursor) send
  // `Authorization: Bearer <pat>` and cannot follow a browser redirect — a 302 to
  // /login would surface as an opaque protocol error rather than a 401. It is
  // authenticated inside the route by `resolveMcpActor`.
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invites") ||
    pathname.startsWith("/api/mcp") ||
    // Agent API. Like /api/mcp it authenticates with a bearer token, not a
    // session cookie, so a browser session must not be what gets it in.
    // See src/lib/agent/request.ts.
    pathname.startsWith("/api/agent") ||
    // Headless-print entry point. Authenticates with a short-lived signed print
    // ticket instead of a session cookie, because Chromium is a fresh process
    // with no cookies. See src/lib/reports/print-ticket.ts.
    pathname.startsWith("/print")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("session_token");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes that are NOT auth API routes
     * - static files, images, favicon
     *
     * `api/mcp` is in both the allow-list above AND this negative lookahead.
     * The allow-list alone is not enough: without the matcher exclusion the
     * proxy would still run for /api/mcp and redirect a bearer-token client
     * to /login instead of letting the route return a JSON 401.
     *
     * `api/agent` is excluded for the same reason — it is a bearer-token API.
     *
     * `print` is excluded for the same reason: headless Chromium has no session
     * cookie, so the print route must be reached and allowed to render its own
     * "ticket rejected" response rather than being redirected to /login.
     */
    "/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|api/invites|api/mcp|api/agent|print|_next/static|_next/image|favicon.ico).*)",
  ],
};

