import { db } from '@/lib/db';
import { seedDefaultProjectTemplates, seedDefaultLoadLibrary } from '@/lib/project-defaults';
import { validateProjectSettings } from '@/lib/calculations/validate';

/**
 * Project-construction writes.
 *
 * These used to live inside MCP tool handlers, which meant the database was only
 * reachable from the agent layer and the rules had no owner other than whichever
 * route happened to call them. They are here now so the MCP tools — and the HTTP
 * routes added in the next phase — share one implementation.
 *
 * Callers are responsible for authorising the caller; these functions assume the
 * permission check has already happened.
 */

export class DesignWriteError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'DesignWriteError';
  }
}

// ---------------------------------------------------------------------------
// Project creation
// ---------------------------------------------------------------------------

export interface ProjectSeedInput {
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  maxDemandFactor: number;
  maxVoltageDropLighting: number;
  maxVoltageDropPower: number;
  calculationStandard: string;
  preferredManufacturer: string;
  ownerId: string;
}

/** Create the Project row, its creator membership, and the default seed data. */
export async function createProjectRow(input: ProjectSeedInput) {
  validateProjectSettings({
    voltage: input.voltage,
    frequency: input.frequency,
    powerFactor: input.powerFactor,
    maxDemandFactor: input.maxDemandFactor,
    maxVoltageDropLighting: input.maxVoltageDropLighting,
    maxVoltageDropPower: input.maxVoltageDropPower,
  });

  const project = await db.project.create({
    data: {
      name: input.name,
      client: input.client,
      consultant: input.consultant,
      contractor: input.contractor,
      location: input.location,
      engineer: input.engineer,
      date: new Date().toISOString().split('T')[0],
      voltage: input.voltage,
      frequency: input.frequency,
      powerFactor: input.powerFactor,
      maxDemandFactor: input.maxDemandFactor,
      maxVoltageDropLighting: input.maxVoltageDropLighting,
      maxVoltageDropPower: input.maxVoltageDropPower,
      calculationStandard: input.calculationStandard,
      preferredManufacturer: input.preferredManufacturer,
      userId: input.ownerId,
    },
  });

  await db.projectMember.create({
    data: { projectId: project.id, userId: input.ownerId, role: 'PROJECT_MANAGER' },
  });

  // Standard templates and the load library power the recalculate engine.
  try {
    await seedDefaultProjectTemplates(project.id, project.country);
    await seedDefaultLoadLibrary(project.id);
  } catch (seedErr) {
    console.warn('design-writes: failed to seed project defaults:', seedErr);
  }

  return project;
}

export interface BuildingSpecInput {
  name: string;
  serviceFloors: number;
  apartmentsPerFloor: number;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  generator: number | null;
  transformer: number | null;
  floors: Array<{
    hasFloorSubPanels?: boolean;
    riserCableSize?: string | null;
    riserCableLength?: number | null;
    riserBreakerSize?: string | null;
    templateName?: string;
    apartmentCount?: number;
    buildingLoadNames?: string[];
    buildingLoadQuantities?: number[];
  }>;
}

export interface CreatedBuilding {
  buildingId: string;
  name: string;
  floors: number;
  circuits: number;
}

