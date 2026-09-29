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
  // Allow-list landing page, auth pages, invite acceptance, and auth/invite API calls
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invites")
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
     */
    "/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|api/invites|_next/static|_next/image|favicon.ico).*)",
  ],
};

