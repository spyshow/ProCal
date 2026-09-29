import { z } from 'zod';
import { ENGINE_VERSION } from '@/lib/calculations/version';
import { logProjectActivity } from '@/lib/audit-logger';
import { summariseRiser } from '../freshness';
import { canStartProject } from '@/lib/billing/entitlement';
import type { AgentApi } from '../client/agent-api-client';
import type { McpCtx } from '../context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Discover-and-pay tools. Thin wrappers: each reads through `ctx`, and every
 * number comes from `src/lib/calculations/`.
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

export function registerDiscoverTools(
  server: McpServer,
  deps: { makeCtx: () => McpCtx; makeApi: () => AgentApi }
) {
  const { makeCtx, makeApi } = deps;
  server.registerTool(
    'procal_list_projects',
    {
      title: 'List ProCal projects',
      description:
        'List every ProCal project you can access, most recently updated first. Use this before creating anything so you reuse an existing project instead of duplicating it.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {},
    },
    async () => {
      const ctx = makeCtx();
      const projects = await ctx.listVisibleProjects();
      return ok({
        count: projects.length,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          location: p.location,
          isOwner: p.isOwner,
          updatedAt: p.updatedAt.toISOString(),
        })),
      });
    }
  );

  server.registerTool(
    'procal_get_project_brief',
    {
      title: 'Get project brief',
      description:
        'Compact state of one project: standards, buildings, floors, circuit counts, whether the stored calculations are stale, and what is still missing. Call this first when resuming work on a project.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid().describe('Project UUID from procal_list_projects.'),
      },
    },
    async ({ projectId }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'VIEW' });
      const project = await makeApi().getProjectGraph(projectId);

      const buildings = project.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        floors: b.floorDesigns.length,
        circuits: b.floorDesigns.reduce((s, f) => s + f.items.length, 0),
        buildingLoads: b.buildingLoads.length,
        transformerKva: b.transformer,
        earthingSystem: b.earthingSystem,
        floorsDetail: b.floorDesigns
          .map((f) => ({
            floorNumber: f.floorNumber,
            hasFloorSubPanels: f.hasFloorSubPanels,
            circuits: f.items.length,
            riserCableSize: f.riserCableSize,
            riserCableLength: f.riserCableLength,
          }))
          .sort((x, y) => x.floorNumber - y.floorNumber),
      }));

      const stale = project.engineVersion !== ENGINE_VERSION;
      const missing: string[] = [];
      if (buildings.length === 0) missing.push('No buildings yet.');
      for (const b of buildings) {
        if (b.floors === 0) missing.push(`Building "${b.name}" has no floors.`);
        if (b.circuits === 0)
          missing.push(`Building "${b.name}" has floors but no circuits assigned.`);
        if (b.buildingLoads === 0)
          missing.push(`Building "${b.name}" has no mechanical/building loads.`);
      }

      return ok({
        id: project.id,
        name: project.name,
        client: project.client,
        engineer: project.engineer,
        calculationStandard: project.calculationStandard,
        voltage: project.voltage,
        frequency: project.frequency,
        powerFactor: project.powerFactor,
        maxVoltageDropLighting: project.maxVoltageDropLighting,
        maxVoltageDropPower: project.maxVoltageDropPower,
        preferredManufacturer: project.preferredManufacturer,
        engineVersion: project.engineVersion,
        currentEngineVersion: ENGINE_VERSION,
        calculationsAreStale: stale,
        apartmentTemplates: project.apartmentTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          phases: t.phases,
          rooms: t.rooms.length,
        })),
        buildings,
        nextSteps: stale
          ? ['Call procal_recalculate_project before exporting — stored numbers predate the current engine.']
          : [],
        missing,
      });
    }
  );

  server.registerTool(
    'procal_recalculate_project',
    {
      title: 'Recalculate project',
      description:
        'Run the ProCal calculation engine over the whole project and stamp the current engine version. Recomputes apartment connected load, diversity, design current, and clears any manual breaker or cable that is undersized for its load. Call after changing loads, and before any export.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid().describe('Project UUID.'),
      },
    },
    async ({ projectId }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'EDIT' });
      const result = await makeApi().recalculateProject(projectId);

      await logProjectActivity({
        projectId,
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.username,
        userRole: 'PROJECT_MANAGER',
        action: 'UPDATE',
        entityType: 'PROJECT',
        entityId: projectId,
        description: `Recalculated ${result.itemsRecalculated} circuit(s) via MCP`,
        details: { source: 'mcp', engineVersion: ENGINE_VERSION },
      });

      return ok({
        projectId,
        wasStale: result.wasStale,
        itemsRecalculated: result.itemsRecalculated,
        engineVersion: result.engineVersion,
      });
    }
  );

  server.registerTool(
    'procal_get_design_summary',
    {
      title: 'Design summary',
      description:
        'Engineering read-back: transformer kVA, MDB main breaker, per-floor demand and voltage-drop verdicts, and any compliance warnings. Use this to sanity-check a design and to explain it to the user in plain language.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        projectId: z.string().uuid().describe('Project UUID.'),
        buildingId: z.string().uuid().optional().describe('Limit to one building.'),
      },
    },
    async ({ projectId, buildingId }) => {
      const ctx = makeCtx();
      await ctx.resolveProject(projectId, { pageKey: 'calculator', requiredAction: 'VIEW' });
      const project = await makeApi().getProjectGraph(projectId);

      const risers = summariseRiser(project).filter(
        (r) => !buildingId || r.buildingId === buildingId
      );

      const totalLimit = project.maxVoltageDropPower ?? 5;
      const warnings: string[] = [];
      for (const r of risers) {
        if (r.totalNoData) {
          warnings.push(
            `Floor ${r.floorNumber} of ${r.buildingName}: no voltage-drop data (cable lengths missing).`
          );
        } else if (r.totalVdPercent > totalLimit) {
          warnings.push(
            `Floor ${r.floorNumber} of ${r.buildingName}: total ΔV ${r.totalVdPercent.toFixed(2)}% exceeds the ${totalLimit}% limit.`
          );
        } else if (r.totalVdPercent > totalLimit * 0.8) {
          warnings.push(
            `Floor ${r.floorNumber} of ${r.buildingName}: total ΔV ${r.totalVdPercent.toFixed(2)}% is within 20% of the ${totalLimit}% limit.`
          );
        }
      }

      const demandKw = risers.reduce((s, r) => s + r.riserCurrent, 0);

      return ok({
        projectId,
        name: project.name,
        calculationStandard: project.calculationStandard,
        voltage: project.voltage,
        powerFactor: project.powerFactor,
        totalVoltageDropLimitPercent: totalLimit,
        transformer: {
          kva: project.transformerSize,
          impedancePercent: 5,
        },
        summedFloorRiserCurrentA: Number(demandKw.toFixed(1)),
        note:
          'summedFloorRiserCurrentA is the sum of per-floor max-phase currents, not a system current. Use procal_get_project_brief or the report for the authoritative MDB value.',
        floors: risers,
        warnings,
      });
    }
  );

  server.registerTool(
    'procal_create_checkout',
    {
      title: 'Start a purchase',
      description:
        'Create a payment session so the user can buy project credits or a subscription, and return the checkout URL. Present the URL to the user and wait for them to complete payment before retrying project creation.',
      annotations: { readOnlyHint: false, openWorldHint: true },
      inputSchema: {
        product: z
          .enum(['starter_monthly', 'professional_monthly', 'team_monthly', 'single_project_pass'])
          .describe('Which product to buy. The single project pass is one project, no subscription.'),
        projectSpec: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Optional project spec to materialise automatically once payment lands.'),
      },
    },
    async ({ product, projectSpec }) => {
      const ctx = makeCtx();
      const gate = await canStartProject(ctx.user);
      if (gate.allowed) {
        return ok({
          alreadyEntitled: true,
          message:
            'This account already has project capacity, so no purchase is needed. Call procal_create_project_from_spec directly.',
        });
      }
      // Stripe wiring lands in Task 3. Until then, point the agent at the browser.
      return ok({
        alreadyEntitled: false,
        product,
        checkoutUrl: gate.checkoutUrl ?? null,
        status: 'payment_required',
        message:
          'Card checkout is not enabled on this deployment yet. Ask the user to open the ProCal billing page and buy credits, then retry.',
        hasProjectSpec: Boolean(projectSpec),
      });
    }
  );
}
