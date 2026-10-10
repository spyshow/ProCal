import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { isValidTheme, THEME_COOKIE_NAME, DEFAULT_THEME } from "@/lib/theme";

export async function POST(request: Request) {
  // Signup-flood mitigation: 5 accounts / hour per IP.
  const rl = rateLimit(clientKey(request, "register"), 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  try {
    const { username, password, name, email, theme } = await request.json();

    if (!username || !password || !name || !email) {
      return NextResponse.json(
        { error: "Username, password, name, and email are required" },
        { status: 400 }
      );
    }

    // Hand-rolled format check — matches the codebase's no-zod validation
    // idiom (see admin/users/route.ts). A required, replyable email is the
    // SMTP Reply-To and pre-fills /billing (eng-review D3 / OV-γ).
    const emailTrim = String(email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create user
    const initialTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        username,
        name,
        passwordHash,
        email: emailTrim,
        theme: initialTheme,
      },
    });

    // Auto-login after registration
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, theme: initialTheme },
    });

    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    response.cookies.set(THEME_COOKIE_NAME, initialTheme, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });

    return response;
  } catch (error: unknown) {
    console.error("Register API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
