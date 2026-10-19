import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { getJwtSecret } from "@/lib/env";

const secretKey = getJwtSecret();
const JWT_SECRET = new TextEncoder().encode(secretKey);

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomHex = randomBytes(24).toString("hex");
  const rawKey = `procal_sk_${randomHex}`;
  const keyPrefix = rawKey.slice(0, 16) + "...";
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export async function signReportDownloadToken(projectId: string, userId: string) {
  return new SignJWT({ projectId, userId, purpose: "report-pdf" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

export async function verifyReportDownloadToken(token: string, projectId: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== "report-pdf") return null;
    if (payload.projectId !== projectId) return null;
    return payload as { projectId: string; userId: string; purpose: string };
  } catch {
    return null;
  }
}

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
 * Resolves a user by raw API key (procal_sk_...).
 * Handles hashing, revocation check, disabled user check, and throttled lastUsedAt update.
 */
export async function getUserByApiKey(rawKey: string) {
  if (!rawKey || !rawKey.startsWith("procal_sk_")) {
    return null;
  }
  try {
    const keyHash = hashApiKey(rawKey);
    const apiKey = await db.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true, credits: true, email: true, theme: true, disabled: true },
        },
      },
    });

    if (apiKey && !apiKey.revokedAt && apiKey.user && !apiKey.user.disabled) {
      // Throttled update of lastUsedAt (>60s) to avoid write contention on row locks
      const now = new Date();
      if (!apiKey.lastUsedAt || now.getTime() - apiKey.lastUsedAt.getTime() > 60000) {
        db.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: now },
        }).catch((err) => console.warn("Failed to update apiKey lastUsedAt:", err));
      }
      return apiKey.user;
    }
  } catch (err) {
    console.warn("getUserByApiKey error:", err);
  }

  return null;
}

/**
 * Returns the currently authenticated user from request cookies or Authorization Bearer API key.
 */
export async function getSessionUser() {
  // 1. Check session_token cookie (web app)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (token) {
      const payload = await verifyJWT(token);
      if (payload) {
        const user = await db.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, username: true, name: true, role: true, credits: true, email: true, theme: true, disabled: true },
        });
        if (user && !user.disabled) {
          return user;
        }
      }
    }
  } catch {
    // cookies() may throw in non-request test contexts
  }

  // 2. Fallback: Authorization: Bearer procal_sk_... or x-api-key header
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization") || headerStore.get("x-api-key");
    if (authHeader) {
      const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
      const user = await getUserByApiKey(rawKey);
      if (user) {
        return user;
      }
    }
  } catch {
    // headers() may throw in non-request test contexts
  }

  return null;
}

/**
 * Guard for admin-only routes. Returns either the authenticated admin user, or
 * a NextResponse to short-circuit the handler:
 *   - 401 if not logged in
 *   - 403 if logged in but not an ADMIN
 */
export async function requireAdmin(): Promise<
  { id: string; username: string; name: string; role: string; credits: number; email: string | null; theme?: string } | NextResponse
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
