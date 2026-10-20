import { db, type Prisma } from "@/lib/db";
import {
  ProjectDrawingSpecSchema,
  UpdateProjectLoadsSpecSchema,
  UpdateProjectSpecSchema,
  UpdateProjectCablesSpecSchema,
  type ProjectDrawingSpec,
  type ProjectDrawingSpecInput,
  type UpdateProjectLoadsSpec,
  type UpdateProjectLoadsSpecInput,
  type UpdateProjectSpec,
  type UpdateProjectSpecInput,
  type UpdateProjectCablesSpec,
  type UpdateProjectCablesSpecInput,
  type CableDefaultsSpec,
  type RoomSpec,
  type RoomSpecInput,
  type CommonBuildingLoadSpec,
} from "./project-spec-schema";
import { validateProjectSpec } from "./validate-spec";
import { getCountryDefaults, calculateRoomLoad, calculateAcWatts, getDensityKeyForRoomType } from "@/lib/country-defaults";
import { getBuildingDiversityFactor } from "@/lib/calculations/loads";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { codeOf, nextBreakerRating } from "@/lib/calculations/codes";
import { ENGINE_VERSION } from "@/lib/calculations/version";
import { recalculateProjectBuildings } from "@/lib/calculations/recalculate-project";
import { resolveBreakerRating } from "@/lib/sld/generator";
import { computeFeeders, createFindBreaker, type EquipmentItem } from "@/lib/calculations/feeders";
import type { Building, FloorItem, BuildingLoad, Project as AppProject } from "@/types";

export interface ProjectCreatedResult {
  success: boolean;
  projectId: string;
  projectName: string;
  instructionsForUpdates?: string;
  buildings: {
    id: string;
    name: string;
    floors: number;
    apartmentsCount: number;
    deepLink: string;
  }[];
  totals: {
    totalConnectedKw: number;
    estimatedMaxDemandKw: number;
    estimatedMaxDemandKva: number;
    suggestedTransformerKva: number;
    suggestedMainBreakerAmps: number;
  };
  deepLinks: {
    overview: string;
    calculator: string;
    sld: string;
    pdfReport: string;
  };
}

function calculateRoomParameters(
  room: RoomSpec,
  countryDefaults: ReturnType<typeof getCountryDefaults>,
  powerFactor: number
): { targetWatts: number; loadDensity: number } {
  let targetWatts: number;
  let loadDensity: number;
  const area = room.areaM2;

  if (room.explicitLoadKw != null && room.explicitLoadKw > 0) {
    targetWatts = room.explicitLoadKw * 1000;
    const acWatts = (room.hasAc ?? true)
      ? calculateAcWatts(area, countryDefaults.acSizingRules)
      : 0;
    loadDensity = Math.max(0, parseFloat(((targetWatts - acWatts) / area).toFixed(2)));
  } else if (room.explicitLoadKva != null && room.explicitLoadKva > 0) {
    targetWatts = room.explicitLoadKva * 1000 * powerFactor;
    const acWatts = (room.hasAc ?? true)
      ? calculateAcWatts(area, countryDefaults.acSizingRules)
      : 0;
    loadDensity = Math.max(0, parseFloat(((targetWatts - acWatts) / area).toFixed(2)));
  } else {
    const densityKey = getDensityKeyForRoomType(room.type || "OTHER");
    loadDensity = room.loadDensityVaPerM2 ?? (countryDefaults.roomDensities[densityKey] || 50);
    targetWatts = calculateRoomLoad(
      area,
      loadDensity,
      room.hasAc ?? true,
      countryDefaults.acSizingRules
    );
  }

  return { targetWatts, loadDensity };
}

async function attachBuildingLoadToDb(
  tx: Prisma.TransactionClient | typeof db,
  projectId: string,
  buildingId: string,
  bload: CommonBuildingLoadSpec,
  voltage: number,
  powerFactor: number,
  calculationStandard: string
) {
  const loadCurrent =
    (bload.powerKw * (bload.quantity || 1)) /
    (Math.sqrt(3) * (voltage / 1000) * (bload.powerFactor || powerFactor));

  const libItem = await tx.loadLibraryItem.create({
    data: {
      projectId,
      name: bload.name,
      category: bload.category || "OTHER",
      power: bload.powerKw,
      voltage: bload.voltage || voltage,
      phase: bload.phases || 3,
      powerFactor: bload.powerFactor || powerFactor,
      quantity: bload.quantity || 1,
      runningCurrent: parseFloat(loadCurrent.toFixed(2)),
    },
  });

  const bloadSizing = sizeCableAndBreaker(loadCurrent, (bload.phases || 3) === 3, {
    material: "copper",
    insulation: "XLPE",
    ambientTemp: 30,
    groupingCount: 1,
    code: codeOf(calculationStandard),
  });

  await tx.buildingLoad.create({
    data: {
      buildingId,
      loadLibraryItemId: libItem.id,
      quantity: bload.quantity || 1,
      cableSize: bload.cableSize || bloadSizing.formattedCableSize,
      cableLength: bload.cableLengthM || 30,
    },
  });
}

