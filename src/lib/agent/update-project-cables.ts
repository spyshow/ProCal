import { db } from "@/lib/db";
import {
  UpdateProjectCablesSpecSchema,
  type UpdateProjectCablesSpec,
  type UpdateProjectCablesSpecInput,
  type CableDefaultsSpec,
} from "./project-spec-schema";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { codeOf } from "@/lib/calculations/codes";
import { assertMcpProjectAccess } from "@/lib/project-auth";
import { recalculateProjectBuildings } from "@/lib/calculations/recalculate-project";
import { getProjectComplianceSummary } from "./selectivity-compliance";

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

  await assertMcpProjectAccess(project, user, { requireWrite: true });

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
