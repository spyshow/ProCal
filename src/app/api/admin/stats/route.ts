import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const [userStats, projectCount, creditsHeld, catalogCount, openLeads, totalLeads] = await Promise.all([
      db.user.groupBy({
        by: ["disabled", "role"],
        _count: { id: true },
      }),
      db.project.count(),
      db.user.aggregate({ _sum: { credits: true } }),
      db.equipmentCatalog.count(),
      db.contactRequest.count({ where: { status: "OPEN" } }),
      db.contactRequest.count(),
    ]);

    const total = userStats.reduce((s, r) => s + r._count.id, 0);
    const disabled = userStats.filter((r) => r.disabled).reduce((s, r) => s + r._count.id, 0);
    const admins = userStats.filter((r) => r.role === "ADMIN").reduce((s, r) => s + r._count.id, 0);

    return NextResponse.json({
      users: { total, enabled: total - disabled, disabled, admins },
      projects: projectCount,
      creditsHeld: creditsHeld._sum.credits ?? 0,
      catalogItems: catalogCount,
      openLeads,
      totalLeads,
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
