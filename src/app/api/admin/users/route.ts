import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { username, password, name, email, role, credits } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json({ error: "Username, password, and name are required" }, { status: 400 });
    }
    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    let emailTrim: string | null = null;
    if (email !== undefined && email !== null && String(email).trim().length > 0) {
      emailTrim = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
      }
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        username,
        name,
        email: emailTrim,
        passwordHash,
        role: role === "ADMIN" ? "ADMIN" : "USER",
        credits: Number.isInteger(credits) && credits >= 0 ? credits : 0,
      },
      select: {
        id: true, username: true, name: true, email: true, role: true, credits: true, disabled: true,
        createdAt: true, _count: { select: { projects: true } },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("POST Admin User Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const users = await db.user.findMany({
      where: search
        ? {
            OR: [
              { username: { contains: search } },
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        disabled: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET Admin Users Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
