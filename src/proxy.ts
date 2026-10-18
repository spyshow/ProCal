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
  // Allow-list landing page, public tools, static assets, auth pages, and all API routes
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/slides") ||
    /\.(?:webp|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/i.test(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Pass-through requests carrying API key in headers
  const authHeader = request.headers.get("authorization") || request.headers.get("x-api-key");
  if (authHeader && (authHeader.includes("procal_sk_") || authHeader.startsWith("Bearer "))) {
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
     * - All /api/* routes (API routes perform own auth and return JSON 401, never HTML 307)
     * - static files, images, favicon, slides
     */
    "/((?!api/|_next/static|_next/image|slides/|favicon.ico).*)",
  ],
};

