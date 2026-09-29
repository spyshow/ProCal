import { db } from '@/lib/db';
import { ENGINE_VERSION } from '@/lib/calculations/version';
import { getBuildingDiversityFactor } from '@/lib/calculations/loads';
import { findProjectRow } from './projects';

/**
 * The apartment sizing rule, in one place.
 *
 * This logic existed twice: in `POST /api/buildings/[id]/recalculate`, and in the
 * MCP freshness guard, which described the other as logic it "mirrors". Two
 * copies of an engineering rule, kept in sync by hand, is how a submittal tool
 * ends up writing numbers nobody can defend.
 *
 * `isUndersizedBreaker` is the part that carries real consequence: a manually-set
 * breaker below its circuit's design current is an overload risk, so the rule
 * clears it and lets the engine size it properly. Both former copies did this
 * independently, with subtly different guards.
 *
 * The decision functions are pure and unit-tested in `recalculate.test.ts`.
 */

export interface ApartmentSizingInput {
  voltage: number;
  powerFactor: number;
  diversityFactor: number;
  isThreePhase: boolean;
  rooms: Array<{ connectedLoad: number }>;
  item: {
    voltageDrop: number | null;
    breakerSize: string | null;
    cableSize: string | null;
  };
  /** Operator-requested re-sizing, which clears sizing regardless of the load. */
  resetSizing?: boolean;
}

export interface ApartmentSizing {
  data: Record<string, unknown>;
  current: number;
}

/** True when a breaker was explicitly chosen but is too small for the load. */
export function isUndersizedBreaker(breakerSize: string | null | undefined, designCurrent: number): boolean {
  if (!breakerSize) return false;

  const parsed = parseInt(breakerSize.replace(/[^\d.]/g, ''), 10);
  if (Number.isNaN(parsed)) return false;

  // The 0.1 A gap absorbs the engine's own rounding: a 100 A breaker on a
  // 100.05 A load is correctly sized, not an operator error, and clearing it
  // would make the rule loop.
  return parsed < designCurrent - 0.1;
}

/**
 * Design current in amperes for an apparent-power load.
 *
 * Single-phase uses the phase-to-neutral voltage (V/√3), which is the convention
 * the rest of the app sizes against. Extracted so the max-demand and
 * connected-load call sites below cannot drift apart.
 */
export function designCurrentAmps(
  loadKw: number,
  voltageKv: number,
  powerFactor: number,
  isThreePhase: boolean
): number {
  if (powerFactor <= 0) return 0;
  return isThreePhase
    ? loadKw / (Math.sqrt(3) * voltageKv * powerFactor)
    : loadKw / ((voltageKv / Math.sqrt(3)) * powerFactor);
}

/**
 * Derive the stored columns for one apartment circuit.
 *
 * `data` contains only the fields that need changing, so a correct manual breaker
 * and a real voltage-drop measurement survive untouched.
 */
export function sizeApartmentItem(input: ApartmentSizingInput): ApartmentSizing {
  const { voltage, powerFactor, diversityFactor, isThreePhase, rooms, item } = input;
  const voltageKv = voltage / 1000;

  const connectedLoadVA = rooms.reduce((sum, room) => sum + room.connectedLoad, 0);
  const calculatedConnectedLoad = connectedLoadVA / 1000;
  const calculatedMaxDemand = calculatedConnectedLoad * diversityFactor;

  const calculatedCurrent = designCurrentAmps(
    calculatedMaxDemand,
    voltageKv,
    powerFactor,
    isThreePhase
  );

  const data: Record<string, unknown> = {
    calculatedConnectedLoad,
    calculatedMaxDemand,
    calculatedCurrent: parseFloat(calculatedCurrent.toFixed(2)),
  };

  // 0.1 is the "never sized" sentinel rather than a measurement; clear it so the
  // engine computes a real voltage drop. An explicit reset clears it regardless.
  if (item.voltageDrop === 0.1 || input.resetSizing) {
    data.voltageDrop = null;
  }

  // Fall back to the connected load when the diversity factor has driven demand
  // to zero, otherwise a zero-demand circuit could never be judged undersized.
  const connectedDesignCurrent = designCurrentAmps(
    calculatedConnectedLoad,
    voltageKv,
    powerFactor,
    isThreePhase
  );
  const current = calculatedCurrent > 0 ? calculatedCurrent : connectedDesignCurrent;

  if (input.resetSizing || isUndersizedBreaker(item.breakerSize, current)) {
    data.breakerSize = null;
    data.cableSize = null;
  }

  return { data, current: calculatedCurrent };
}

/** A building name that implies a commercial rather than residential load mix. */
export function isCommercialBuilding(name: string | null | undefined): boolean {
  const upper = (name || '').toUpperCase();
  return (
    upper.includes('OFFICE') ||
    upper.includes('COMMERCIAL') ||
    upper.includes('RETAIL') ||
    upper.includes('MALL')
  );
}

/**
 * Count the residential units in a project, per building.
 *
 * Counts APARTMENT-type circuit items, which is the unit the diversity factor is
 * defined against — not floors. The MCP freshness guard previously used
 * `floorDesigns.length` here, so a 10-storey tower of 4-unit floors was treated
 * as 10 units instead of 40 and stored a different diversity-adjusted demand
 * depending on whether the recalculation came from the UI or from an agent.
 */
