import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./db";
import { getJwtSecret } from "@/lib/env";

const secretKey = getJwtSecret();
const JWT_SECRET = new TextEncoder().encode(secretKey);

export async function signJWT(payload: { userId: string; username: string; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; username: string; role: string };
  } catch {
    return null;
  }
}

export async function signPasswordResetToken(userId: string, email: string) {
  return new SignJWT({ userId, email, purpose: "reset-password" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

export async function verifyPasswordResetToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== "reset-password") return null;
    return payload as { userId: string; email: string; purpose: string };
  } catch {
    return null;
  }
}

/**
 * Returns the currently authenticated user from request cookies.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, name: true, role: true, credits: true, email: true },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Guard for admin-only routes. Returns either the authenticated admin user, or
 * a NextResponse to short-circuit the handler:
 *   - 401 if not logged in
 *   - 403 if logged in but not an ADMIN
 */
export async function requireAdmin(): Promise<
  { id: string; username: string; name: string; role: string; credits: number; email: string | null } | NextResponse
> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
