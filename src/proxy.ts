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

/**
 * Per-request Content-Security-Policy with a strict script nonce.
 *
 * This Next.js release reads the nonce out of the CSP request header and
 * stamps it onto every framework-injected <script>, so inline injection stays
 * blocked without allowlisting anything. style-src keeps 'unsafe-inline'
 * because React applies styles via style="" attributes, which nonces do not
 * cover. 'unsafe-eval' is dev-only (React debug stacks).
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Allow-list landing page, auth pages, invite acceptance, and auth/invite API calls
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invites")
  ) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const token = request.cookies.get("session_token")?.value;

  if (!token) {
    return redirectToLogin(request, csp);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    return redirectToLogin(request, csp);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function redirectToLogin(request: NextRequest, csp: string): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Content-Security-Policy", csp);
  response.cookies.delete("session_token");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes that are NOT auth API routes
     * - static files, images, favicon
     */
    "/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|api/invites|_next/static|_next/image|favicon.ico).*)",
  ],
};
