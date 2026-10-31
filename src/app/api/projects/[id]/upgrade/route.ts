import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logProjectActivity } from "@/lib/audit-logger";

/**
 * POST /api/projects/[id]/upgrade — convert a Free Trial project to a full project.
 *
 * Owner-only. Spends 1 credit (admins: free) and clears `isTrial`, lifting the
 * 1-building / 2-level cap and export watermarks. All existing work is kept.
 * Both writes run in one transaction; the conditional credit decrement means a
 * double-click can never spend two credits or drive credits negative.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { id: true, userId: true, isTrial: true } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the project owner can upgrade this project" }, { status: 403 });
  }
  if (!project.isTrial) {
    return NextResponse.json({ ok: true, alreadyUpgraded: true });
  }

  try {
    await db.$transaction(async (tx) => {
      if (user.role !== "ADMIN") {
        const spent = await tx.user.updateMany({
          where: { id: user.id, credits: { gte: 1 } },
          data: { credits: { decrement: 1 } },
        });
        if (spent.count !== 1) throw new Error("NO_CREDITS");
      }
      const flipped = await tx.project.updateMany({
        where: { id, isTrial: true },
        data: { isTrial: false },
      });
      if (flipped.count !== 1) throw new Error("ALREADY_UPGRADED");
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_CREDITS") {
      return NextResponse.json({ error: "No credits remaining" }, { status: 402 });
    }
    if (msg === "ALREADY_UPGRADED") {
      return NextResponse.json({ ok: true, alreadyUpgraded: true });
    }
    console.error("POST upgrade error:", err);
    return NextResponse.json({ error: "Upgrade failed" }, { status: 500 });
  }

  await logProjectActivity({
    projectId: id,
    userId: user.id,
    userName: user.name || user.username,
    userRole: user.role === "ADMIN" ? "ADMIN" : "PROJECT_MANAGER",
    action: "UPDATE",
    entityType: "PROJECT",
    entityId: id,
    description: "Upgraded Free Trial project to full project (1 credit)",
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
