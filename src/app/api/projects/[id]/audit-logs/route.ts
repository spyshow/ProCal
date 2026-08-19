import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyProjectAccess } from "@/lib/project-auth";

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
      ];
    }

    if (format === "csv") {
      const allLogs = await db.projectAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      const csvRows = [
        "Timestamp,User,Role,Action,Category,Description",
        ...allLogs.map((l) =>
          [
            `"${l.createdAt.toISOString()}"`,
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

    const [logs, totalCount, activeUserLogs] = await Promise.all([
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
