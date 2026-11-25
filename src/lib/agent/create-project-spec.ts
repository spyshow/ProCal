import { db, type Prisma } from "@/lib/db";
import {
  ProjectDrawingSpecSchema,
  type ProjectDrawingSpec,
  type ProjectDrawingSpecInput,
} from "./project-spec-schema";
import { validateProjectSpec } from "./validate-spec";
import { getCountryDefaults } from "@/lib/country-defaults";
import { getBuildingDiversityFactor } from "@/lib/calculations/loads";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { codeOf } from "@/lib/calculations/codes";
import { ENGINE_VERSION } from "@/lib/calculations/version";
import { TRIAL_MAX_BUILDINGS, TRIAL_MAX_LEVELS, canStartTrial, trialBuildingsError, trialLevelsError } from "@/lib/trial";
import { logProjectActivity } from "@/lib/audit-logger";
import {
  type ProjectCreatedResult,
  calculateRoomParameters,
  attachBuildingLoadToDb,
  formatCreatedResult,
} from "./spec-helpers";

export async function createProjectFromSpec(
  user: { id: string; role: string; credits: number; hasUsedTrial?: boolean | null; name?: string; username?: string },
  rawSpec: ProjectDrawingSpec | ProjectDrawingSpecInput
): Promise<ProjectCreatedResult> {
  const spec = ProjectDrawingSpecSchema.parse(rawSpec);
  // 1. Idempotency Deduplication (60s window)
  if (spec.idempotencyKey) {
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const existingLog = await db.projectAuditLog.findFirst({
      where: {
        userId: user.id,
        action: "CREATE",
        entityType: "PROJECT",
        createdAt: { gte: sixtySecondsAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingLog && existingLog.details) {
      try {
        const details = typeof existingLog.details === "string" ? JSON.parse(existingLog.details) : existingLog.details;
        if (details.idempotencyKey === spec.idempotencyKey) {
          const existingProject = await db.project.findUnique({
            where: { id: existingLog.projectId },
            include: { buildings: true },
          });
          if (existingProject) {
            return formatCreatedResult(existingProject);
          }
        }
      } catch {
        // Continue to fresh creation if parse fails
      }
    }
  }

  // 2. User Credit / Free Trial Gate
  let startAsTrial = false;
  if (user.role !== "ADMIN" && user.credits < 1) {
    const resolvedHasUsedTrial =
      user.hasUsedTrial !== undefined && user.hasUsedTrial !== null
        ? Boolean(user.hasUsedTrial)
        : Boolean(
            (
              await db.user
                ?.findUnique?.({ where: { id: user.id }, select: { hasUsedTrial: true } })
                .catch(() => null)
            )?.hasUsedTrial ?? true
          );

    if (!canStartTrial({ role: user.role, credits: user.credits, hasUsedTrial: resolvedHasUsedTrial })) {
      const error = new Error("No credits remaining. Please upgrade your subscription to generate additional projects.");
      (error as unknown as { statusCode: number }).statusCode = 402;
      throw error;
    }
    startAsTrial = true;
  }

  // 3. Pre-flight dry-run validation
  const validation = validateProjectSpec(spec);
  if (!validation.valid || validation.errors) {
    throw new Error(`Invalid project specification: ${validation.errors?.join(", ")}`);
  }

  if (startAsTrial) {
    if (spec.buildings.length > TRIAL_MAX_BUILDINGS) {
      throw new Error(
        trialBuildingsError(TRIAL_MAX_BUILDINGS) ||
          `Free trial projects are limited to ${TRIAL_MAX_BUILDINGS} building.`
      );
    }
    for (const b of spec.buildings) {
      const lvlErr = trialLevelsError(b.floors, 0);
      if (lvlErr) {
        throw new Error(lvlErr);
      }
      for (const fa of b.floorAssignments || []) {
        if (fa.floorNumber > TRIAL_MAX_LEVELS) {
          throw new Error(
            trialLevelsError(fa.floorNumber, 0) ||
              `Free trial projects are limited to ${TRIAL_MAX_LEVELS} levels.`
          );
        }
      }
    }
  }

  const country = spec.country || "United Arab Emirates";
  const countryDefaults = getCountryDefaults(country);
  const voltage = spec.voltage || countryDefaults.voltage;
  const frequency = spec.frequency || countryDefaults.frequency;
  const powerFactor = spec.powerFactor || countryDefaults.powerFactor;
  const calculationStandard =
    spec.calculationStandard || (country === "United States" ? "NEMA" : "IEC");

  // 4. Interactive Prisma Transaction (15s timeout)
  const result = await db.$transaction(
    async (tx) => {
      // Atomically claim trial OR decrement credit inside the transaction
      if (startAsTrial) {
        const claimed = await tx.user.updateMany({
          where: { id: user.id, hasUsedTrial: false },
          data: { hasUsedTrial: true },
        });
        if (claimed.count !== 1) {
          const error = new Error(
            "Free trial already used. Please purchase credits to create additional projects."
          );
          (error as unknown as { statusCode: number }).statusCode = 402;
          throw error;
        }
      } else if (user.role !== "ADMIN") {
        const spent = await tx.user.updateMany({
          where: { id: user.id, credits: { gte: 1 } },
          data: { credits: { decrement: 1 } },
        });
        if (spent.count !== 1) {
          const error = new Error(
            "No credits remaining. Please upgrade your subscription to generate additional projects."
          );
          (error as unknown as { statusCode: number }).statusCode = 402;
          throw error;
        }
      }

      // Create Project
      const project = await tx.project.create({
        data: {
          name: spec.name,
          client: "",
          consultant: "",
          contractor: "",
          location: country,
          engineer: user.name || user.username || "AI Agent",
          date: new Date().toISOString().split("T")[0],
          country,
          userId: user.id,
          voltage,
          frequency,
          powerFactor,
          calculationStandard,
          preferredManufacturer: spec.preferredManufacturer || "MIXED",
          engineVersion: ENGINE_VERSION,
          isTrial: startAsTrial,
        },
      });

      // Map template name -> template db row
      const createdTemplates = new Map<string, { id: string; connectedKw: number; phases: number }>();

      for (const tpl of spec.apartmentTemplates) {
        const createdTpl = await tx.apartmentTemplate.create({
          data: {
            name: tpl.name,
            phases: tpl.phases ?? 1,
            projectId: project.id,
          },
        });

        let totalTplWatts = 0;
        const roomRows: Prisma.ApartmentRoomCreateManyInput[] = [];
        for (const room of tpl.rooms) {
          const { targetWatts, loadDensity } = calculateRoomParameters(room, countryDefaults, powerFactor);
          totalTplWatts += targetWatts;

          roomRows.push({
            templateId: createdTpl.id,
            name: room.name,
            type: room.type || "OTHER",
            area: room.areaM2,
            hasAc: room.hasAc ?? true,
            acBtu: room.acBtu ?? null,
            loadDensity,
            connectedLoad: targetWatts,
          });
        }
        if (roomRows.length > 0) {
          await tx.apartmentRoom.createMany({ data: roomRows });
        }

        createdTemplates.set(tpl.name, {
          id: createdTpl.id,
          connectedKw: totalTplWatts / 1000,
          phases: tpl.phases ?? 1,
        });
      }

      // Calculate complex-wide residential coincidence factor (IEC 61439-2 Clause 10.10)
      let totalResidentialUnits = 0;
      for (const bldg of spec.buildings) {
        const isCommercial =
          (bldg.name || "").toUpperCase().includes("OFFICE") ||
          (bldg.name || "").toUpperCase().includes("COMMERCIAL") ||
          (bldg.name || "").toUpperCase().includes("RETAIL") ||
          (bldg.name || "").toUpperCase().includes("MALL");
        if (!isCommercial) {
          for (const fa of bldg.floorAssignments) {
            totalResidentialUnits += fa.count;
          }
        }
      }

      const createdBuildingsList: { id: string; name: string; floors: number; apartmentsCount: number }[] = [];

      for (const bldg of spec.buildings) {
        const isCommercial =
          (bldg.name || "").toUpperCase().includes("OFFICE") ||
          (bldg.name || "").toUpperCase().includes("COMMERCIAL") ||
          (bldg.name || "").toUpperCase().includes("RETAIL") ||
          (bldg.name || "").toUpperCase().includes("MALL");

        const aptCountForDiversity = isCommercial ? bldg.floorAssignments.reduce((s, a) => s + a.count, 0) : totalResidentialUnits;
        const diversityFactor = getBuildingDiversityFactor(aptCountForDiversity, bldg.name);

        const totalBldgApts = bldg.floorAssignments.reduce((s, a) => s + a.count, 0);

        const createdBldg = await tx.building.create({
          data: {
            name: bldg.name,
            floors: bldg.floors,
            serviceFloors: 0,
            apartmentsPerFloor: Math.round(totalBldgApts / Math.max(1, bldg.floors)),
            projectId: project.id,
            supplyVoltage: `${voltage}V 3-Phase`,
          },
        });

        createdBuildingsList.push({
          id: createdBldg.id,
          name: createdBldg.name,
          floors: createdBldg.floors,
          apartmentsCount: totalBldgApts,
        });

        // Create Floors and Items (consolidated by floorNumber to prevent duplicate F1 cards and buses)
        const floorDesignMap = new Map<number, { id: string }>();
        const floorItemRows: Prisma.FloorItemCreateManyInput[] = [];

        for (const fa of bldg.floorAssignments) {
          const tpl = createdTemplates.get(fa.templateName);
          if (!tpl) continue;

          let fd = floorDesignMap.get(fa.floorNumber);
          if (!fd) {
            const riserLength = fa.riserCableLengthM ?? Math.max(10, fa.floorNumber * 3 + 5);
            const createdFd = await tx.floorDesign.create({
              data: {
                buildingId: createdBldg.id,
                floorNumber: fa.floorNumber,
                hasFloorSubPanels: fa.hasFloorSubPanels ?? false,
                riserCableLength: riserLength,
                riserCableSize: fa.riserCableSize ?? null,
                riserBreakerSize: fa.riserBreakerSize ?? null,
              },
            });
            fd = { id: createdFd.id };
            floorDesignMap.set(fa.floorNumber, fd);
          }

          const isThreePhase = tpl.phases === 3;
          const connectedKw = tpl.connectedKw;
          const maxDemandKw = connectedKw * diversityFactor;
          const voltageKv = voltage / 1000;

          let calculatedCurrent: number;
          if (isThreePhase) {
            calculatedCurrent = maxDemandKw / (Math.sqrt(3) * voltageKv * powerFactor);
          } else {
            calculatedCurrent = maxDemandKw / ((voltageKv / Math.sqrt(3)) * powerFactor);
          }

          const sizing = sizeCableAndBreaker(calculatedCurrent, isThreePhase, {
            material: "copper",
            insulation: "XLPE",
            ambientTemp: 30,
            groupingCount: 1,
            code: codeOf(calculationStandard),
          });

          for (let u = 1; u <= fa.count; u++) {
            floorItemRows.push({
              floorDesignId: fd.id,
              type: "APARTMENT",
              name: `${fa.templateName} - ${u}`,
              apartmentTemplateId: tpl.id,
              calculatedConnectedLoad: connectedKw,
              calculatedMaxDemand: maxDemandKw,
              calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
              breakerSize: `${sizing.breakerSize}A`,
              cableSize: sizing.formattedCableSize,
              cableLength: 20,
            });
          }
        }

        if (floorItemRows.length > 0) {
          await tx.floorItem.createMany({ data: floorItemRows });
        }

        // Create Common Building Loads
        for (const bload of bldg.buildingLoads || []) {
          await attachBuildingLoadToDb(tx, project.id, createdBldg.id, bload, voltage, powerFactor, calculationStandard);
        }
      }

      // Record Audit Log
      await tx.projectAuditLog.create({
        data: {
          projectId: project.id,
          userId: user.id,
          userName: user.name || user.username || "AI Agent",
          userRole: user.role,
          action: "CREATE",
          entityType: "PROJECT",
          entityId: project.id,
          description: `Project "${project.name}" generated from drawing spec via MCP`,
          details: JSON.stringify({
            via: "MCP Agent",
            idempotencyKey: spec.idempotencyKey || null,
          }),
        },
      });

      return {
        project,
        createdBuildingsList,
        totals: validation.estimatedTotals,
      };
    },
    { timeout: 45000, maxWait: 15000 }
  );

  return {
    success: true,
    projectId: result.project.id,
    projectName: result.project.name,
    isTrial: Boolean((result.project as { isTrial?: boolean }).isTrial ?? startAsTrial),
    instructionsForUpdates: `To modify, correct, or adjust any entry in this project (room areas, templates, floor schedules, loads, or voltage), call 'update_project_spec' with projectId: '${result.project.id}'. NEVER call 'create_project_from_spec' again for this project.`,
    buildings: result.createdBuildingsList.map((b) => ({
      id: b.id,
      name: b.name,
      floors: b.floors,
      apartmentsCount: b.apartmentsCount,
      deepLink: `/calculator?projectId=${result.project.id}&buildingId=${b.id}`,
    })),
    totals: result.totals,
    deepLinks: {
      overview: `/projects/${result.project.id}`,
      calculator: `/calculator?projectId=${result.project.id}`,
      sld: `/projects/${result.project.id}?tab=sld`,
      pdfReport: `/api/projects/${result.project.id}/pdf`,
    },
  };
}

export interface UpgradeTrialResult {
  success: boolean;
  projectId: string;
  projectName: string;
  isTrial: false;
  alreadyUpgraded: boolean;
}

/**
 * Atomically upgrades a Free Trial project to a full project using 1 credit
 * (admins bypass credit deduction). Mirrors POST /api/projects/[id]/upgrade.
 */
export async function upgradeProjectFromTrial(
  user: { id: string; role: string; credits: number; name?: string; username?: string },
  projectId: string
): Promise<UpgradeTrialResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, userId: true, isTrial: true },
  });
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  if (project.userId !== user.id && user.role !== "ADMIN") {
    const err = new Error("Only the project owner can upgrade this project");
    (err as unknown as { statusCode: number }).statusCode = 403;
    throw err;
  }
  if (!project.isTrial) {
    return {
      success: true,
      projectId: project.id,
      projectName: project.name,
      isTrial: false,
      alreadyUpgraded: true,
    };
  }

  let alreadyUpgraded = false;
  await db.$transaction(async (tx) => {
    if (user.role !== "ADMIN") {
      const spent = await tx.user.updateMany({
        where: { id: user.id, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
      if (spent.count !== 1) {
        const err = new Error("No credits remaining. Please purchase credits to upgrade this Free Trial project.");
        (err as unknown as { statusCode: number }).statusCode = 402;
        throw err;
      }
    }
    const flipped = await tx.project.updateMany({
      where: { id: projectId, isTrial: true },
      data: { isTrial: false },
    });
    if (flipped.count !== 1) {
      alreadyUpgraded = true;
    }
  });

  if (!alreadyUpgraded) {
    await logProjectActivity({
      projectId: project.id,
      userId: user.id,
      userName: user.name || user.username || "AI Agent",
      userRole: user.role === "ADMIN" ? "ADMIN" : "PROJECT_MANAGER",
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: project.id,
      description: "Upgraded Free Trial project to full project via MCP (1 credit)",
    });
  }

  return {
    success: true,
    projectId: project.id,
    projectName: project.name,
    isTrial: false,
    alreadyUpgraded,
  };
}
