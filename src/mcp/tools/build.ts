import { z } from 'zod';
import { db } from '@/lib/db';
import { logProjectActivity } from '@/lib/audit-logger';
import { seedDefaultProjectTemplates, seedDefaultLoadLibrary } from '@/lib/project-defaults';
import { validateProjectSettings } from '@/lib/calculations/validate';
import { canStartProject, spendProjectCredit } from '@/lib/billing/entitlement';
import { ensureFresh } from '../freshness';
import { McpToolError, type McpCtx } from '../context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Project-construction tools.
 *
 * Two ways in, on purpose:
 *  - `procal_create_project_from_spec` — one declarative shot for greenfield work.
 *    Fewer round-trips and, more importantly, fewer chances to leave a project
 *    half-built.
 *  - granular tools — for correcting an existing project.
 *
 * The agent never supplies engineering numbers. It declares intent (rooms, areas,
 * quantities) and the ProCal engine derives every load, current, breaker and cable.
 */

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

const roomSchema = z.object({
  name: z.string().min(1).max(80),
  type: z
    .enum([
      'KITCHEN', 'BEDROOM', 'LIVING_ROOM', 'DINING_ROOM',
      'BATHROOM', 'HALL', 'OTHER',
    ])
    .default('OTHER'),
  area: z.number().positive().max(10000).describe('Floor area in m².'),
  hasAc: z.boolean().default(false),
  acBtu: z.number().int().positive().optional().describe('AC capacity in BTU.'),
  loadDensity: z
    .number()
    .positive()
    .default(100)
    .describe('Connected load density in VA/m². Typical: 100 general, 150 kitchen, 60 bedroom.'),
});

const buildingSpecSchema = z.object({
  name: z.string().min(1).max(120),
  serviceFloors: z.number().int().min(0).max(60).default(0),
  apartmentsPerFloor: z.number().int().min(0).max(50).default(0),
  supplyVoltage: z.string().default('400V 3-Phase'),
  earthingSystem: z.string().default('TN-S'),
  lightningProtection: z.boolean().default(false),
  generator: z.number().positive().nullable().default(null).describe('Generator rating in kVA.'),
  transformer: z.number().positive().nullable().default(null).describe('Transformer rating in kVA.'),
  floors: z
    .array(
      z.object({
        hasFloorSubPanels: z.boolean().default(true).describe('true = SDB per floor, false = direct MDB feeders.'),
        riserCableSize: z.string().nullable().default(null).describe('e.g. "95 mm²". Required when hasFloorSubPanels.'),
        riserCableLength: z.number().positive().nullable().default(null).describe('Riser length in metres.'),
        riserBreakerSize: z.string().nullable().default(null),
        templateName: z
          .string()
          .optional()
          .describe('Name of a template defined in apartmentTemplates. Omit to leave the floor empty.'),
        apartmentCount: z.number().int().min(0).max(50).default(0),
        buildingLoadNames: z
          .array(z.string())
          .default([])
          .describe('Names from the project load library, e.g. ["Elevator", "Water Pump"].'),
        buildingLoadQuantities: z.array(z.number().int().min(1)).default([]),
      })
    )
    .min(1)
    .max(60),
});

const specSchema = z.object({
  name: z.string().min(1).max(160),
  client: z.string().default(''),
  consultant: z.string().default(''),
  contractor: z.string().default(''),
  location: z.string().default(''),
  engineer: z.string().default(''),
  voltage: z.number().default(400).describe('Line-to-line system voltage in volts.'),
  frequency: z.number().default(50),
  powerFactor: z.number().default(0.85),
  maxDemandFactor: z.number().default(0.8),
  maxVoltageDropLighting: z.number().default(3),
  maxVoltageDropPower: z.number().default(5),
  calculationStandard: z.enum(['IEC', 'NEMA']).default('IEC'),
  preferredManufacturer: z.enum(['ABB', 'SCHNEIDER', 'MIXED']).default('MIXED'),
  apartmentTemplates: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        phases: z.union([z.literal(1), z.literal(3)]).default(1),
        rooms: z.array(roomSchema).min(1).max(40),
      })
    )
    .default([]),
  buildings: z.array(buildingSpecSchema).min(1).max(20),
});

