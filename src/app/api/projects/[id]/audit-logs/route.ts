import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";
import { enrichLegacyAuditLog } from "@/lib/audit-diff";

async function enrichAuditLogs(rawLogs: any[]) {
  const familyIds = new Set<string>();
  const breakerKeys = ["defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId"];

  for (const log of rawLogs) {
    if (log.details) {
      try {
        const parsed = JSON.parse(log.details);
        for (const k of breakerKeys) {
          if (parsed && parsed[k]) familyIds.add(String(parsed[k]));
        }
      } catch {
        // ignore JSON parse error
      }
    }
  }

  const familyMap = new Map<string, string>();
  if (familyIds.size > 0 && db.breakerFamily?.findMany) {
    try {
      const families = await db.breakerFamily.findMany({
        where: { id: { in: Array.from(familyIds) } },
        select: { id: true, name: true, manufacturer: true },
      });
      for (const fam of families) {
        familyMap.set(fam.id, `${fam.manufacturer} ${fam.name}`);
      }
    } catch (e) {
      console.error("Failed to query breaker families for log enrichment:", e);
    }
  }

  return rawLogs.map((log) => enrichLegacyAuditLog(log, familyMap));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await verifyProjectAccess(projectId);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const userId = searchParams.get("userId");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const format = searchParams.get("format");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const where: Record<string, unknown> = { projectId };

    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    if (search.trim()) {
      where.OR = [
        { description: { contains: search.trim() } },
        { userName: { contains: search.trim() } },
        { entityType: { contains: search.trim() } },
        { details: { contains: search.trim() } },
      ];
    }

    if (format === "csv") {
      const allLogs = await db.projectAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      const enrichedCsvLogs = await enrichAuditLogs(allLogs);

      const csvRows = [
        "Timestamp,User,Role,Action,Category,Description",
        ...enrichedCsvLogs.map((l) =>
          [
            `"${l.createdAt.toISOString ? l.createdAt.toISOString() : new Date(l.createdAt).toISOString()}"`,
            `"${(l.userName || "System").replace(/"/g, '""')}"`,
            `"${(l.userRole || "").replace(/"/g, '""')}"`,
            `"${l.action}"`,
            `"${l.entityType}"`,
            `"${(l.description || "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ];

      return new Response(csvRows.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="project-${projectId}-audit-log.csv"`,
        },
      });
    }

    const [rawLogs, totalCount, activeUserLogs] = await Promise.all([
      db.projectAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.projectAuditLog.count({ where }),
      db.projectAuditLog.findMany({
        where: { projectId, userId: { not: null } },
        select: { userId: true, userName: true },
        distinct: ["userId"],
      }),
    ]);

    const activeUsers = activeUserLogs
      .filter((u) => u.userId)
      .map((u) => ({ userId: u.userId as string, userName: u.userName }));

    const logs = await enrichAuditLogs(rawLogs);

    return NextResponse.json({
      logs,
      totalCount,
      limit,
      offset,
      activeUsers,
    });
  } catch (error) {
    console.error("GET Project Audit Logs Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

