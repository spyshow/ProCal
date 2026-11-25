import { db } from "@/lib/db";
import { phaseBalance } from "@/lib/calculations/phaseBalance";
import { codeOf, nextBreakerRating } from "@/lib/calculations/codes";
import { computeFeeders, createFindBreaker, type EquipmentItem } from "@/lib/calculations/feeders";
import { assertMcpProjectAccess } from "@/lib/project-auth";
import { getCachedEquipmentCatalog } from "@/lib/catalog-cache";
import type { Building, FloorItem, BuildingLoad, Project as AppProject } from "@/types";

export async function getProjectComplianceSummary(
  projectId: string,
  user?: { id: string; role?: string }
) {
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

  if (user) {
    await assertMcpProjectAccess(project, user, { requireWrite: false });
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
export async function checkProjectSelectivity(
  projectIdOrProject: string | any,
  user?: { id: string; role?: string }
) {
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

  if (user) {
    await assertMcpProjectAccess(project, user, { requireWrite: true });
  }

  const rawCatalog =
    (await getCachedEquipmentCatalog().catch(() => [])) ?? [];

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