/** Create buildings, their floors, apartment circuits, and mechanical loads. */
export async function createBuildingsForSpec(
  projectId: string,
  buildings: BuildingSpecInput[]
): Promise<CreatedBuilding[]> {
  const created: CreatedBuilding[] = [];

  for (const bSpec of buildings) {
    const building = await db.building.create({
      data: {
        name: bSpec.name,
        floors: bSpec.floors.length,
        serviceFloors: bSpec.serviceFloors,
        apartmentsPerFloor: bSpec.apartmentsPerFloor,
        supplyVoltage: bSpec.supplyVoltage,
        earthingSystem: bSpec.earthingSystem,
        lightningProtection: bSpec.lightningProtection,
        generator: bSpec.generator,
        transformer: bSpec.transformer,
        projectId,
      },
    });

    let circuitCount = 0;

    for (let i = 0; i < bSpec.floors.length; i++) {
      const fSpec = bSpec.floors[i];
      const floor = await db.floorDesign.create({
        data: {
          floorNumber: i + 1,
          buildingId: building.id,
          hasFloorSubPanels: fSpec.hasFloorSubPanels,
          riserCableSize: fSpec.riserCableSize,
          riserCableLength: fSpec.riserCableLength,
          riserBreakerSize: fSpec.riserBreakerSize,
        },
      });

      if (fSpec.templateName && (fSpec.apartmentCount ?? 0) > 0) {
        const template = await db.apartmentTemplate.findFirst({
          where: { projectId, name: fSpec.templateName },
        });
        if (!template) {
          throw new DesignWriteError(
            `Apartment template "${fSpec.templateName}" is not defined for this project. Define it in apartmentTemplates first.`
          );
        }
        await db.floorItem.createMany({
          data: Array.from({ length: fSpec.apartmentCount ?? 0 }, () => ({
            type: 'APARTMENT' as const,
            name: 'Apartment',
            floorDesignId: floor.id,
            apartmentTemplateId: template.id,
            installMethod: 'C' as const,
            cableInsulation: 'XLPE' as const,
            cableMaterial: 'copper' as const,
          })),
        });
        circuitCount += fSpec.apartmentCount ?? 0;
      }

      const loadNames = fSpec.buildingLoadNames ?? [];
      for (let k = 0; k < loadNames.length; k++) {
        const libName = loadNames[k];
        const qty = fSpec.buildingLoadQuantities?.[k] ?? 1;
        const lib = await db.loadLibraryItem.findFirst({ where: { projectId, name: libName } });
        if (!lib) {
          throw new DesignWriteError(
            `Load library item "${libName}" not found. Check procal_get_project_brief for available items, or use a known name.`
          );
        }
        await db.buildingLoad.create({
          data: { loadLibraryItemId: lib.id, quantity: qty, buildingId: building.id },
        });
      }
    }

    created.push({
      buildingId: building.id,
      name: building.name,
      floors: bSpec.floors.length,
      circuits: circuitCount,
    });
  }

  return created;
}

// ---------------------------------------------------------------------------
// Apartment templates
// ---------------------------------------------------------------------------

export interface TemplateRoomInput {
  name: string;
  type: string;
  area: number;
  loadDensity: number;
  hasAc?: boolean;
  acBtu?: number | null;
}

/**
 * Create an apartment template, deriving each room's connected load from its area
 * and load density. The agent supplies no engineering values.
 */
export async function createApartmentTemplateRow(params: {
  projectId: string;
  name: string;
  phases: 1 | 3;
  rooms: TemplateRoomInput[];
}) {
  const existing = await db.apartmentTemplate.findFirst({
    where: { projectId: params.projectId, name: params.name },
  });
  if (existing) {
    throw new DesignWriteError(
      `A template named "${params.name}" already exists. Use a different name, or edit the project through the UI.`
    );
  }

  const withLoad = params.rooms.map((r) => ({ ...r, connectedLoad: r.area * r.loadDensity }));

  return db.apartmentTemplate.create({
    data: {
      name: params.name,
      phases: params.phases,
      projectId: params.projectId,
      rooms: { create: withLoad },
    },
    include: { rooms: true },
  });
}

// ---------------------------------------------------------------------------
// Buildings and floors
// ---------------------------------------------------------------------------

export interface BuildingFieldInput {
  name?: string;
  serviceFloors?: number;
  apartmentsPerFloor?: number;
  earthingSystem?: string;
  lightningProtection?: boolean;
  transformer?: number | null;
  generator?: number | null;
}

export interface FloorSpecInput {
  floorNumber: number;
  hasFloorSubPanels?: boolean;
  riserCableSize?: string | null;
  riserCableLength?: number | null;
  riserBreakerSize?: string | null;
}

/**
 * Create or update a building and reconcile its floors.
 *
 * Updating a building requires the caller to have already checked ownership or
 * Project Manager role; this only performs the write.
 */
