import { NextResponse } from "next/server";
import { db, type Prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseMemberPermissions } from "@/lib/project-permissions";
import { logProjectActivity } from "@/lib/audit-logger";
import { seedDefaultProjectTemplates, seedDefaultLoadLibrary } from "@/lib/project-defaults";
import { validateProjectSettings } from "@/lib/calculations/validate";
import { canStartProject, recordCreditTransaction, spendProjectCredit } from "@/lib/billing/entitlement";

export async function GET(request?: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request?.url ? new URL(request.url) : new URL("http://localhost/api/projects");
    const { searchParams } = url;

    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const limitParamRaw = searchParams.get("limit") || searchParams.get("pageSize");
    const parsedLimit = limitParamRaw ? parseInt(limitParamRaw, 10) : 20;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;

    const offsetParamRaw = searchParams.get("offset");
    const offset = offsetParamRaw !== null ? Math.max(0, parseInt(offsetParamRaw, 10) || 0) : (page - 1) * limit;

    const isAll = searchParams.get("all") === "true" || searchParams.get("all") === "1";
    const search = searchParams.get("search")?.trim() || "";
    const format = searchParams.get("format");

    const userAccessCondition = {
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };

    const where: Prisma.ProjectWhereInput = search
      ? {
          AND: [
            userAccessCondition,
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { client: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
                { consultant: { contains: search, mode: "insensitive" } },
                { contractor: { contains: search, mode: "insensitive" } },
                { engineer: { contains: search, mode: "insensitive" } },
              ],
            },
          ],
        }
      : userAccessCondition;

    const [projects, totalCount] = await Promise.all([
      db.project.findMany({
        where,
        select: {
          id: true,
          name: true,
          client: true,
          consultant: true,
          contractor: true,
          location: true,
          engineer: true,
          country: true,
          voltage: true,
          frequency: true,
          powerFactor: true,
          calculationStandard: true,
          preferredManufacturer: true,
          updatedAt: true,
          userId: true,
          buildings: {
            select: { id: true, name: true, floors: true },
          },
          members: {
            where: { userId: user.id },
            select: { role: true, permissions: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        ...(isAll ? {} : { take: limit, skip: offset }),
      }),
      db.project.count({ where }),
    ]);

    const enriched = projects.map((p) => {
      const isOwner = p.userId === user.id;
      const memberEntry = p.members?.[0];
      const role = isOwner ? "PROJECT_MANAGER" : memberEntry?.role || (user.role === "ADMIN" ? "PROJECT_MANAGER" : "ENGINEER");
      const perms = parseMemberPermissions(memberEntry?.permissions, role);

      return {
        ...p,
        currentMemberRole: role,
        currentMemberPermissions: perms,
        isOwner,
      };
    });

    if (format === "flat") {
      return NextResponse.json(enriched);
    }

    const effectivePage = isAll ? 1 : page;
    const effectiveLimit = isAll ? totalCount : limit;
    const totalPages = isAll ? (totalCount > 0 ? 1 : 0) : (limit > 0 ? Math.ceil(totalCount / limit) : 0);
    const hasMore = isAll ? false : (offset + enriched.length < totalCount);

    return NextResponse.json({
      projects: enriched,
      total: totalCount,
      totalCount,
      page: effectivePage,
      limit: effectiveLimit,
      totalPages,
      hasMore,
    });
  } catch (error: unknown) {
    console.error("GET Projects Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: `Failed to load projects: ${message}` }, { status: 500 });
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
      name,
      client,
      consultant,
      contractor,
      location,
      engineer,
      date,
      voltage,
      frequency,
      powerFactor,
      maxDemandFactor,
      notes,
      preferredManufacturer,
      maxVoltageDropLighting,
      maxVoltageDropPower,
      calculationStandard,
    } = data;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const vNum = voltage !== undefined && voltage !== "" ? parseFloat(voltage) : 400;
    const fNum = frequency !== undefined && frequency !== "" ? parseFloat(frequency) : 50;
    const pfNum = powerFactor !== undefined && powerFactor !== "" ? parseFloat(powerFactor) : 0.85;
    const dfNum = maxDemandFactor !== undefined && maxDemandFactor !== "" ? parseFloat(maxDemandFactor) : 0.8;
    const vdLNum = maxVoltageDropLighting !== undefined && maxVoltageDropLighting !== "" ? parseFloat(maxVoltageDropLighting) : 3;
    const vdPNum = maxVoltageDropPower !== undefined && maxVoltageDropPower !== "" ? parseFloat(maxVoltageDropPower) : 5;

    try {
      validateProjectSettings({
        voltage: vNum,
        frequency: fNum,
        powerFactor: pfNum,
        maxDemandFactor: dfNum,
        maxVoltageDropLighting: vdLNum,
        maxVoltageDropPower: vdPNum,
      });
    } catch (validationErr: unknown) {
      const message = validationErr instanceof Error ? validationErr.message : String(validationErr);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Credit gate lives in @/lib/billing/entitlement so the HTTP route and the
    // MCP create tool cannot drift (Task 3 Step 3). Admins bypass.
    const gate = await canStartProject(user);
    if (!gate.allowed) {
      // A spent subscription quota is reported as 402 with the allowance detail
      // so the client can tell the user to upgrade rather than "buy credits".
      return NextResponse.json(
        {
          error: gate.message ?? "No credits remaining",
          reason: gate.reason,
          tier: gate.tier,
          allowance: gate.allowance,
          usedThisPeriod: gate.usedThisPeriod,
          checkoutUrl: gate.checkoutUrl,
        },
        { status: 402 }
      );
    }

    const projectData = {
      name,
      client: client || "",
      consultant: consultant || "",
      contractor: contractor || "",
      location: location || "",
      engineer: engineer || user.name,
      date: date || new Date().toISOString().split("T")[0],
      voltage: vNum,
      frequency: fNum,
      powerFactor: pfNum,
      maxDemandFactor: dfNum,
      notes: notes || "",
      preferredManufacturer: preferredManufacturer || "MIXED",
      maxVoltageDropLighting: vdLNum,
      maxVoltageDropPower: vdPNum,
      calculationStandard:
        calculationStandard === "NEMA" || calculationStandard === "IEC"
          ? calculationStandard
          : "IEC",
      userId: user.id,
    };

    let project;
    if (gate.reason === "admin_bypass" || gate.reason === "subscription") {
      // No credit spend on these paths, but the creation is still recorded so
      // /billing shows project activity against a subscription too.
      if (gate.reason === "subscription") {
        await recordCreditTransaction({
          userId: user.id,
          delta: 0,
          reason: "PROJECT_SPENT",
          note: `Created project "${name}" (${gate.tier} plan)`,
        });
      }
      project = await db.project.create({ data: projectData });
    } else {
      const spent = await spendProjectCredit(user.id, `Created project "${name}"`);
      if (!spent) {
        return NextResponse.json({ error: "No credits remaining" }, { status: 402 });
      }
      project = await db.project.create({ data: projectData });
    }

    // Automatically create ProjectMember record for creator as PROJECT_MANAGER
    await db.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: "PROJECT_MANAGER",
      },
    });

    // Auto-seed standard apartment templates and equipment loads
    try {
      await seedDefaultProjectTemplates(project.id, project.country);
      await seedDefaultLoadLibrary(project.id);
    } catch (seedErr) {
      console.warn("Failed to auto-seed project defaults:", seedErr);
    }

    await logProjectActivity({
      projectId: project.id,
      userId: user.id,
      userName: user.name || user.username,
      userRole: "PROJECT_MANAGER",
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project.id,
      description: `Created project "${project.name}"`,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("POST Project Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

