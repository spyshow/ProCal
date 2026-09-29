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
    const { role, credits, disabled, email, name } = body as {
      role?: string;
      credits?: number;
      disabled?: boolean;
      email?: string | null;
      name?: string;
    };

    // OV-δ: harden the grant PATCH to match its POST sibling (admin/users/
    // route.ts:35). credits is the loop-fulfillment knob — a non-integer or
    // negative value is rejected with 400 rather than silently persisted, so
    // an admin can't 400-then-no-row their way to a half-state.
    if (credits !== undefined && !(Number.isInteger(credits) && credits >= 0)) {
      return NextResponse.json({ error: "credits must be a non-negative integer" }, { status: 400 });
    }
    // Role is an allow-listed enum, matches POST.
    if (role !== undefined && role !== "ADMIN" && role !== "USER") {
      return NextResponse.json({ error: "role must be ADMIN or USER" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (credits !== undefined) data.credits = credits;
    if (disabled !== undefined) data.disabled = disabled;
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (email !== undefined) {
      if (email === null || email === "") {
        data.email = null;
      } else {
        if (typeof email !== "string") {
          return NextResponse.json({ error: "Email must be a string" }, { status: 400 });
        }
        const emailTrim = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
          return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
        }
        data.email = emailTrim;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, email: true, role: true, credits: true, disabled: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH Admin User Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