export async function upsertBuildingRow(params: {
  projectId: string;
  buildingId?: string;
  fields: BuildingFieldInput;
  floors?: FloorSpecInput[];
}) {
  const { projectId, buildingId, fields, floors } = params;

  let building;
  if (buildingId) {
    building = await db.building.update({ where: { id: buildingId }, data: fields });
  } else {
    if (!fields.name) throw new DesignWriteError('name is required to create a building.');
    building = await db.building.create({
      data: {
        name: fields.name,
        // `Building.floors` is the count of FloorDesign rows, which are created
        // or updated in the loop below.
        floors: floors?.length ?? 0,
        serviceFloors: fields.serviceFloors ?? 0,
        apartmentsPerFloor: fields.apartmentsPerFloor ?? 0,
        supplyVoltage: '400V 3-Phase',
        earthingSystem: fields.earthingSystem ?? 'TN-S',
        lightningProtection: fields.lightningProtection ?? false,
        transformer: fields.transformer ?? null,
        generator: fields.generator ?? null,
        projectId,
      },
    });
  }

  const updatedFloors: Array<{ floorNumber: number; hasFloorSubPanels: boolean }> = [];
  for (const f of floors ?? []) {
    const existing = await db.floorDesign.findFirst({
      where: { buildingId: building.id, floorNumber: f.floorNumber },
    });
    if (existing) {
      await db.floorDesign.update({
        where: { id: existing.id },
        data: {
          hasFloorSubPanels: f.hasFloorSubPanels ?? existing.hasFloorSubPanels,
          riserCableSize: f.riserCableSize ?? undefined,
          riserCableLength: f.riserCableLength ?? undefined,
          riserBreakerSize: f.riserBreakerSize ?? undefined,
        },
      });
    } else {
      await db.floorDesign.create({
        data: {
          floorNumber: f.floorNumber,
          buildingId: building.id,
          hasFloorSubPanels: f.hasFloorSubPanels ?? true,
          riserCableSize: f.riserCableSize ?? null,
          riserCableLength: f.riserCableLength ?? null,
          riserBreakerSize: f.riserBreakerSize ?? null,
        },
      });
    }
    updatedFloors.push({
      floorNumber: f.floorNumber,
      hasFloorSubPanels: f.hasFloorSubPanels ?? true,
    });
  }

  return { building, updatedFloors };
}

/**
 * Replace a floor's apartment circuits from a template.
 *
 * Destructive by design: existing circuits on the floor are removed, so callers
 * must pass the full intended count.
 */
export async function assignFloorTemplateRow(params: {
  projectId: string;
  floorDesignId: string;
  templateName: string;
  apartmentCount: number;
}) {
  const floor = await db.floorDesign.findFirst({
    where: { id: params.floorDesignId, building: { projectId: params.projectId } },
  });
  if (!floor) throw new DesignWriteError('Floor not found in this project.', 404);

  const template = await db.apartmentTemplate.findFirst({
    where: { projectId: params.projectId, name: params.templateName },
  });
  if (!template) throw new DesignWriteError(`Template "${params.templateName}" not found.`, 404);

  await db.floorItem.deleteMany({ where: { floorDesignId: params.floorDesignId } });
  if (params.apartmentCount > 0) {
    await db.floorItem.createMany({
      data: Array.from({ length: params.apartmentCount }, (_, i) => ({
        type: 'APARTMENT' as const,
        name: `Apt ${floor.floorNumber}-${i + 1}`,
        floorDesignId: params.floorDesignId,
        apartmentTemplateId: template.id,
        installMethod: 'C' as const,
        cableInsulation: 'XLPE' as const,
        cableMaterial: 'copper' as const,
      })),
    });
  }

  return { floorNumber: floor.floorNumber, apartmentCount: params.apartmentCount };
}

// ---------------------------------------------------------------------------
// Mechanical loads
// ---------------------------------------------------------------------------

export interface BuildingLoadInput {
  name: string;
  quantity: number;
}

export interface AppliedLoad {
  name: string;
  quantity: number;
  powerKw: number;
}

/** Replace a building's mechanical loads from the project load library. */
export async function replaceBuildingLoads(params: {
  projectId: string;
  buildingId: string;
  loads: BuildingLoadInput[];
}): Promise<AppliedLoad[]> {
  const building = await db.building.findFirst({
    where: { id: params.buildingId, projectId: params.projectId },
  });
  if (!building) throw new DesignWriteError('Building not found in this project.', 404);

  const library = await db.loadLibraryItem.findMany({ where: { projectId: params.projectId } });
  const byName = new Map(library.map((l) => [l.name.toLowerCase(), l]));

  // Resolve every name before deleting, so a bad name leaves the building intact.
  const resolved: Array<{ itemId: string; name: string; quantity: number; powerKw: number }> = [];
  for (const l of params.loads) {
    const item = byName.get(l.name.toLowerCase());
    if (!item) {
      throw new DesignWriteError(
        `Load library item "${l.name}" not found. Available: ${library
          .slice(0, 25)
          .map((x) => x.name)
          .join(', ')}${library.length > 25 ? ', …' : ''}`
      );
    }
    resolved.push({
      itemId: item.id,
      name: item.name,
      quantity: l.quantity,
      powerKw: Number((item.power * l.quantity).toFixed(2)),
    });
  }

  await db.buildingLoad.deleteMany({ where: { buildingId: params.buildingId } });
  for (const r of resolved) {
    await db.buildingLoad.create({
      data: { loadLibraryItemId: r.itemId, quantity: r.quantity, buildingId: params.buildingId },
    });
  }

  return resolved.map(({ name, quantity, powerKw }) => ({ name, quantity, powerKw }));
}
