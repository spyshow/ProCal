import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetNotification } from "@/lib/notify";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Mail-relay mitigation: 5 reset emails / hour per IP.
  const rl = rateLimit(clientKey(request, "forgot-password"), 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many reset requests. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.identifier || typeof body.identifier !== "string") {
      return NextResponse.json(
        { error: "Username or email is required" },
        { status: 400 }
      );
    }

    const identifier = body.identifier.trim();
    if (!identifier) {
      return NextResponse.json(
        { error: "Username or email is required" },
        { status: 400 }
      );
    }

    // Lookup by username or email
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        disabled: true,
      },
    });

    const genericSuccess = {
      ok: true,
      message: "If an account with that username or email exists, a password reset link has been sent.",
    };

    if (!user || user.disabled || !user.email) {
      // Don't leak whether the account exists or has an email
      return NextResponse.json(genericSuccess);
    }

    const resetToken = await signPasswordResetToken(user.id, user.email);

    // Determine host origin for the reset link
    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
      process.env.NEXTAUTH_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    const resetUrl = `${origin}/reset-password?token=${resetToken}`;

    const sendRes = await sendPasswordResetNotification({
      toEmail: user.email,
      name: user.name,
      username: user.username,
      resetUrl,
    });

    // In dev environment or test, expose devResetUrl for testing if SMTP is unconfigured
    const isDev = process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST;

    return NextResponse.json({
      ...genericSuccess,
      ...(isDev ? { devResetUrl: resetUrl, emailSent: sendRes.ok } : {}),
    });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
