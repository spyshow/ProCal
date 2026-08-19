import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyProjectAccess } from "@/lib/project-auth";

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
    const projectId = breakerId.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
    )?.[1];

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
    if (breakerAuth instanceof NextResponse) {
      const coordinationAuth = await verifyProjectAccess(projectId, {
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

    return NextResponse.json(settings);
  } catch (error) {
    console.error("POST BreakerSettings Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
