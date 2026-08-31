import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        credits: true,
        disabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const projects = await db.project.findMany({
      where: {
        OR: [
          { userId: id },
          { members: { some: { userId: id } } },
        ],
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const projectCount = await db.project.count({
      where: {
        OR: [
          { userId: id },
          { members: { some: { userId: id } } },
        ],
      },
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      credits: user.credits,
      disabled: user.disabled,
      createdAt: user.createdAt,
      projectCount,
      projects,
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id]/summary error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
