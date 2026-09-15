import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyProjectAccess } from "@/lib/project-auth";
import { logProjectActivity } from "@/lib/audit-logger";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db.breakerSettings.findMany({
      orderBy: { model: "asc" },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET BreakerSettings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const {
      breakerId,
      model,
      manufacturer,
      frameSize,
      ir,
      tr,
      isd,
      tsd,
      i2t,
      ii,
      ig,
      tg,
    } = data;

    if (!breakerId || !model || !manufacturer || !frameSize) {
      return NextResponse.json(
        { error: "breakerId, model, manufacturer, and frameSize are required" },
        { status: 400 }
      );
    }

    // Breaker settings are keyed per-project ("<projectId>-..."): verify the
    // caller holds EDIT on a breaker-related module before mutating.
    let projectId = data.projectId;
    if (!projectId) {
      const candidateId = breakerId.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      )?.[1];

      if (candidateId) {
        // If candidateId is an item, buildingLoad, or building UUID, resolve its project
        try {
          const floorItem = await db.floorItem?.findUnique?.({
            where: { id: candidateId },
            select: { floorDesign: { select: { building: { select: { projectId: true } } } } },
          });
          if (floorItem?.floorDesign?.building?.projectId) {
            projectId = floorItem.floorDesign.building.projectId;
          } else {
            const bLoad = await db.buildingLoad?.findUnique?.({
              where: { id: candidateId },
              select: { building: { select: { projectId: true } } },
            });
            if (bLoad?.building?.projectId) {
              projectId = bLoad.building.projectId;
            } else {
              const bldg = await db.building?.findUnique?.({
                where: { id: candidateId },
                select: { projectId: true },
              });
              if (bldg?.projectId) {
                projectId = bldg.projectId;
              }
            }
          }
        } catch {
          // ignore lookup failure in test environments
        }

        if (!projectId) {
          projectId = candidateId;
        }
      }
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "breakerId must be scoped to a project" },
        { status: 400 }
      );
    }

    const breakerAuth = await verifyProjectAccess(projectId, {
      requiredAction: "EDIT",
      pageKey: "breakerSchedule",
    });
    let coordinationAuth: any = null;
    if (breakerAuth instanceof NextResponse) {
      coordinationAuth = await verifyProjectAccess(projectId, {
        requiredAction: "EDIT",
        pageKey: "coordination",
      });
      if (coordinationAuth instanceof NextResponse) return coordinationAuth;
    }

    // Upsert: update if exists, create if not
    const settings = await db.breakerSettings.upsert({
      where: { breakerId },
      update: {
        model,
        manufacturer,
        frameSize,
        ir: parseFloat(ir) || 0,
        tr: parseFloat(tr) || 12,
        isd: isd ? parseFloat(isd) : null,
        tsd: tsd ? parseFloat(tsd) : null,
        i2t: i2t ?? null,
        ii: ii ? parseFloat(ii) : null,
        ig: ig ? parseFloat(ig) : null,
        tg: tg ? parseFloat(tg) : null,
      },
      create: {
        breakerId,
        model,
        manufacturer,
        frameSize,
        ir: parseFloat(ir) || 0,
        tr: parseFloat(tr) || 12,
        isd: isd ? parseFloat(isd) : null,
        tsd: tsd ? parseFloat(tsd) : null,
        i2t: i2t ?? null,
        ii: ii ? parseFloat(ii) : null,
        ig: ig ? parseFloat(ig) : null,
        tg: tg ? parseFloat(tg) : null,
      },
    });

    const effectiveAuth = (breakerAuth instanceof NextResponse ? coordinationAuth : breakerAuth) as any;
    await logProjectActivity({
      projectId,
      userId: user.id,
      userName: user.name || user.username,
      userRole: effectiveAuth?.member?.role || "ENGINEER",
      action: "UPDATE",
      entityType: "BREAKER",
      entityId: breakerId,
      description: `Configured trip settings for breaker ${breakerId} (${manufacturer} ${model} ${frameSize}, Ir=${settings.ir}A)`,
      details: {
        breakerId,
        model,
        manufacturer,
        frameSize,
        ir: settings.ir,
        tr: settings.tr,
        isd: settings.isd,
        tsd: settings.tsd,
        ii: settings.ii,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("POST BreakerSettings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
