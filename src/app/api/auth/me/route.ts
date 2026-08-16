import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { email, name } = body as { email?: string; name?: string };

    if (email === undefined && name === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const data: { email?: string; name?: string } = {};

    if (email !== undefined) {
      if (typeof email !== "string") {
        return NextResponse.json({ error: "Email must be a string" }, { status: 400 });
      }
      const emailTrim = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
      }
      data.email = emailTrim;
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = name.trim();
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data,
      select: { id: true, username: true, name: true, role: true, credits: true, email: true },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error: unknown) {
    console.error("PATCH /api/auth/me Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}

