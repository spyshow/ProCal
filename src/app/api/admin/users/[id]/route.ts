import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    const body = await request.json();
    const { role, credits, disabled } = body as {
      role?: string;
      credits?: number;
      disabled?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (credits !== undefined) data.credits = credits;
    if (disabled !== undefined) data.disabled = disabled;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, role: true, credits: true, disabled: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH Admin User Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
