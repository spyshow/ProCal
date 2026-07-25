import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const users = await db.user.findMany({
      where: search
        ? { OR: [{ username: { contains: search } }, { name: { contains: search } }] }
        : undefined,
      select: {
        id: true,
        username: true,
        name: true,
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
