import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password, name } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Username, password, and name are required" },
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
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        username,
        name,
        passwordHash,
      },
    });

    // Auto-login after registration
    const token = await signJWT({
      userId: user.id,
      username: user.username,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name },
    });

    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Register API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