export async function countResidentialApartmentsByBuilding(
  projectId: string
): Promise<Array<{ buildingId: string; name: string; isCommercial: boolean; apartmentCount: number }>> {
  const buildings = await db.building.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      floorDesigns: {
        select: {
          items: { where: { type: 'APARTMENT' }, select: { id: true } },
        },
      },
    },
  });

  return buildings.map((b) => ({
    buildingId: b.id,
    name: b.name,
    isCommercial: isCommercialBuilding(b.name),
    apartmentCount: b.floorDesigns.reduce((sum, fd) => sum + fd.items.length, 0),
  }));
}

export interface ApplyApartmentSizingResult {
  itemsRecalculated: number;
}

/**
 * Re-derive every apartment circuit in a project and stamp the engine version.
 *
 * Residential units are counted across the whole project rather than per building,
 * so identical templates get a consistent diversity policy across towers
 * (IEC 61439-2 Clause 10.10).
 */
export async function applyApartmentSizing(projectId: string): Promise<ApplyApartmentSizingResult | null> {
  const project = await findProjectRow(projectId);
  if (!project) return null;

  const powerFactor = project.powerFactor;
  const counts = await countResidentialApartmentsByBuilding(projectId);

  // Residential units are counted across the WHOLE project rather than per
  // building, so identical templates get a consistent diversity policy across
  // towers (IEC 61439-2 Clause 10.10).
  const totalResidentialApts = counts
    .filter((b) => !b.isCommercial)
    .reduce((sum, b) => sum + b.apartmentCount, 0);

  const updates: Array<ReturnType<typeof db.floorItem.update> | ReturnType<typeof db.project.update>> = [];
  let itemsRecalculated = 0;

  for (const building of counts) {
    const items = await db.floorItem.findMany({
      where: { floorDesign: { buildingId: building.buildingId }, type: 'APARTMENT' },
      include: { apartmentTemplate: { include: { rooms: true } } },
    });
    if (items.length === 0) continue;

    const apartmentCount =
      !building.isCommercial && totalResidentialApts > 0 ? totalResidentialApts : items.length;
    const diversityFactor = getBuildingDiversityFactor(apartmentCount, building.name);

    for (const item of items) {
      if (!item.apartmentTemplate) continue;

      const { data } = sizeApartmentItem({
        voltage: project.voltage,
        powerFactor,
        diversityFactor,
        isThreePhase: item.apartmentTemplate.phases === 3,
        rooms: item.apartmentTemplate.rooms,
        item: {
          voltageDrop: item.voltageDrop,
          breakerSize: item.breakerSize,
          cableSize: item.cableSize,
        },
      });

      updates.push(db.floorItem.update({ where: { id: item.id }, data }));
      itemsRecalculated++;
    }
  }

  // Stamp the engine so the next run is a no-op and the UI stops flagging staleness.
  updates.push(
    db.project.update({ where: { id: projectId }, data: { engineVersion: ENGINE_VERSION } })
  );
  await db.$transaction(updates);

  return { itemsRecalculated };
}

export interface ApplyBuildingSizingResult {
  itemsRecalculated: number;
  diversityFactor: number;
  buildingName: string;
}

/**
 * Re-derive one building's apartment circuits.
 *
 * The per-building path behind `POST /api/buildings/[id]/recalculate`. It now
 * shares `sizeApartmentItem` and the project-wide residential count with
 * `applyApartmentSizing`, so a recalculation produces the same stored numbers
 * whichever route triggered it.
 */
export async function applyBuildingSizing(
  buildingId: string,
  options?: { resetSizing?: boolean }
): Promise<ApplyBuildingSizingResult | null> {
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: { id: true, name: true, projectId: true },
  });
  if (!building) return null;

  const project = await findProjectRow(building.projectId);
  if (!project) return null;

  const counts = await countResidentialApartmentsByBuilding(building.projectId);
  const self = counts.find((b) => b.buildingId === buildingId);
  const isCommercial = self?.isCommercial ?? isCommercialBuilding(building.name);

  const items = await db.floorItem.findMany({
    where: { floorDesign: { buildingId }, type: 'APARTMENT' },
    include: { apartmentTemplate: { include: { rooms: true } } },
  });

  const totalResidentialApts = counts
    .filter((b) => !b.isCommercial)
    .reduce((sum, b) => sum + b.apartmentCount, 0);

  const apartmentCount =
    !isCommercial && totalResidentialApts > 0 ? totalResidentialApts : items.length;
  const diversityFactor = getBuildingDiversityFactor(apartmentCount, building.name);

  const updates: Array<ReturnType<typeof db.floorItem.update> | ReturnType<typeof db.project.update>> = [];

  for (const item of items) {
    if (!item.apartmentTemplate) continue;

    const { data } = sizeApartmentItem({
      voltage: project.voltage,
      powerFactor: project.powerFactor,
      diversityFactor,
      isThreePhase: item.apartmentTemplate.phases === 3,
      rooms: item.apartmentTemplate.rooms,
      item: {
        voltageDrop: item.voltageDrop,
        breakerSize: item.breakerSize,
        cableSize: item.cableSize,
      },
      resetSizing: options?.resetSizing ?? false,
    });

    updates.push(db.floorItem.update({ where: { id: item.id }, data }));
  }

  const itemsRecalculated = updates.length;

  updates.push(
    db.project.update({ where: { id: building.projectId }, data: { engineVersion: ENGINE_VERSION } })
  );
  await db.$transaction(updates);

  return { itemsRecalculated, diversityFactor, buildingName: building.name };
}