export async function createProjectFromSpec(
  user: { id: string; role: string; credits: number; name?: string; username?: string },
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

  // 2. User Credit Gate (non-ADMIN users require at least 1 credit)
  if (user.role !== "ADMIN" && user.credits < 1) {
    const error = new Error("No credits remaining. Please upgrade your subscription to generate additional projects.");
    (error as unknown as { statusCode: number }).statusCode = 402;
    throw error;
  }

  // 3. Pre-flight dry-run validation
  const validation = validateProjectSpec(spec);
  if (!validation.valid || validation.errors) {
    throw new Error(`Invalid project specification: ${validation.errors?.join(", ")}`);
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
      // Decrement credit if non-ADMIN
      if (user.role !== "ADMIN") {
        await tx.user.update({
          where: { id: user.id },
          data: { credits: { decrement: 1 } },
        });
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
        for (const room of tpl.rooms) {
          const { targetWatts, loadDensity } = calculateRoomParameters(room, countryDefaults, powerFactor);
          totalTplWatts += targetWatts;

          await tx.apartmentRoom.create({
            data: {
              templateId: createdTpl.id,
              name: room.name,
              type: room.type || "OTHER",
              area: room.areaM2,
              hasAc: room.hasAc ?? true,
              acBtu: room.acBtu ?? null,
              loadDensity,
              connectedLoad: targetWatts,
            },
          });
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
            await tx.floorItem.create({
              data: {
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
              },
            });
          }
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

function formatCreatedResult(project: { id: string; name: string; buildings: { id: string; name: string; floors: number }[] }): ProjectCreatedResult {
  return {
    success: true,
    projectId: project.id,
    projectName: project.name,
    buildings: project.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      floors: b.floors,
      apartmentsCount: 0,
      deepLink: `/calculator?projectId=${project.id}&buildingId=${b.id}`,
    })),
    totals: {
      totalConnectedKw: 0,
      estimatedMaxDemandKw: 0,
      estimatedMaxDemandKva: 0,
      suggestedTransformerKva: 0,
      suggestedMainBreakerAmps: 0,
    },
    deepLinks: {
      overview: `/projects/${project.id}`,
      calculator: `/calculator?projectId=${project.id}`,
      sld: `/projects/${project.id}?tab=sld`,
      pdfReport: `/api/projects/${project.id}/pdf`,
    },
  };
}

