import { ENGINE_VERSION } from '@/lib/calculations/version';
import { computeFloorRiserVd } from '@/lib/calculations/riser';
import { getBuildingDiversityFactor } from '@/lib/calculations/loads';
import { applyApartmentSizing, isCommercialBuilding } from '@/lib/services/recalculate';
import { findProjectRow, loadDesignGraphOrThrow } from '@/lib/services/projects';

/**
 * Freshness guard for exported deliverables (Task 5 Step 3).
 *
 * Most report schedules — cable, MDB, BOM, voltage drop — read the **stored**
 * `FloorItem` columns (`calculatedConnectedLoad`, `calculatedMaxDemand`,
 * `calculatedCurrent`, `breakerSize`, `cableSize`, `voltageDrop`) rather than
 * recomputing. Those columns only change when a recalculate runs. An agent that
 * builds a project and exports immediately would therefore ship a confident,
 * wrong submittal.
 *
 * Every export tool calls `ensureFresh()` first. It is the difference between a
 * plausible deliverable and a correct one.
 */

export interface FreshnessResult {
  wasStale: boolean;
  engineVersion: string | null;
  itemsRecalculated: number;
}

/**
 * Recalculate a project if its stored numbers predate the current engine.
 *
 * Delegates to `src/lib/services/recalculate`, which is the same implementation
 * `POST /api/buildings/[id]/recalculate` uses. This previously carried its own
 * copy of that rule and described the other as one it "mirrors" — two
 * implementations of an overload-safety check, kept in sync by hand.
 */
export async function ensureFresh(projectId: string): Promise<FreshnessResult> {
  const project = await findProjectRow(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (project.engineVersion === ENGINE_VERSION) {
    return {
      wasStale: false,
      engineVersion: project.engineVersion,
      itemsRecalculated: 0,
    };
  }

  const result = await applyApartmentSizing(projectId);

  return {
    wasStale: true,
    engineVersion: ENGINE_VERSION,
    itemsRecalculated: result?.itemsRecalculated ?? 0,
  };
}

/**
 * Re-read a project with everything the calculation engine and report renderer
 * need, in the shape `src/types`' `Project` expects.
 *
 * Shared by the export tools and the design-summary tool so an agent sees the same
 * numbers the report will.
 */
export async function loadProjectForDesign(projectId: string) {
  return loadDesignGraphOrThrow(projectId);
}

/**
 * Per-floor ΔV verdict, for the design-summary tool.
 *
 * Typed loosely on purpose: the caller passes the Prisma include shape from
 * `loadProjectForDesign`, which is structurally compatible with the fields
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
