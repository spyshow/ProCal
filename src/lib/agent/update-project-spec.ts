import { db, type Prisma } from "@/lib/db";
import {
  UpdateProjectLoadsSpecSchema,
  UpdateProjectSpecSchema,
  type UpdateProjectLoadsSpec,
  type UpdateProjectLoadsSpecInput,
  type UpdateProjectSpec,
  type UpdateProjectSpecInput,
} from "./project-spec-schema";
import { getCountryDefaults } from "@/lib/country-defaults";
import { getBuildingDiversityFactor } from "@/lib/calculations/loads";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { codeOf } from "@/lib/calculations/codes";
import { TRIAL_MAX_BUILDINGS, TRIAL_MAX_LEVELS, trialBuildingsError, trialLevelsError } from "@/lib/trial";
import { recalculateProjectBuildings } from "@/lib/calculations/recalculate-project";
import { assertMcpProjectAccess } from "@/lib/project-auth";
import { calculateRoomParameters, attachBuildingLoadToDb } from "./spec-helpers";
import { getProjectComplianceSummary } from "./selectivity-compliance";

export async function updateProjectLoads(
  user: { id: string; role?: string },
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

  await assertMcpProjectAccess(project, user, { requireWrite: true });

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

  await assertMcpProjectAccess(project, user, { requireWrite: true });

  // Free trial caps (1 building, 2 levels) apply to agent edits too.
  if (project.isTrial && spec.buildings && spec.buildings.length > 0) {
    const exceedsBuildingLimit =
      project.buildings.length > TRIAL_MAX_BUILDINGS ||
      spec.buildings.length > TRIAL_MAX_BUILDINGS;
    const trialError =
      (exceedsBuildingLimit ? trialBuildingsError(TRIAL_MAX_BUILDINGS) : null) ||
      spec.buildings
        .map((b) => {
          const existingBldg =
            project.buildings.find((eb) => eb.name === b.name) ||
            (project.buildings.length === 1 && spec.buildings!.length === 1 ? project.buildings[0] : null);
          const levelErr = trialLevelsError(b.floors, existingBldg?.serviceFloors ?? 0);
          if (levelErr) return levelErr;
          const outOfBoundsFa = (b.floorAssignments || []).find((fa) => fa.floorNumber > TRIAL_MAX_LEVELS);
          if (outOfBoundsFa) return trialLevelsError(outOfBoundsFa.floorNumber, 0);
          return null;
        })
        .find(Boolean) ||
      null;
    if (trialError) {
      const error = new Error(trialError);
      (error as unknown as { statusCode: number }).statusCode = 402;
      throw error;
    }
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
          const roomRows: Prisma.ApartmentRoomCreateManyInput[] = [];
          for (const room of tplSpec.rooms) {
            const { targetWatts, loadDensity } = calculateRoomParameters(room, countryDefaults, powerFactor);
            totalWatts += targetWatts;

            roomRows.push({
              templateId: tplId,
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
            (project.buildings.length === 1 && spec.buildings.length === 1 ? project.buildings[0] : null);

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
            const floorItemRows: Prisma.FloorItemCreateManyInput[] = [];

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
                floorItemRows.push({
                  floorDesignId,
                  type: "APARTMENT",
                  name: `${fa.templateName} - ${u}`,
                  apartmentTemplateId: tpl.id,
                  calculatedConnectedLoad: tpl.connectedKw,
                  calculatedMaxDemand: tpl.connectedKw,
                  calculatedCurrent: 0,
                  cableLength: 20,
                });
              }
            }

            if (floorItemRows.length > 0) {
              await tx.floorItem.createMany({ data: floorItemRows });
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
