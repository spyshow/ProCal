import type { Prisma } from "@/generated/prisma/client";

/**
 * The full serializable project shape captured at issue time. Kept in one
 * place so the issue route (snapshot producer) and the restore route
 * (snapshot consumer) stay in lockstep.
 */
export const PROJECT_SNAPSHOT_INCLUDE = {
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
      buildingLoads: { include: { loadLibraryItem: true } },
    },
  },
  apartmentTemplates: { include: { rooms: true } },
  loadLibraryItems: true,
} satisfies Prisma.ProjectInclude;

export const REVISION_INCLUDE = {
  createdBy: { select: { username: true } },
} as const;

// ---------------------------------------------------------------------------
// Serialized snapshot shapes. The snapshot is JSON.stringify of the Prisma
// project include above; these are the scalar shapes the restore route writes
// back and the diff lib reads. Shared so producer, consumer, and diff stay in
// lockstep.
// ---------------------------------------------------------------------------

export interface SnapshotRoom {
  id: string;
  type: string;
  name: string;
  area: number;
  hasAc: boolean;
  acBtu: number | null;
  loadDensity: number;
  connectedLoad: number;
}
export interface SnapshotTemplate {
  id: string;
  name: string;
  phases: number;
  rooms?: SnapshotRoom[] | null;
}
export interface SnapshotLoadLibraryItem {
  id: string;
  name: string;
  category: string;
  power: number;
  voltage: number;
  phase: number;
  powerFactor: number;
  demandFactor: number;
  quantity: number;
  runningCurrent: number;
  startingCurrent: number | null;
  notes: string | null;
}
export interface SnapshotItem {
  id: string;
  type: string;
  name: string;
  apartmentTemplateId: string | null;
  loadLibraryItemId: string | null;
  apartmentTemplate?: SnapshotTemplate | null;
  loadLibraryItem?: SnapshotLoadLibraryItem | null;
  calculatedConnectedLoad: number;
  calculatedMaxDemand: number;
  calculatedCurrent: number;
  breakerSize: string | null;
  cableSize: string | null;
  cableLength: number | null;
  voltageDrop: number | null;
  installMethod: string | null;
  cableInsulation: string | null;
  cableMaterial: string | null;
  ambientTemp: number | null;
  groupingCount: number | null;
  assignedPhase: number | null;
}
export interface SnapshotFloorDesign {
  id: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  riserCableLength: number | null;
  riserCableSize: string | null;
  riserBreakerSize: string | null;
  riserInstallMethod: string | null;
  riserCableInsulation: string | null;
  riserCableMaterial: string | null;
  riserAmbientTemp: number | null;
  riserGroupingCount: number | null;
  items?: SnapshotItem[] | null;
}
export interface SnapshotBuildingLoad {
  id: string;
  loadLibraryItemId: string | null;
  loadLibraryItem?: SnapshotLoadLibraryItem | null;
  quantity: number;
  cableSize: string | null;
  cableLength: number | null;
  installMethod: string | null;
  cableInsulation: string | null;
  cableMaterial: string | null;
  ambientTemp: number | null;
  groupingCount: number | null;
  assignedPhase: number | null;
}
export interface SnapshotBuilding {
  id: string;
  name: string;
  floors: number;
  serviceFloors: number;
  apartmentsPerFloor: number;
  mechanicalLoads: string | null;
  generator: number | null;
  transformer: number | null;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  floorDesigns?: SnapshotFloorDesign[] | null;
  buildingLoads?: SnapshotBuildingLoad[] | null;
}
export interface SnapshotProject {
  id: string;
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  date: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  maxDemandFactor: number;
  transformerSize: number | null;
  notes: string | null;
  preferredManufacturer: string;
  defaultAcbFamilyId: string | null;
  defaultMccbFamilyId: string | null;
  defaultMcbFamilyId: string | null;
  country: string;
  logoUrl: string | null;
  calculationStandard: string | null;
  maxVoltageDropLighting: number;
  maxVoltageDropPower: number;
  ambientTemp: number | null;
  groupingCount: number | null;
  buildings?: SnapshotBuilding[] | null;
  apartmentTemplates?: SnapshotTemplate[] | null;
  loadLibraryItems?: SnapshotLoadLibraryItem[] | null;
}