type ProjectSpec = z.infer<typeof specSchema>;

/** Create the Project row and its creator membership + default seed data. */
async function materializeProject(ctx: McpCtx, spec: ProjectSpec) {
  validateProjectSettings({
    voltage: spec.voltage,
    frequency: spec.frequency,
    powerFactor: spec.powerFactor,
    maxDemandFactor: spec.maxDemandFactor,
    maxVoltageDropLighting: spec.maxVoltageDropLighting,
    maxVoltageDropPower: spec.maxVoltageDropPower,
  });

  const project = await db.project.create({
    data: {
      name: spec.name,
      client: spec.client,
      consultant: spec.consultant,
      contractor: spec.contractor,
      location: spec.location,
      engineer: spec.engineer || ctx.user.name,
      date: new Date().toISOString().split('T')[0],
      voltage: spec.voltage,
      frequency: spec.frequency,
      powerFactor: spec.powerFactor,
      maxDemandFactor: spec.maxDemandFactor,
      maxVoltageDropLighting: spec.maxVoltageDropLighting,
      maxVoltageDropPower: spec.maxVoltageDropPower,
      calculationStandard: spec.calculationStandard,
      preferredManufacturer: spec.preferredManufacturer,
      userId: ctx.user.id,
    },
  });

  await db.projectMember.create({
    data: { projectId: project.id, userId: ctx.user.id, role: 'PROJECT_MANAGER' },
  });

  // Standard templates + load library power the recalculate engine.
  try {
    await seedDefaultProjectTemplates(project.id, project.country);
    await seedDefaultLoadLibrary(project.id);
  } catch (seedErr) {
    console.warn('MCP: failed to seed project defaults:', seedErr);
  }

  return project;
}

