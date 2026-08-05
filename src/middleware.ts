import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET || "procal-jwt-secret-key-default-development";
const JWT_SECRET = new TextEncoder().encode(secretKey);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  const { pathname } = request.nextUrl;

  // Allow landing page, auth pages and auth API calls
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session_token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes that are NOT auth API routes
     * - static files, images, favicon
     */
    // api/projects|buildings|cables|equipment — excluded pre-existing (self-auth).
    // api/contact + api/admin — excluded so an expired session yields JSON 401
    // from the handler's self-auth (CQ-B / OV-α), not the 302→/login HTML the
    // matcher produces for other paths. Kills the cookie-expiry→silent-failure
    // class on the billing path and on all 11 admin routes.
    "/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|_next/static|_next/image|favicon.ico).*)",
  ],
};
