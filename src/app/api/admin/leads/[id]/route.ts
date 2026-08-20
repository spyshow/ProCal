import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/leads/[id] — close a captured lead.
 *
 * The loop-fulfillment step: an admin closes an OPEN lead (typically after
 * granting credits in /admin/users). CLOSED sets closedAt.	status is
 * allow-listed (OPEN|CLOSED) — no arbitrary string lands on the row.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { status } = body as { status?: string };
  if (status !== "OPEN" && status !== "CLOSED") {
    return NextResponse.json({ error: "status must be OPEN or CLOSED" }, { status: 400 });
  }

  try {
    const updated = await db.contactRequest.update({
      where: { id },
      data: {
        status,
        // closedAt set when closing, cleared when reopening — keeps the two
        // fields from drifting (an OPEN row with a closedAt would be a lie).
        closedAt: status === "CLOSED" ? new Date() : null,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    // P2025 = record not found (Prisma's code). Everything else is a real 500.
    console.error("PATCH Lead Error:", error);
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/leads/[id] — permanently remove a captured lead.
 *
 * Housekeeping path (spam, QA artifacts, GDPR-style erasure). Unlike PATCH
 * there is no reopen — the row is gone. Admin-only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;

  try {
    await db.contactRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // P2025 = record not found (Prisma's code). Everything else is a real 500.
    console.error("DELETE Lead Error:", error);
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
}
