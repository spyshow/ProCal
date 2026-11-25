import { db, type Prisma } from "@/lib/db";
import type { RoomSpec, CommonBuildingLoadSpec } from "./project-spec-schema";
import { getCountryDefaults, calculateRoomLoad, calculateAcWatts, getDensityKeyForRoomType } from "@/lib/country-defaults";
import { sizeCableAndBreaker } from "@/lib/calculations/cables";
import { codeOf } from "@/lib/calculations/codes";

export interface ProjectCreatedResult {
  success: boolean;
  projectId: string;
  projectName: string;
  isTrial?: boolean;
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

export function calculateRoomParameters(
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

export async function attachBuildingLoadToDb(
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

export function formatCreatedResult(project: { id: string; name: string; isTrial?: boolean | null; buildings: { id: string; name: string; floors: number }[] }): ProjectCreatedResult {
  return {
    success: true,
    projectId: project.id,
    projectName: project.name,
    isTrial: Boolean(project.isTrial),
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