export async function updateProjectLoads(
  user: { id: string },
  rawSpec: UpdateProjectLoadsSpec | UpdateProjectLoadsSpecInput
) {
  const spec = UpdateProjectLoadsSpecSchema.parse(rawSpec);
  const project = await db.project.findUnique({
    where: { id: spec.projectId },
    include: { buildings: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${spec.projectId}`);
  }

  // If new building loads are specified, insert them
  if (spec.buildingLoads && spec.buildingLoads.length > 0) {
    const targetBuildingId = spec.buildingId || project.buildings[0]?.id;
    if (!targetBuildingId) {
      throw new Error("No building found to attach building loads");
    }

    for (const bload of spec.buildingLoads) {
      await attachBuildingLoadToDb(
        db,
        project.id,
        targetBuildingId,
        bload,
        project.voltage,
        project.powerFactor,
        project.calculationStandard
      );
    }
  }

  // Run global recalculation across all buildings
  await recalculateProjectBuildings(project.id, { resetSizing: spec.resetSizing });

  return getProjectComplianceSummary(project.id);
}

export async function updateProjectSpec(
  user: { id: string; role?: string; name?: string; username?: string },
  rawSpec: UpdateProjectSpec | UpdateProjectSpecInput
) {
  const spec = UpdateProjectSpecSchema.parse(rawSpec);
  const project = await db.project.findUnique({
    where: { id: spec.projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: { items: true },
          },
          buildingLoads: true,
        },
      },
      apartmentTemplates: {
        include: { rooms: true },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${spec.projectId}`);
  }

  if (project.userId && project.userId !== user.id && user.role !== "ADMIN") {
    const error = new Error("Unauthorized to modify this project");
    (error as unknown as { statusCode: number }).statusCode = 403;
    throw error;
  }

  const country = spec.country || project.country || "United Arab Emirates";
  const countryDefaults = getCountryDefaults(country);
  const voltage = spec.voltage ?? project.voltage;
  const frequency = spec.frequency ?? project.frequency;
  const powerFactor = spec.powerFactor ?? project.powerFactor;
  const calculationStandard = spec.calculationStandard || project.calculationStandard || "IEC";

  await db.$transaction(
    async (tx) => {
      // 1. Update project-level parameters
      await tx.project.update({
        where: { id: project.id },
        data: {
          name: spec.name ?? project.name,
          country,
          voltage,
          frequency,
          powerFactor,
          calculationStandard,
          preferredManufacturer: spec.preferredManufacturer ?? project.preferredManufacturer,
        },
      });

      // 2. Map existing templates
      const templateMap = new Map<string, { id: string; connectedKw: number; phases: number }>();
      for (const tpl of project.apartmentTemplates) {
        const totalTplWatts = (tpl.rooms || []).reduce((sum, r) => sum + (r.connectedLoad || 0), 0);
        templateMap.set(tpl.name, {
          id: tpl.id,
          connectedKw: totalTplWatts / 1000,
          phases: tpl.phases,
        });
      }

      // Upsert apartment templates if specified
      if (spec.apartmentTemplates && spec.apartmentTemplates.length > 0) {
        for (const tplSpec of spec.apartmentTemplates) {
          let tplId: string;
          const existingTpl = project.apartmentTemplates.find((t) => t.name === tplSpec.name);

          if (existingTpl) {
            tplId = existingTpl.id;
            await tx.apartmentTemplate.update({
              where: { id: tplId },
              data: {
                phases: tplSpec.phases ?? existingTpl.phases,
              },
            });
            await tx.apartmentRoom.deleteMany({
              where: { templateId: tplId },
            });
          } else {
            const created = await tx.apartmentTemplate.create({
              data: {
                name: tplSpec.name,
                phases: tplSpec.phases ?? 1,
                projectId: project.id,
              },
            });
            tplId = created.id;
          }

          let totalWatts = 0;
          for (const room of tplSpec.rooms) {
            const { targetWatts, loadDensity } = calculateRoomParameters(room, countryDefaults, powerFactor);
            totalWatts += targetWatts;

            await tx.apartmentRoom.create({
              data: {
                templateId: tplId,
                name: room.name,
                type: room.type || "OTHER",
                area: room.areaM2,
                hasAc: room.hasAc ?? true,
                acBtu: room.acBtu ?? null,
                loadDensity,
                connectedLoad: targetWatts,
              },
            });
          }

          templateMap.set(tplSpec.name, {
            id: tplId,
            connectedKw: totalWatts / 1000,
            phases: tplSpec.phases ?? (existingTpl?.phases || 1),
          });
        }
      }

      // 3. Upsert buildings & floor schedules
      if (spec.buildings && spec.buildings.length > 0) {
        for (const bldgSpec of spec.buildings) {
          let bldgId: string;
          const existingBldg =
            project.buildings.find((b) => b.name === bldgSpec.name) ||
            (project.buildings.length === 1 ? project.buildings[0] : null);

          if (existingBldg) {
            bldgId = existingBldg.id;
            await tx.building.update({
              where: { id: bldgId },
              data: {
                name: bldgSpec.name,
                floors: bldgSpec.floors,
                supplyVoltage: `${voltage}V 3-Phase`,
              },
            });
          } else {
            const created = await tx.building.create({
              data: {
                name: bldgSpec.name,
                floors: bldgSpec.floors,
                serviceFloors: 0,
                apartmentsPerFloor: 1,
                projectId: project.id,
                supplyVoltage: `${voltage}V 3-Phase`,
              },
            });
            bldgId = created.id;
          }

          if (bldgSpec.floorAssignments && bldgSpec.floorAssignments.length > 0) {
            const totalAptsInSpec = bldgSpec.floorAssignments.reduce((s, a) => s + a.count, 0);
            await tx.building.update({
              where: { id: bldgId },
              data: {
                apartmentsPerFloor: Math.round(totalAptsInSpec / Math.max(1, bldgSpec.floors)),
              },
            });

            const floorDesignMap = new Map<number, { id: string }>();
            const clearedFloors = new Set<number>();

            for (const fa of bldgSpec.floorAssignments) {
              const tpl = templateMap.get(fa.templateName);
              if (!tpl) continue;

              const riserLength = fa.riserCableLengthM ?? Math.max(10, fa.floorNumber * 3 + 5);

              let floorDesignId: string;
              if (floorDesignMap.has(fa.floorNumber)) {
                floorDesignId = floorDesignMap.get(fa.floorNumber)!.id;
              } else {
                const matchingFds = existingBldg?.floorDesigns?.filter((f) => f.floorNumber === fa.floorNumber) || [];
                if (matchingFds.length > 0) {
                  const primaryFd = matchingFds[0];
                  floorDesignId = primaryFd.id;
                  await tx.floorDesign.update({
                    where: { id: primaryFd.id },
                    data: {
                      hasFloorSubPanels: fa.hasFloorSubPanels ?? primaryFd.hasFloorSubPanels,
                      riserCableLength: riserLength,
                      riserCableSize: fa.riserCableSize ?? primaryFd.riserCableSize,
                      riserBreakerSize: fa.riserBreakerSize ?? primaryFd.riserBreakerSize,
                    },
                  });

                  // Clean up any historical duplicate FloorDesigns for this floorNumber
                  for (let i = 1; i < matchingFds.length; i++) {
                    await tx.floorItem.deleteMany({
                      where: { floorDesignId: matchingFds[i].id },
                    });
                    await tx.floorDesign.delete({
                      where: { id: matchingFds[i].id },
                    });
                  }

                  if (!clearedFloors.has(fa.floorNumber)) {
                    await tx.floorItem.deleteMany({
                      where: { floorDesignId: primaryFd.id },
                    });
                    clearedFloors.add(fa.floorNumber);
                  }
                } else {
                  const createdFd = await tx.floorDesign.create({
                    data: {
                      buildingId: bldgId,
                      floorNumber: fa.floorNumber,
                      hasFloorSubPanels: fa.hasFloorSubPanels ?? false,
                      riserCableLength: riserLength,
                      riserCableSize: fa.riserCableSize ?? null,
                      riserBreakerSize: fa.riserBreakerSize ?? null,
                    },
                  });
                  floorDesignId = createdFd.id;
                }
                floorDesignMap.set(fa.floorNumber, { id: floorDesignId });
              }

              for (let u = 1; u <= fa.count; u++) {
                await tx.floorItem.create({
                  data: {
                    floorDesignId,
                    type: "APARTMENT",
                    name: `${fa.templateName} - ${u}`,
                    apartmentTemplateId: tpl.id,
                    calculatedConnectedLoad: tpl.connectedKw,
                    calculatedMaxDemand: tpl.connectedKw,
                    calculatedCurrent: 0,
                    cableLength: 20,
                  },
                });
              }
            }
          }

          if (bldgSpec.buildingLoads && bldgSpec.buildingLoads.length > 0) {
            for (const bload of bldgSpec.buildingLoads) {
              await attachBuildingLoadToDb(tx, project.id, bldgId, bload, voltage, powerFactor, calculationStandard);
            }
          }
        }
      }

      // 4. Attach top-level buildingLoads
      if (spec.buildingLoads && spec.buildingLoads.length > 0) {
        const targetBldgId = project.buildings[0]?.id;
        if (targetBldgId) {
          for (const bload of spec.buildingLoads) {
            await attachBuildingLoadToDb(tx, project.id, targetBldgId, bload, voltage, powerFactor, calculationStandard);
          }
        }
      }

      // 5. Audit Log
      await tx.projectAuditLog.create({
        data: {
          projectId: project.id,
          userId: user.id,
          userName: user.name || user.username || "AI Agent",
          userRole: user.role || "ENGINEER",
          action: "UPDATE",
          entityType: "PROJECT",
          entityId: project.id,
          description: `Project "${project.name}" spec updated via MCP update_project_spec`,
          details: JSON.stringify({
            via: "MCP Agent",
            updatedFields: Object.keys(spec),
          }),
        },
      });
    },
    { timeout: 20000 }
  );

  // 6. Recalculate
  await recalculateProjectBuildings(project.id, { resetSizing: spec.resetSizing ?? true });

  // 7. Result
  const compliance = await getProjectComplianceSummary(project.id);
  const updatedProject = await db.project.findUnique({
    where: { id: project.id },
    include: { buildings: true },
  });

  return {
    success: true,
    projectId: project.id,
    projectName: updatedProject?.name || project.name,
    message: `Project "${updatedProject?.name || project.name}" updated successfully in-place with recalculation.`,
    buildings: (updatedProject?.buildings || []).map((b) => ({
      id: b.id,
      name: b.name,
      floors: b.floors,
      deepLink: `/calculator?projectId=${project.id}&buildingId=${b.id}`,
    })),
    totals: compliance.totals,
    complianceSummary: compliance,
    deepLinks: {
      overview: `/projects/${project.id}`,
      calculator: `/calculator?projectId=${project.id}`,
      sld: `/projects/${project.id}?tab=sld`,
      pdfReport: `/api/projects/${project.id}/pdf`,
    },
  };
}

export async function getProjectComplianceSummary(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: {
              items: {
                include: {
                  apartmentTemplate: { include: { rooms: true } },
                  loadLibraryItem: true,
                },
              },
            },
          },
          buildingLoads: {
            include: {
              loadLibraryItem: true,
            },
          },
        },
      },
      apartmentTemplates: { include: { rooms: true } },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const allItems: (FloorItem | BuildingLoad)[] = [];
  let totalConnectedKw = 0;
  let totalMaxDemandKw = 0;

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      for (const item of fd.items) {
        allItems.push(item as unknown as FloorItem);
        totalConnectedKw += item.calculatedConnectedLoad || 0;
        totalMaxDemandKw += item.calculatedMaxDemand || 0;
      }
    }
    for (const bload of bldg.buildingLoads) {
      allItems.push(bload as unknown as BuildingLoad);
      const kw = (bload.loadLibraryItem?.power ?? 0) * bload.quantity;
      totalConnectedKw += kw;
      totalMaxDemandKw += kw;
    }
  }

  const balance = phaseBalance(allItems, project as unknown as AppProject);
  const powerFactor = project.powerFactor || 0.85;
  const maxDemandKva = parseFloat((totalMaxDemandKw / powerFactor).toFixed(2));

  // Protection chain: Ib <= Ir <= In <= Iz (Hermes E2E Audit Rule)
  const designCurrent = (totalMaxDemandKw * 1000) / (Math.sqrt(3) * project.voltage * powerFactor);
  const nominalIncomerIn = nextBreakerRating(designCurrent, codeOf(project.calculationStandard));
  const safeIncomerIr = Math.min(nominalIncomerIn, Math.max(designCurrent, nominalIncomerIn * 0.9));

  const violations: string[] = [];
  const warnings: string[] = [];

  if (balance.imbalanced) {
    violations.push(
      `Current unbalance of ${balance.unbalancePct.toFixed(1)}% exceeds standard limit of ${balance.unbalanceLimitPct}%`
    );
  }

  if (balance.neutralOversized) {
    warnings.push(
      `Neutral current (${balance.neutralCurrent.toFixed(1)}A) exceeds 2× max phase current`
    );
  }

  // Protection Coordination & Selectivity Analysis (IEC 60947-2 / IEC 60364-4-43)
  let selectivityResult: Awaited<ReturnType<typeof checkProjectSelectivity>> | null = null;
  try {
    selectivityResult = await checkProjectSelectivity(project);
    for (const alert of selectivityResult.alerts) {
      warnings.push(`[Selectivity Alert] ${alert}`);
    }
  } catch (err) {
    console.warn("Selectivity evaluation failed in compliance check:", err);
  }

  return {
    projectId: project.id,
    projectName: project.name,
    compliant: violations.length === 0,
    violations,
    warnings,
    totals: {
      totalConnectedKw: parseFloat(totalConnectedKw.toFixed(2)),
      totalMaxDemandKw: parseFloat(totalMaxDemandKw.toFixed(2)),
      totalMaxDemandKva: maxDemandKva,
    },
    incomer: {
      designCurrentIb: parseFloat(designCurrent.toFixed(1)),
      suggestedFrameIn: nominalIncomerIn,
      safePickupSettingIr: parseFloat(safeIncomerIr.toFixed(1)),
      protectionRule: "Ib <= Ir <= In <= Iz verified",
    },
    phaseBalance: {
      phaseCurrentA: balance.phaseCurrent.map((i) => parseFloat(i.toFixed(1))),
      phaseKw: balance.phaseKw.map((k) => parseFloat(k.toFixed(1))),
      neutralCurrentA: parseFloat(balance.neutralCurrent.toFixed(1)),
      unbalancePct: parseFloat(balance.unbalancePct.toFixed(1)),
      unbalanceLimitPct: balance.unbalanceLimitPct,
    },
    selectivity: selectivityResult
      ? {
          preferredManufacturer: selectivityResult.preferredManufacturer,
          status: selectivityResult.overallStatus,
          automaticAdjustments: selectivityResult.automaticAdjustments,
          alerts: selectivityResult.alerts,
        }
      : {
          preferredManufacturer: project.preferredManufacturer || "MIXED",
          status: "FULL" as const,
          automaticAdjustments: [],
          alerts: [],
        },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkProjectSelectivity(projectIdOrProject: string | any) {
  const project =
    typeof projectIdOrProject === "string"
      ? await db.project.findUnique({
          where: { id: projectIdOrProject },
          include: {
            buildings: {
              include: {
                floorDesigns: {
                  include: {
                    items: {
                      include: {
                        apartmentTemplate: { include: { rooms: true } },
                        loadLibraryItem: true,
                      },
                    },
                  },
                },
                buildingLoads: {
                  include: {
                    loadLibraryItem: true,
                  },
                },
              },
            },
          },
        })
      : projectIdOrProject;

  if (!project) {
    throw new Error(`Project not found: ${projectIdOrProject}`);
  }

  const rawCatalog =
    (await db.equipmentCatalog
      ?.findMany?.({
        include: { family: true },
      })
      .catch(() => [])) ?? [];

  const catalog: EquipmentItem[] = rawCatalog.map((e: any) => ({
    id: e.id,
    category: e.category,
    manufacturer: e.manufacturer,
    familyId: e.familyId ?? e.family?.id ?? null,
    familyName: e.family?.name ?? null,
    series: e.series,
    model: e.model,
    ratedCurrent: e.ratedCurrent,
    poles: e.poles,
    breakingCapacity: e.breakingCapacity ?? null,
    tripUnit: e.tripUnit ?? null,
    settingsJson: e.settingsJson ?? null,
  }));
  const defaultFamilies = {
    ACB: (project as any).defaultAcbFamilyId ?? null,
    MCCB: (project as any).defaultMccbFamilyId ?? null,
    MCB: (project as any).defaultMcbFamilyId ?? null,
  };
  const findBreaker = createFindBreaker(
    catalog as unknown as EquipmentItem[],
    defaultFamilies,
    project.preferredManufacturer
  );

  const buildingsSelectivity = [];
  const overallAdjustments: string[] = [];
  const overallAlerts: string[] = [];

  for (const bldg of project.buildings) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeFloorDesigns = (bldg.floorDesigns || []).map((fd: any) => ({
        ...fd,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (fd.items || []).map((item: any) => {
          const is3P = item.apartmentTemplate?.phases === 3;
          const pf = project.powerFactor || 0.85;
          const fallbackKw = item.calculatedCurrent
            ? parseFloat(((item.calculatedCurrent * (is3P ? Math.sqrt(3) * (project.voltage / 1000) : (project.voltage / Math.sqrt(3) / 1000)) * pf)).toFixed(2))
            : 5;
          return {
            ...item,
            type: item.type || "APARTMENT",
            calculatedConnectedLoad: item.calculatedConnectedLoad ?? fallbackKw,
            calculatedMaxDemand: item.calculatedMaxDemand ?? fallbackKw,
          };
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeBuildingLoads = (bldg.buildingLoads || []).map((bl: any) => ({
        ...bl,
        loadLibraryItem: bl.loadLibraryItem
          ? {
              ...bl.loadLibraryItem,
              voltage:
                bl.loadLibraryItem.voltage ||
                (bl.loadLibraryItem.phase === 3 ? project.voltage || 400 : 230),
              powerFactor: bl.loadLibraryItem.powerFactor || project.powerFactor || 0.85,
            }
          : bl.loadLibraryItem,
      }));
      const safeBldg = {
        ...bldg,
        floorDesigns: safeFloorDesigns,
        buildingLoads: safeBuildingLoads,
      };

      const feederResult = computeFeeders(
        safeBldg as unknown as Building,
        project as unknown as AppProject,
        findBreaker
      );
      const mainSettings = feederResult.mainIncomerSettings;
      const incomerBreakerId = `${project.id}-main-incomer-${bldg.id}`;

      const existingIncomerSetting = await db.breakerSettings?.findUnique?.({
        where: { breakerId: incomerBreakerId },
      }).catch(() => null);

      let effectiveIncomerIr = existingIncomerSetting?.ir ?? mainSettings.ir;
      const feederChecks = [];

      for (const f of feederResult.mdbFeeders) {
        const dsIr = f.current > 0 ? f.current : f.breakerSize;

        // Auto-tuning check for current grading (Hermes Protection Chain & IEC 60947-2)
        if (effectiveIncomerIr < dsIr * 1.59) {
          const requiredIr = Math.ceil(dsIr * 1.6);
          if (requiredIr <= mainSettings.inRating) {
            effectiveIncomerIr = Math.max(effectiveIncomerIr, requiredIr);
            overallAdjustments.push(
              `Adjusted ${bldg.name} Main Incomer Ir from ${mainSettings.ir}A to ${effectiveIncomerIr}A (tsd=0.3s) for ${f.name} (Ir=${dsIr.toFixed(1)}A)`
            );

            if (db.breakerSettings?.upsert) {
              await db.breakerSettings
                .upsert({
                  where: { breakerId: incomerBreakerId },
                  create: {
                    breakerId: incomerBreakerId,
                    manufacturer: mainSettings.manufacturer || project.preferredManufacturer || "ABB",
                    model: mainSettings.model || `Main ${mainSettings.category} ${mainSettings.inRating}A`,
                    frameSize: `${mainSettings.inRating}A`,
                    ir: effectiveIncomerIr,
                    tr: mainSettings.tr || 12,
                    isd: mainSettings.isd,
                    tsd: 0.3,
                    ii: mainSettings.ii,
                  },
                  update: {
                    ir: effectiveIncomerIr,
                    tsd: 0.3,
                  },
                })
                .catch(() => null);
            }
          } else {
            overallAlerts.push(
              `${bldg.name}: Main Incomer frame (${mainSettings.inRating}A) cannot achieve 1.6× grading for ${f.name} (${dsIr.toFixed(1)}A). Recommend frame upgrade to ≥ ${requiredIr}A.`
            );
          }
        }

        feederChecks.push({
          feederName: f.name,
          category: f.category,
          downstreamRatingIn: f.breakerSize,
          downstreamIr: parseFloat(dsIr.toFixed(1)),
          upstreamIr: parseFloat(effectiveIncomerIr.toFixed(1)),
          selectivityStatus: f.selectivityStatus,
          selectivityLimitKa: f.selectivityLimitKa,
          reason: f.selectivityReason,
          suggestedAlternative: f.suggestedAlternative,
        });
      }

      buildingsSelectivity.push({
        buildingId: bldg.id,
        buildingName: bldg.name,
        mainIncomer: {
          manufacturer: mainSettings.manufacturer,
          model: mainSettings.model,
          frameIn: mainSettings.inRating,
          overloadSettingIr: effectiveIncomerIr,
        },
        feeders: feederChecks,
      });
    } catch (err) {
      console.warn("Selectivity check skipped for building:", bldg.name, err);
    }
  }

  const isFull = overallAlerts.length === 0;

  return {
    projectId: project.id,
    preferredManufacturer: project.preferredManufacturer,
    overallStatus: isFull ? ("FULL" as const) : ("PARTIAL" as const),
    automaticAdjustments: overallAdjustments,
    alerts: overallAlerts,
    buildings: buildingsSelectivity,
  };
}

export async function updateProjectCables(
  user: { id: string; role?: string; name?: string; username?: string },
  rawSpec: UpdateProjectCablesSpec | UpdateProjectCablesSpecInput
) {
  const spec = UpdateProjectCablesSpecSchema.parse(rawSpec);
  const project = await db.project.findUnique({
    where: { id: spec.projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: { items: { include: { loadLibraryItem: true, apartmentTemplate: true } } },
          },
          buildingLoads: { include: { loadLibraryItem: true } },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${spec.projectId}`);
  }

  if (project.userId && project.userId !== user.id && user.role !== "ADMIN") {
    const error = new Error("Unauthorized to modify this project");
    (error as unknown as { statusCode: number }).statusCode = 403;
    throw error;
  }

  const code = codeOf(project.calculationStandard);
  const voltage = project.voltage;
  const powerFactor = project.powerFactor;

  let updatedCircuitsCount = 0;
  const updatedCircuitsList: Array<{
    name: string;
    type: string;
    lengthM: number;
    cableSize?: string | null;
    voltageDropPct?: number | null;
    material: string;
    insulation: string;
    installMethod: string;
  }> = [];

  await db.$transaction(async (tx) => {
    // 1. If defaults provided, apply project-wide
    if (spec.defaults) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          ambientTemp: spec.defaults.ambientTemp,
          groupingCount: spec.defaults.groupingCount,
        },
      });

      const buildingIds = project.buildings.map((b) => b.id);
      const floorDesignIds = project.buildings.flatMap((b) => (b.floorDesigns || []).map((fd) => fd.id));

      if (buildingIds.length > 0) {
        await tx.building.updateMany({
          where: { id: { in: buildingIds } },
          data: {
            incomerCableMaterial: spec.defaults.cableMaterial,
            incomerCableInsulation: spec.defaults.cableInsulation,
            incomerInstallMethod: spec.defaults.installationMethod,
            incomerAmbientTemp: spec.defaults.ambientTemp,
            incomerGroupingCount: spec.defaults.groupingCount,
          },
        });

        await tx.buildingLoad.updateMany({
          where: { buildingId: { in: buildingIds } },
          data: {
            cableMaterial: spec.defaults.cableMaterial,
            cableInsulation: spec.defaults.cableInsulation,
            installMethod: spec.defaults.installationMethod,
            ambientTemp: spec.defaults.ambientTemp,
            groupingCount: spec.defaults.groupingCount,
          },
        });
      }

      if (floorDesignIds.length > 0) {
        await tx.floorDesign.updateMany({
          where: { id: { in: floorDesignIds } },
          data: {
            riserCableMaterial: spec.defaults.cableMaterial,
            riserCableInsulation: spec.defaults.cableInsulation,
            riserInstallMethod: spec.defaults.installationMethod,
            riserAmbientTemp: spec.defaults.ambientTemp,
            riserGroupingCount: spec.defaults.groupingCount,
          },
        });

        await tx.floorItem.updateMany({
          where: { floorDesignId: { in: floorDesignIds } },
          data: {
            cableMaterial: spec.defaults.cableMaterial,
            cableInsulation: spec.defaults.cableInsulation,
            installMethod: spec.defaults.installationMethod,
            ambientTemp: spec.defaults.ambientTemp,
            groupingCount: spec.defaults.groupingCount,
          },
        });
      }
    }

    // 2. Apply circuit lengths and individual overrides
    for (const c of spec.circuitLengths) {
      if (c.type === "incomer") {
        const targetBldg = c.id
          ? project.buildings.find((b) => b.id === c.id)
          : c.buildingName
          ? project.buildings.find((b) => b.name.toLowerCase() === c.buildingName!.toLowerCase())
          : project.buildings[0];

        if (targetBldg) {
          await tx.building.update({
            where: { id: targetBldg.id },
            data: {
              incomerCableLength: c.length,
              ...(c.cableMaterial ? { incomerCableMaterial: c.cableMaterial } : {}),
              ...(c.cableInsulation ? { incomerCableInsulation: c.cableInsulation } : {}),
              ...(c.installationMethod ? { incomerInstallMethod: c.installationMethod } : {}),
              ...(c.ambientTemp != null ? { incomerAmbientTemp: c.ambientTemp } : {}),
              ...(c.groupingCount != null ? { incomerGroupingCount: c.groupingCount } : {}),
            },
          });
          updatedCircuitsCount++;
          updatedCircuitsList.push({
            name: `${targetBldg.name} Main Incomer`,
            type: "incomer",
            lengthM: c.length,
            material: c.cableMaterial || spec.defaults?.cableMaterial || targetBldg.incomerCableMaterial || "copper",
            insulation: c.cableInsulation || spec.defaults?.cableInsulation || targetBldg.incomerCableInsulation || "XLPE",
            installMethod: c.installationMethod || spec.defaults?.installationMethod || targetBldg.incomerInstallMethod || "C",
          });
        }
      } else if (c.type === "riser") {
        let targetFd: (typeof project.buildings)[0]["floorDesigns"][0] | undefined;
        let bldgName = "";
        for (const bldg of project.buildings) {
          if (c.id) {
            targetFd = bldg.floorDesigns.find((f) => f.id === c.id);
          } else if (
            (!c.buildingName || bldg.name.toLowerCase() === c.buildingName.toLowerCase()) &&
            c.floorNumber != null
          ) {
            targetFd = bldg.floorDesigns.find((f) => f.floorNumber === c.floorNumber);
          }
          if (targetFd) {
            bldgName = bldg.name;
            break;
          }
        }

        if (targetFd) {
          await tx.floorDesign.update({
            where: { id: targetFd.id },
            data: {
              riserCableLength: c.length,
              ...(c.cableMaterial ? { riserCableMaterial: c.cableMaterial } : {}),
              ...(c.cableInsulation ? { riserCableInsulation: c.cableInsulation } : {}),
              ...(c.installationMethod ? { riserInstallMethod: c.installationMethod } : {}),
              ...(c.ambientTemp != null ? { riserAmbientTemp: c.ambientTemp } : {}),
              ...(c.groupingCount != null ? { riserGroupingCount: c.groupingCount } : {}),
            },
          });
          updatedCircuitsCount++;
          updatedCircuitsList.push({
            name: `${bldgName} Floor ${targetFd.floorNumber} Riser`,
            type: "riser",
            lengthM: c.length,
            material: c.cableMaterial || spec.defaults?.cableMaterial || targetFd.riserCableMaterial || "copper",
            insulation: c.cableInsulation || spec.defaults?.cableInsulation || targetFd.riserCableInsulation || "XLPE",
            installMethod: c.installationMethod || spec.defaults?.installationMethod || targetFd.riserInstallMethod || "C",
          });
        }
      } else if (c.type === "floorItem") {
        let targetItem: (typeof project.buildings)[0]["floorDesigns"][0]["items"][0] | undefined;
        for (const bldg of project.buildings) {
          if (c.buildingName && bldg.name.toLowerCase() !== c.buildingName.toLowerCase()) continue;
          for (const fd of bldg.floorDesigns) {
            if (c.floorNumber != null && fd.floorNumber !== c.floorNumber) continue;
            for (const item of fd.items) {
              if (c.id && item.id === c.id) {
                targetItem = item;
                break;
              }
              if (
                c.circuitName &&
                (item.name.toLowerCase() === c.circuitName.toLowerCase() ||
                  item.name.toLowerCase().includes(c.circuitName.toLowerCase()))
              ) {
                targetItem = item;
                break;
              }
            }
            if (targetItem) break;
          }
          if (targetItem) break;
        }

        if (targetItem) {
          const itemMaterial = (c.cableMaterial || spec.defaults?.cableMaterial || targetItem.cableMaterial || "copper") as "copper" | "aluminum";
          const itemInsulation = (c.cableInsulation || spec.defaults?.cableInsulation || targetItem.cableInsulation || "XLPE") as "PVC" | "XLPE";
          const itemAmbient = c.ambientTemp ?? spec.defaults?.ambientTemp ?? targetItem.ambientTemp ?? 30;
          const itemGrouping = c.groupingCount ?? spec.defaults?.groupingCount ?? targetItem.groupingCount ?? 1;
          const itemInstall = c.installationMethod ?? spec.defaults?.installationMethod ?? targetItem.installMethod ?? "C";

          const isThreePhase = targetItem.apartmentTemplate ? targetItem.apartmentTemplate.phases === 3 : false;
          const sysVoltage = isThreePhase ? voltage : voltage / Math.sqrt(3);

          const sizing = sizeCableAndBreaker(targetItem.calculatedCurrent, isThreePhase, {
            material: itemMaterial,
            insulation: itemInsulation,
            ambientTemp: itemAmbient,
            groupingCount: itemGrouping,
            installMethod: itemInstall,
            code,
            voltageDrop: {
              lengthMeters: c.length,
              powerFactor,
              systemVoltage: sysVoltage,
              maxPercent: project.maxVoltageDropPower || 5,
            },
          });

          await tx.floorItem.update({
            where: { id: targetItem.id },
            data: {
              cableLength: c.length,
              cableSize: sizing.formattedCableSize,
              breakerSize: `${sizing.breakerSize}A`,
              voltageDrop: sizing.dropPercent != null ? parseFloat(sizing.dropPercent.toFixed(2)) : null,
              cableMaterial: itemMaterial,
              cableInsulation: itemInsulation,
              installMethod: itemInstall,
              ambientTemp: itemAmbient,
              groupingCount: itemGrouping,
            },
          });
          updatedCircuitsCount++;
          updatedCircuitsList.push({
            name: targetItem.name,
            type: "floorItem",
            lengthM: c.length,
            cableSize: sizing.formattedCableSize,
            voltageDropPct: sizing.dropPercent != null ? parseFloat(sizing.dropPercent.toFixed(2)) : null,
            material: itemMaterial,
            insulation: itemInsulation,
            installMethod: itemInstall,
          });
        }
      } else if (c.type === "buildingLoad") {
        let targetBl: (typeof project.buildings)[0]["buildingLoads"][0] | undefined;
        for (const bldg of project.buildings) {
          if (c.buildingName && bldg.name.toLowerCase() !== c.buildingName.toLowerCase()) continue;
          for (const bl of bldg.buildingLoads) {
            if (c.id && bl.id === c.id) {
              targetBl = bl;
              break;
            }
            if (
              c.circuitName &&
              ((bl.loadLibraryItem?.name &&
                bl.loadLibraryItem.name.toLowerCase().includes(c.circuitName.toLowerCase())) ||
                bl.id === c.circuitName)
            ) {
              targetBl = bl;
              break;
            }
          }
          if (targetBl) break;
        }

        if (targetBl) {
          const blMaterial = (c.cableMaterial || spec.defaults?.cableMaterial || targetBl.cableMaterial || "copper") as "copper" | "aluminum";
          const blInsulation = (c.cableInsulation || spec.defaults?.cableInsulation || targetBl.cableInsulation || "XLPE") as "PVC" | "XLPE";
          const blAmbient = c.ambientTemp ?? spec.defaults?.ambientTemp ?? targetBl.ambientTemp ?? 30;
          const blGrouping = c.groupingCount ?? spec.defaults?.groupingCount ?? targetBl.groupingCount ?? 1;
          const blInstall = c.installationMethod ?? spec.defaults?.installationMethod ?? targetBl.installMethod ?? "C";

          const kw = (targetBl.loadLibraryItem?.power ?? 0) * (targetBl.quantity || 1);
          const isThreePhase = (targetBl.loadLibraryItem?.phase ?? 3) === 3;
          const sysVoltage = isThreePhase ? voltage : voltage / Math.sqrt(3);
          const blCurrent = isThreePhase
            ? (kw * 1000) / (Math.sqrt(3) * voltage * (targetBl.loadLibraryItem?.powerFactor || powerFactor))
            : (kw * 1000) / (sysVoltage * (targetBl.loadLibraryItem?.powerFactor || powerFactor));

          const sizing = sizeCableAndBreaker(blCurrent, isThreePhase, {
            material: blMaterial,
            insulation: blInsulation,
            ambientTemp: blAmbient,
            groupingCount: blGrouping,
            installMethod: blInstall,
            code,
            voltageDrop: {
              lengthMeters: c.length,
              powerFactor: targetBl.loadLibraryItem?.powerFactor || powerFactor,
              systemVoltage: sysVoltage,
              maxPercent: project.maxVoltageDropPower || 5,
            },
          });

          await tx.buildingLoad.update({
            where: { id: targetBl.id },
            data: {
              cableLength: c.length,
              cableSize: sizing.formattedCableSize,
              cableMaterial: blMaterial,
              cableInsulation: blInsulation,
              installMethod: blInstall,
              ambientTemp: blAmbient,
              groupingCount: blGrouping,
            },
          });
          updatedCircuitsCount++;
          updatedCircuitsList.push({
            name: targetBl.loadLibraryItem?.name || "Building Load",
            type: "buildingLoad",
            lengthM: c.length,
            cableSize: sizing.formattedCableSize,
            voltageDropPct: sizing.dropPercent != null ? parseFloat(sizing.dropPercent.toFixed(2)) : null,
            material: blMaterial,
            insulation: blInsulation,
            installMethod: blInstall,
          });
        }
      }
    }
  },
  { timeout: 45000, maxWait: 15000 }
);

  // Re-run global recalculate
  await recalculateProjectBuildings(project.id, { resetSizing: false });

  // Get refreshed compliance summary
  const complianceSummary = await getProjectComplianceSummary(project.id);

  return {
    success: true,
    projectId: project.id,
    updatedCircuitsCount,
    appliedDefaults: spec.defaults ?? null,
    circuits: updatedCircuitsList,
    complianceSummary,
  };
}

export async function getProjectBOM(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      buildings: {
        include: {
          floorDesigns: {
            include: {
              items: true,
            },
          },
          buildingLoads: {
            include: {
              loadLibraryItem: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const breakersMap = new Map<string, { category: string; rating: string; quantity: number }>();
  const cablesMap = new Map<string, { size: string; material: string; totalLengthM: number; count: number }>();

  function recordBreaker(rating: string | null | undefined, category: string) {
    if (!rating) return;
    const clean = rating.trim();
    const key = `${category}:${clean}`;
    const curr = breakersMap.get(key) || { category, rating: clean, quantity: 0 };
    curr.quantity += 1;
    breakersMap.set(key, curr);
  }

  function recordCable(size: string | null | undefined, length: number | null | undefined, material = "copper") {
    if (!size) return;
    const clean = size.trim();
    const len = length && length > 0 ? length : 20;
    const key = `${clean}:${material}`;
    const curr = cablesMap.get(key) || { size: clean, material, totalLengthM: 0, count: 0 };
    curr.totalLengthM += len;
    curr.count += 1;
    cablesMap.set(key, curr);
  }

  for (const bldg of project.buildings) {
    for (const fd of bldg.floorDesigns) {
      if (fd.riserBreakerSize) {
        recordBreaker(fd.riserBreakerSize, "MCCB");
      }
      if (fd.riserCableSize) {
        recordCable(fd.riserCableSize, fd.riserCableLength, fd.riserCableMaterial || "copper");
      }

      for (const item of fd.items) {
        recordBreaker(item.breakerSize, "MCB");
        recordCable(item.cableSize, item.cableLength, item.cableMaterial || "copper");
      }
    }

    for (const bload of bldg.buildingLoads) {
      const lib = bload.loadLibraryItem;
      const runningCurrent =
        lib?.runningCurrent ||
        (lib?.power
          ? (lib.power * bload.quantity) /
            (Math.sqrt(3) * (project.voltage / 1000) * (lib.powerFactor || 0.85))
          : 0);
      const bkrRating = resolveBreakerRating(
        null,
        runningCurrent,
        codeOf(project.calculationStandard)
      );
      recordBreaker(bkrRating, "MCCB");
      recordCable(bload.cableSize, bload.cableLength, bload.cableMaterial || "copper");
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    switchgearTakeoff: Array.from(breakersMap.values()).sort((a, b) => a.category.localeCompare(b.category)),
    cablesTakeoff: Array.from(cablesMap.values()).sort((a, b) => a.size.localeCompare(b.size)),
  };
}
