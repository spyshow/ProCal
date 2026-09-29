import { z } from 'zod';
import { logProjectActivity } from '@/lib/audit-logger';
import { canStartProject, refundProjectCredit, spendProjectCredit } from '@/lib/billing/entitlement';
import type { AgentApi } from '../client/agent-api-client';
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
async function materializeProject(ctx: McpCtx, api: AgentApi, spec: ProjectSpec) {
  return api.createProject({
    name: spec.name,
    client: spec.client,
    consultant: spec.consultant,
    contractor: spec.contractor,
    location: spec.location,
    engineer: spec.engineer || ctx.user.name,
    voltage: spec.voltage,
    frequency: spec.frequency,
    powerFactor: spec.powerFactor,
    maxDemandFactor: spec.maxDemandFactor,
    maxVoltageDropLighting: spec.maxVoltageDropLighting,
    maxVoltageDropPower: spec.maxVoltageDropPower,
    calculationStandard: spec.calculationStandard,
    preferredManufacturer: spec.preferredManufacturer,
    ownerId: ctx.user.id,
  });
}

/** Create the building, its floors, the apartment templates, and the circuits. */
async function materializeBuildings(ctx: McpCtx, api: AgentApi, projectId: string, spec: ProjectSpec) {
  return api.createBuildingsForSpec(
    projectId,
    spec.buildings.map((bSpec) => ({
      name: bSpec.name,
      serviceFloors: bSpec.serviceFloors,
      apartmentsPerFloor: bSpec.apartmentsPerFloor,
      supplyVoltage: bSpec.supplyVoltage,
      earthingSystem: bSpec.earthingSystem,
      lightningProtection: bSpec.lightningProtection,
      generator: bSpec.generator,
      transformer: bSpec.transformer,
      floors: bSpec.floors.map((fSpec) => ({
        hasFloorSubPanels: fSpec.hasFloorSubPanels,
        riserCableSize: fSpec.riserCableSize,
        riserCableLength: fSpec.riserCableLength,
        riserBreakerSize: fSpec.riserBreakerSize,
        templateName: fSpec.templateName,
        apartmentCount: fSpec.apartmentCount,
        buildingLoadNames: fSpec.buildingLoadNames,
        buildingLoadQuantities: fSpec.buildingLoadQuantities,
      })),
    }))
  );
}

export function registerBuildTools(server: McpServer, deps: { makeCtx: () => McpCtx; makeApi: () => AgentApi }) {
  const { makeCtx, makeApi } = deps;
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
      const api = makeApi();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const template = await api.defineApartmentTemplate({ projectId, name, phases, rooms });
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
      const api = makeApi();
      const { projectId, buildingId, floors, ...buildingFields } = args;
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      let building;
      let updatedFloors: Array<{ floorNumber: number; hasFloorSubPanels: boolean }>;
      if (buildingId) {
        const auth = await ctx.resolveProject(projectId, {
          pageKey: 'calculator',
          requiredAction: 'EDIT',
        });
        if (auth.project.userId !== ctx.user.id && auth.member.role !== 'PROJECT_MANAGER') {
          throw new McpToolError('Only the project owner or a Project Manager can edit buildings.', 403);
        }
      }
      ({ building, updatedFloors } = await api.upsertBuilding({
        projectId,
        buildingId,
        fields: buildingFields,
        floors,
      }));

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
      const api = makeApi();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const result = await api.assignFloorTemplate({ projectId, floorDesignId, templateName, apartmentCount });
      const fresh = await api.recalculateProject(projectId);
      return ok({ floorDesignId, floorNumber: result.floorNumber, apartmentCount, fresh });
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
      const api = makeApi();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });

      const applied = await api.setBuildingLoads({ projectId, buildingId, loads });
      const fresh = await api.recalculateProject(projectId);
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
      const api = makeApi();

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
        const project = await materializeProject(ctx, makeApi(), spec);

        // Apartment templates referenced by floors
        for (const t of spec.apartmentTemplates) {
          await api.defineApartmentTemplate({
            projectId: project.id,
            name: t.name,
            phases: t.phases,
            rooms: t.rooms,
          });
        }

        const buildings = await materializeBuildings(ctx, makeApi(), project.id, spec);
        const fresh = await api.recalculateProject(project.id);

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
    await refundProjectCredit(ctx.user.id);
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
