import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { isValidTheme, THEME_COOKIE_NAME, DEFAULT_THEME } from "@/lib/theme";

export async function POST(request: Request) {
  // Brute-force mitigation: 10 attempts / 5 min per IP.
  const rl = rateLimit(clientKey(request, "login"), 10, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Username or email and password are required" },
        { status: 400 }
      );
    }

    const { username, email, identifier, password, theme } = body as {
      username?: string;
      email?: string;
      identifier?: string;
      password?: string;
      theme?: string;
    };

    const userIdentifier = (identifier || username || email || "").trim();

    if (!userIdentifier || !password) {
      return NextResponse.json(
        { error: "Username or email and password are required" },
        { status: 400 }
      );
    }

    // Find user by username or email (case-insensitive)
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: userIdentifier, mode: "insensitive" } },
          { email: { equals: userIdentifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.disabled) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Determine effective theme
    let effectiveTheme = user.theme;
    if (isValidTheme(theme) && theme !== user.theme) {
      effectiveTheme = theme;
      // Persist the theme chosen on login page to user profile
      await db.user.update({
        where: { id: user.id },
        data: { theme },
      }).catch((err) => {
        console.error("Failed to update user theme on login:", err);
      });
    } else if (!isValidTheme(effectiveTheme)) {
      effectiveTheme = DEFAULT_THEME;
    }

    // Generate JWT
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, theme: effectiveTheme },
    });

    // Set cookies
    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    response.cookies.set(THEME_COOKIE_NAME, effectiveTheme, {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
    });

    return response;
  } catch (error: unknown) {
    console.error("Login API Error:", error);
    const message =
      error instanceof Error ? error.message : "Database connection or authentication error";
    return NextResponse.json(
      { error: `Login failed: ${message}` },
      { status: 500 }
    );
  }
}