/** Create the building, its floors, the apartment templates, and the circuits. */
async function materializeBuildings(ctx: McpCtx, projectId: string, spec: ProjectSpec) {
  const created: Array<{ buildingId: string; name: string; floors: number; circuits: number }> = [];

  for (const bSpec of spec.buildings) {
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

      // Apartment template lookup for this floor
      if (fSpec.templateName && fSpec.apartmentCount > 0) {
        const template = await db.apartmentTemplate.findFirst({
          where: { projectId, name: fSpec.templateName },
        });
        if (!template) {
          throw new McpToolError(
            `Apartment template "${fSpec.templateName}" is not defined for this project. Define it in apartmentTemplates first.`,
            400
          );
        }
        await db.floorItem.createMany({
          data: Array.from({ length: fSpec.apartmentCount }, () => ({
            type: 'APARTMENT' as const,
            name: 'Apartment',
            floorDesignId: floor.id,
            apartmentTemplateId: template.id,
            installMethod: 'C' as const,
            cableInsulation: 'XLPE' as const,
            cableMaterial: 'copper' as const,
          })),
        });
        circuitCount += fSpec.apartmentCount;
      }

      // Mechanical / building loads on this floor
      for (let k = 0; k < fSpec.buildingLoadNames.length; k++) {
        const libName = fSpec.buildingLoadNames[k];
        const qty = fSpec.buildingLoadQuantities[k] ?? 1;
        const lib = await db.loadLibraryItem.findFirst({
          where: { projectId, name: libName },
        });
        if (!lib) {
          throw new McpToolError(
            `Load library item "${libName}" not found. Check procal_get_project_brief for available items, or use a known name.`,
            400
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

export function registerBuildTools(server: McpServer, makeCtx: () => McpCtx) {
  // ---------------------------------------------------------------- templates
  server.registerTool(
    'procal_define_apartment_template',
    {
      title: 'Define an apartment template',
      description:
        'Create a reusable apartment template: a set of rooms with areas, optional AC, and a load density per room. ProCal derives connected load and, via the project diversity rules, max demand and design current. Use the same template across floors to keep the design consistent.',
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        name: z.string().min(1).max(80),
        phases: z.union([z.literal(1), z.literal(3)]).default(1),
        rooms: z.array(roomSchema).min(1).max(40),
      },
    },
    async ({ projectId, name, phases, rooms }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const existing = await db.apartmentTemplate.findFirst({ where: { projectId, name } });
      if (existing) {
        throw new McpToolError(
          `A template named "${name}" already exists. Use a different name, or edit the project through the UI.`
        );
      }

      const withLoad = rooms.map((r) => ({ ...r, connectedLoad: r.area * r.loadDensity }));
      const template = await db.apartmentTemplate.create({
        data: {
          name,
          phases,
          projectId,
          rooms: { create: withLoad },
        },
        include: { rooms: true },
      });

      const connectedLoadVA = template.rooms.reduce((s, r) => s + r.connectedLoad, 0);
      return ok({
        templateId: template.id,
        name: template.name,
        phases: template.phases,
        rooms: template.rooms.map((r) => ({
          name: r.name,
          type: r.type,
          area: r.area,
          loadDensity: r.loadDensity,
          hasAc: r.hasAc,
          acBtu: r.acBtu,
          connectedLoadVA: r.connectedLoad,
        })),
        connectedLoadVA,
        connectedLoadKw: Number((connectedLoadVA / 1000).toFixed(3)),
        note: 'Max demand applies the project diversity factor. Run procal_recalculate_project to see the final figure.',
      });
    }
  );

  // ----------------------------------------------------------------- granular
  server.registerTool(
    'procal_upsert_building',
    {
      title: 'Create or update a building',
      description:
        'Add a building to a project, or update the riser/topology of its floors. Floors are auto-numbered 1..N in the order given. Omit floors to only change building-level fields.',
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional().describe('Omit to create a new building.'),
        name: z.string().min(1).max(120).optional(),
        serviceFloors: z.number().int().min(0).max(60).optional(),
        apartmentsPerFloor: z.number().int().min(0).max(50).optional(),
        earthingSystem: z.string().optional(),
        lightningProtection: z.boolean().optional(),
        transformer: z.number().positive().nullable().optional(),
        generator: z.number().positive().nullable().optional(),
        floors: z
          .array(
            z.object({
              floorNumber: z.number().int().min(1).max(60),
              hasFloorSubPanels: z.boolean().optional(),
              riserCableSize: z.string().nullable().optional(),
              riserCableLength: z.number().positive().nullable().optional(),
              riserBreakerSize: z.string().nullable().optional(),
            })
          )
          .max(60)
          .optional(),
      },
    },
    async (args) => {
      const ctx = makeCtx();
      const { projectId, buildingId, floors, ...buildingFields } = args;
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      let building;
      if (buildingId) {
        const auth = await ctx.resolveProject(projectId, {
          pageKey: 'calculator',
          requiredAction: 'EDIT',
        });
        if (auth.project.userId !== ctx.user.id && auth.member.role !== 'PROJECT_MANAGER') {
          throw new McpToolError('Only the project owner or a Project Manager can edit buildings.', 403);
        }
        building = await db.building.update({
          where: { id: buildingId },
          data: buildingFields,
        });
      } else {
        if (!buildingFields.name) throw new McpToolError('name is required to create a building.');
        const createData = {
          name: buildingFields.name,
          // `Building.floors` is required and is the count of FloorDesign rows,
          // which are created (or updated) in the loop below.
          floors: floors?.length ?? 0,
          serviceFloors: buildingFields.serviceFloors ?? 0,
          apartmentsPerFloor: buildingFields.apartmentsPerFloor ?? 0,
          supplyVoltage: '400V 3-Phase',
          earthingSystem: buildingFields.earthingSystem ?? 'TN-S',
          lightningProtection: buildingFields.lightningProtection ?? false,
          transformer: buildingFields.transformer ?? null,
          generator: buildingFields.generator ?? null,
          projectId,
        };
        building = await db.building.create({ data: createData });
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

      await logProjectActivity({
        projectId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.username,
        userRole: 'ENGINEER',
        action: 'UPDATE',
        entityType: 'BUILDING_LOAD',
        entityId: building.id,
        description: `${buildingId ? 'Updated' : 'Created'} building "${building.name}" via MCP`,
        details: { source: 'mcp', floors: updatedFloors.length },
      });

      return ok({ buildingId: building.id, name: building.name, floorsTouched: updatedFloors });
    }
  );

  server.registerTool(
    'procal_assign_floor_template',
    {
      title: 'Assign a template to a floor',
      description:
        'Populate a floor with apartment circuits from a template, or change how many. Existing circuits on that floor are replaced, so pass the full intended count.',
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        floorDesignId: z.string().uuid(),
        templateName: z.string().min(1).max(80),
        apartmentCount: z.number().int().min(0).max(50),
      },
    },
    async ({ projectId, floorDesignId, templateName, apartmentCount }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const floor = await db.floorDesign.findFirst({
        where: { id: floorDesignId, building: { projectId } },
      });
      if (!floor) throw new McpToolError('Floor not found in this project.', 404);

      const template = await db.apartmentTemplate.findFirst({
        where: { projectId, name: templateName },
      });
      if (!template) throw new McpToolError(`Template "${templateName}" not found.`, 404);

      await db.floorItem.deleteMany({ where: { floorDesignId } });
      if (apartmentCount > 0) {
        await db.floorItem.createMany({
          data: Array.from({ length: apartmentCount }, (_, i) => ({
            type: 'APARTMENT' as const,
            name: `Apt ${floor.floorNumber}-${i + 1}`,
            floorDesignId,
            apartmentTemplateId: template.id,
            installMethod: 'C' as const,
            cableInsulation: 'XLPE' as const,
            cableMaterial: 'copper' as const,
          })),
        });
      }
      const fresh = await ensureFresh(projectId);
      return ok({ floorDesignId, floorNumber: floor.floorNumber, apartmentCount, fresh });
    }
  );

  server.registerTool(
    'procal_set_building_loads',
    {
      title: 'Set building mechanical loads',
      description:
        'Attach mechanical or building loads (elevators, pumps, HVAC) to a building by name from the project load library. Replaces the building’s existing load list.',
      annotations: { readOnlyHint: false, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid(),
        buildingId: z.string().uuid(),
        loads: z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              quantity: z.number().int().min(1).max(999).default(1),
            })
          )
          .max(40),
      },
    },
    async ({ projectId, buildingId, loads }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const building = await db.building.findFirst({
        where: { id: buildingId, projectId },
      });
      if (!building) throw new McpToolError('Building not found in this project.', 404);

      const library = await db.loadLibraryItem.findMany({ where: { projectId } });
      const byName = new Map(library.map((l) => [l.name.toLowerCase(), l]));

      await db.buildingLoad.deleteMany({ where: { buildingId } });
      const applied: Array<{ name: string; quantity: number; powerKw: number }> = [];
      for (const l of loads) {
        const item = byName.get(l.name.toLowerCase());
        if (!item) {
          throw new McpToolError(
            `Load library item "${l.name}" not found. Available: ${library
              .slice(0, 25)
              .map((x) => x.name)
              .join(', ')}${library.length > 25 ? ', …' : ''}`
          );
        }
        await db.buildingLoad.create({
          data: { loadLibraryItemId: item.id, quantity: l.quantity, buildingId },
        });
        applied.push({
          name: item.name,
          quantity: l.quantity,
          powerKw: Number((item.power * l.quantity).toFixed(2)),
        });
      }

      const fresh = await ensureFresh(projectId);
      return ok({ buildingId, applied, fresh });
    }
  );

  // ---------------------------------------------------------------- one-shot
  server.registerTool(
    'procal_create_project_from_spec',
    {
      title: 'Create a project from a full spec',
      description:
        'Create a complete project in one call: standards, buildings, per-floor topology and risers, reusable apartment templates, and mechanical loads. ProCal then derives every load, current, breaker and cable. Requires one project credit — if the account has none, returns status "payment_required" with a checkout link and creates nothing.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: { spec: specSchema },
    },
    async ({ spec }) => {
      const ctx = makeCtx();

      // Payment / quota gate FIRST — never create a row the user cannot pay for.
      const gate = await canStartProject(ctx.user);
      if (!gate.allowed) {
        // A spent subscription quota is NOT the same as "no credits": the user
        // has paid, and the answer is "upgrade or buy a pass", not "buy credits".
        if (gate.reason === 'quota_exhausted') {
          return ok({
            status: 'quota_exhausted',
            message: gate.message,
            tier: gate.tier,
            allowance: gate.allowance,
            usedThisPeriod: gate.usedThisPeriod,
            checkoutUrl: gate.checkoutUrl,
            projectCreated: false,
            nextStep:
              'This account is on a paid plan and has used its project allowance for this period. ' +
              'Tell the user existing projects remain fully accessible, and offer to upgrade the plan or buy a single project pass. ' +
              'Do not suggest buying credits — they already pay.',
          });
        }
        return ok({
          status: 'payment_required',
          message: gate.message,
          checkoutUrl: gate.checkoutUrl,
          creditsRequired: 1,
          projectCreated: false,
          nextStep:
            'Show the user the checkout link, wait for payment to complete, then call this tool again with the same spec.',
        });
      }

      const paid = await spendProjectCredit(ctx.user.id);
      if (!paid) {
        return ok({
          status: 'payment_required',
          message: 'Credit balance changed while creating the project; nothing was created.',
          creditsRequired: 1,
          projectCreated: false,
        });
      }

      try {
        const project = await materializeProject(ctx, spec);

        // Apartment templates referenced by floors
        for (const t of spec.apartmentTemplates) {
          const withLoad = t.rooms.map((r) => ({ ...r, connectedLoad: r.area * r.loadDensity }));
          await db.apartmentTemplate.create({
            data: {
              name: t.name,
              phases: t.phases,
              projectId: project.id,
              rooms: { create: withLoad },
            },
          });
        }

        const buildings = await materializeBuildings(ctx, project.id, spec);
        const fresh = await ensureFresh(project.id);

        await logProjectActivity({
          projectId: project.id,
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.username,
          userRole: 'PROJECT_MANAGER',
          action: 'CREATE',
          entityType: 'PROJECT',
          entityId: project.id,
          description: `Created project "${project.name}" from an MCP spec`,
          details: { source: 'mcp', buildings: buildings.length },
        });

        return ok({
          status: 'created',
          projectCreated: true,
          projectId: project.id,
          name: project.name,
          calculationStandard: project.calculationStandard,
          buildings,
          recalculated: fresh,
          quota: {
            reason: gate.reason,
            tier: gate.tier ?? null,
            allowance: gate.allowance ?? null,
            usedThisPeriod: gate.usedThisPeriod ?? 0,
            remaining: gate.remaining ?? null,
          },
          nextStep:
            'Call procal_get_design_summary to check the design, then procal_export_drawings_pdf / procal_export_report_pdf.',
        });
      } catch (err) {
        // Refund the credit if materialization failed — the user got nothing.
        await db.user
          .update({ where: { id: ctx.user.id }, data: { credits: { increment: 1 } } })
          .catch(() => undefined);
        throw err instanceof McpToolError
          ? err
          : new McpToolError(
              `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
              500
            );
      }
    }
  );
}
