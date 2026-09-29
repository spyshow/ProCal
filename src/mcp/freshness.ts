import { computeFloorRiserVd } from '@/lib/calculations/riser';

/**
 * Pure helpers for reading a loaded design graph.
 *
 * The freshness guard and the project loader used to live here alongside the
 * database calls. They are now methods on `AgentApiClient`, because a tool must
 * not choose how an operation is reached — that is the whole point of the client
 * being the single seam. What remains is pure analysis over a graph the client
 * already loaded, which needs no seam at all.
 */

export interface FreshnessResult {
  wasStale: boolean;
  engineVersion: string | null;
  itemsRecalculated: number;
}

/**
 * Per-floor ΔV verdict, for the design-summary tool.
 *
 * Typed loosely on purpose: the caller passes the Prisma include shape from the
 * client's project load, which is structurally compatible with the fields
 * `computeFloorRiserVd` actually reads but is not the `Project` interface.
 */
export function summariseRiser(project: {
  buildings: Array<{
    id: string;
    name: string;
    floorDesigns: Array<{
      floorNumber: number;
      hasFloorSubPanels: boolean;
      items: Array<{
        type: string;
        name: string;
        calculatedCurrent: number;
        calculatedMaxDemand: number;
        calculatedConnectedLoad: number;
        cableSize: string | null;
        cableLength: number | null;
        installMethod: string | null;
        cableInsulation: string | null;
        cableMaterial: string | null;
        ambientTemp: number | null;
        groupingCount: number | null;
        assignedPhase: number | null;
        apartmentTemplateId: string | null;
        apartmentTemplate: { phases: number } | null;
      }>;
    }>;
  }>;
  voltage: number;
  powerFactor: number;
  maxVoltageDropPower: number | null;
}) {
  return project.buildings.flatMap((b) =>
    b.floorDesigns.map((fd) => {
      const vd = computeFloorRiserVd(fd as never, project as never);
      return {
        buildingId: b.id,
        buildingName: b.name,
        floorNumber: fd.floorNumber,
        hasFloorSubPanels: fd.hasFloorSubPanels,
        riserCurrent: vd.riserCurrent,
        riserVdPercent: vd.riserVdPercent,
        branchVdPercent: vd.branchVdPercent,
        totalVdPercent: vd.totalVdPercent,
        totalNoData: vd.totalNoData,
      };
    })
  );
}
