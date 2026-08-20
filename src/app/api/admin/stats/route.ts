import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * Bucket a list of Date objects into ISO weeks, zero-filled over `weeks`
 * trailing weeks (most recent last). SQLite has no native date-bucketing
 * helper, so grouping happens in-app — cheap at this data volume and
 * portable across the SQLite/Postgres adapters.
 */
export function weeklySeries(dates: Date[], weeks = 12): { week: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();

  // Monday-anchored week key (YYYY-MM-DD of the week's Monday).
function weekKey(d: Date) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = day.getUTCDay(); // 0 = Sunday
    day.setUTCDate(day.getUTCDate() - ((dow + 6) % 7)); // back to Monday
    return day.toISOString().slice(0, 10);
  }

  for (const d of dates) {
    const key = weekKey(d);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  // Zero-fill trailing weeks so the sparkline has a stable axis.
  const series: { week: string; count: number }[] = [];
  const anchor = new Date(weekKey(now));
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const key = start.toISOString().slice(0, 10);
    series.push({ week: key, count: buckets.get(key) ?? 0 });
  }
  return series;
}

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const [userStats, projectCount, creditsHeld, catalogCount, openLeads, totalLeads, userDates, projectDates] =
      await Promise.all([
        db.user.groupBy({
          by: ["disabled", "role"],
          _count: { id: true },
        }),
        db.project.count(),
        db.user.aggregate({ _sum: { credits: true } }),
        db.equipmentCatalog.count(),
        db.contactRequest.count({ where: { status: "OPEN" } }),
        db.contactRequest.count(),
        db.user.findMany({ select: { createdAt: true } }),
        db.project.findMany({ select: { createdAt: true } }),
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
      usersTrend: weeklySeries(userDates.map((u) => u.createdAt)),
      projectsTrend: weeklySeries(projectDates.map((p) => p.createdAt)),
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}