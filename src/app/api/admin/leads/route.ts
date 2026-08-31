import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/leads — the captured-lead ledger (Approach B).
 *
 * Query params:
 *   ?type=billing   — returns only billing credit requests (excludes [FEEDBACK...])
 *   ?type=feedback  — returns only user feedback & error reports ([FEEDBACK...])
 *   (none / other)  — returns all contact requests
 *
 * requireAdmin gates this (401/403 JSON — self-auth posture; /api/admin is now
 * matcher-excluded so an expired session never 302s to HTML here, OV-α).
 * Includes the requesting user's {id, username, name, email} so admins reply
 * directly without a second lookup.
 */
export async function GET(request?: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let where: Record<string, unknown> | undefined = undefined;
  if (request) {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    if (type === "billing") {
      where = {
        NOT: {
          message: { startsWith: "[FEEDBACK" },
        },
      };
    } else if (type === "feedback") {
      where = {
        message: { startsWith: "[FEEDBACK" },
      };
    }
  }

  const leads = await db.contactRequest.findMany({
    where,
    include: { user: { select: { id: true, username: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}
