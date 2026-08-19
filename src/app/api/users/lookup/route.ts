import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json({ error: "Username parameter is required" }, { status: 400 });
    }

    const matchedUser = await db.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        disabled: false,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (!matchedUser) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        name: matchedUser.name,
        email: matchedUser.email,
      },
    });
  } catch (error) {
    console.error("GET /api/users/lookup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
