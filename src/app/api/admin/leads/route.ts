import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/leads — the captured-lead ledger (Approach B).
 *
 * requireAdmin gates this (401/403 JSON — self-auth posture; /api/admin is now
 * matcher-excluded so an expired session never 302s to HTML here, OV-α).
 * Includes the requesting user's {id, username, name, email} so admins reply
 * directly without a second lookup.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const leads = await db.contactRequest.findMany({
    include: { user: { select: { id: true, username: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}
