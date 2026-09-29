import type { DesignGraph, VisibleProject } from '@/lib/services/projects';
import type { Project, ProjectRevision } from '@/types';
import type { EquipmentItem } from '@/lib/calculations/feeders';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';
import { AGENT_ROUTES, buildAgentUrl, type HttpMethod } from './agent-routes';

/**
 * The single seam between MCP tools and the application.
 *
 * Tools call these methods and nothing else. The operation itself lives in
 * `src/lib/services/*`, which the browser routes also use; how the call reaches it
 * is the transport's problem, not the tool's.
 *
 * Two interchangeable transports:
 *
 *  - `in-process` calls the services directly. This is what runs today. It is not
 *    a security boundary, only a way to avoid a self-request through the Next
 *    router on every tool call.
 *  - `http` posts to `/api/agent/v1/*`, the wire format used when the MCP server
 *    is deployed as its own service.
 *
 * Because both satisfy this interface, extraction is configuration. It is also why
 * authorisation lives in the services rather than here: both transports get the
 * same checks, so moving off-process cannot quietly widen access.
 *
 * The actor is supplied once, at construction, from a token the caller cannot
 * influence. There is deliberately no method that accepts a user id — that would
 * be an authorisation bypass wearing a parameter.
 *
 * The methods are one-per-tool, not one-per-database-call. That is what lets the
 * http transport build its URLs from `AGENT_ROUTES` instead of hard-coding paths
 * that could drift from the routes they claim to call.
 */

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = 'agent_api_error'
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

export interface AgentApiActor {
  id: string;
  role: string;
  name?: string | null;
  username?: string | null;
}

export type TransportKind = 'in-process' | 'http';

export interface AgentApiClientOptions {
  /** The authenticated caller. Taken from a resolved token, never from a tool. */
  actor: AgentApiActor;
  transport?: TransportKind;
  /** Base URL for the http transport, e.g. https://procal-mu.vercel.app */
  baseUrl?: string;
  /** Bearer token, required by the http transport. */
  token?: string;
}

export interface RecalculateResult {
  wasStale: boolean;
  engineVersion: string | null;
  itemsRecalculated: number;
}

export interface ExportBundle {
  project: Project;
  companyName: string;
  companyLogoUrl?: string;
  equipment: EquipmentItem[];
  breakerSettings: BreakerSettingItem[];
  revisions: ProjectRevision[];
}

export interface TemplateRoom {
  name: string;
  type: string;
  area: number;
  loadDensity: number;
  connectedLoad: number;
  hasAc?: boolean;
  acBtu?: number | null;
}

export interface CreatedTemplate {
  id: string;
  name: string;
  phases: number;
  rooms: TemplateRoom[];
}

export interface CreatedBuildingResult {
  building: { id: string; name: string };
  updatedFloors: Array<{ floorNumber: number; hasFloorSubPanels: boolean }>;
}

export interface AppliedLoad {
  name: string;
  quantity: number;
  powerKw: number;
}

export interface DesignSummary {
  buildingId: string;
  buildingName: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  riserCurrent: number;
  riserVdPercent: number;
  branchVdPercent: number;
  totalVdPercent: number;
  totalNoData: boolean;
}

/** One method per registered tool. */
export interface AgentApi {
  listProjects(): Promise<VisibleProject[]>;
  getProjectBrief(projectId: string): Promise<DesignGraph>;
  getDesignSummary(projectId: string): Promise<DesignSummary[]>;
  recalculateProject(projectId: string): Promise<RecalculateResult>;
  createCheckout(input: unknown): Promise<unknown>;

  createProjectFromSpec(input: unknown): Promise<{ id: string; [key: string]: unknown }>;
  defineApartmentTemplate(input: unknown): Promise<CreatedTemplate>;
  upsertBuilding(input: unknown): Promise<CreatedBuildingResult>;
  assignFloorTemplate(input: unknown): Promise<{ floorNumber: number; apartmentCount: number }>;
  setBuildingLoads(input: unknown): Promise<AppliedLoad[]>;
  /**
   * Create a batch of buildings. Kept as its own method because the one-shot spec
   * needs it, but it is not a separate HTTP endpoint: the http transport issues
   * one upsertBuilding per building, so the two surfaces cannot diverge.
   */
  createBuildingsForSpec(projectId: string, buildings: unknown[]): Promise<CreatedBuildingResult[]>;

  loadReportBundle(projectId: string): Promise<ExportBundle>;
}

interface InProcessDeps {
  listVisibleProjects: (userId: string, opts?: { take?: number }) => Promise<VisibleProject[]>;
  loadDesignGraph: (projectId: string) => Promise<DesignGraph | null>;
  applyApartmentSizing: (projectId: string) => Promise<{ itemsRecalculated: number } | null>;
  createProjectRow: (input: never) => Promise<{ id: string; [key: string]: unknown }>;
  createBuildingsForSpec: (projectId: string, buildings: never) => Promise<unknown[]>;
  createApartmentTemplateRow: (input: never) => Promise<CreatedTemplate>;
  upsertBuildingRow: (input: never) => Promise<CreatedBuildingResult>;
  assignFloorTemplateRow: (input: never) => Promise<{ floorNumber: number; apartmentCount: number }>;
  replaceBuildingLoads: (input: never) => Promise<AppliedLoad[]>;
  loadReportData: (projectId: string) => Promise<ExportBundle | null>;
  summariseRiser: (graph: never) => DesignSummary[];
  ENGINE_VERSION: string;
}

function createInProcessApi(actor: AgentApiActor): AgentApi {
  // Resolved lazily so the http transport — the one used when the MCP server is
  // deployed as its own service — never pulls the application's data layer into
  // the bundle. Static imports here would defeat the point of two transports.
  let depsPromise: Promise<InProcessDeps> | null = null;
  const deps = (): Promise<InProcessDeps> => {
    if (depsPromise) return depsPromise;
    depsPromise = (async () => {
      const [projects, recalculate, writes, reportData, version, fresh] = await Promise.all([
        import('@/lib/services/projects'),
        import('@/lib/services/recalculate'),
        import('@/lib/services/design-writes'),
        import('@/lib/services/report-data'),
        import('@/lib/calculations/version'),
        import('../freshness'),
      ]);
      return {
        listVisibleProjects: projects.listVisibleProjects,
        loadDesignGraph: projects.loadDesignGraph,
        applyApartmentSizing: recalculate.applyApartmentSizing,
        createProjectRow: writes.createProjectRow,
        createBuildingsForSpec: writes.createBuildingsForSpec,
        createApartmentTemplateRow: writes.createApartmentTemplateRow,
        upsertBuildingRow: writes.upsertBuildingRow,
        assignFloorTemplateRow: writes.assignFloorTemplateRow,
        replaceBuildingLoads: writes.replaceBuildingLoads,
        loadReportData: reportData.loadReportData,
        summariseRiser: fresh.summariseRiser,
        ENGINE_VERSION: version.ENGINE_VERSION,
      };
    })();
    return depsPromise;
  };

  const wrap = async <T>(fn: (s: InProcessDeps) => Promise<T>): Promise<T> => {
    try {
      return await fn(await deps());
    } catch (err) {
      if (err instanceof AgentApiError) throw err;
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      throw new AgentApiError(err instanceof Error ? err.message : String(err), status);
    }
  };

  const requireGraph = (graph: DesignGraph | null, projectId: string): DesignGraph => {
    if (!graph) throw new AgentApiError(`Project ${projectId} not found`, 404);
    return graph;
  };

  return {
    listProjects: () => wrap((s) => s.listVisibleProjects(actor.id)),

    getProjectBrief: (projectId) =>
      wrap(async (s) => requireGraph(await s.loadDesignGraph(projectId), projectId)),

    getDesignSummary: (projectId) =>
      wrap(async (s) => s.summariseRiser(requireGraph(await s.loadDesignGraph(projectId), projectId) as never)),

    recalculateProject: (projectId) =>
      wrap(async (s) => {
        // "Was it stale" is a comparison against the stored engine version, which
        // only the service can see. Recomputing the rule here would duplicate it.
        const graph = requireGraph(await s.loadDesignGraph(projectId), projectId);
        if (graph.engineVersion === s.ENGINE_VERSION) {
          return { wasStale: false, engineVersion: graph.engineVersion, itemsRecalculated: 0 };
        }
        const applied = await s.applyApartmentSizing(projectId);
        return {
          wasStale: true,
          engineVersion: s.ENGINE_VERSION,
          itemsRecalculated: applied?.itemsRecalculated ?? 0,
        };
      }),

    // Checkout and credit accounting stay with the billing module: they are not
    // part of the agent contract and must keep the same wallet semantics.
    createCheckout: () =>
      wrap(async () => {
        throw new AgentApiError(
          'Checkout is not available through the agent API. Use POST /api/billing/checkout with a session.',
          501
        );
      }),

    createProjectFromSpec: (input) => wrap((s) => s.createProjectRow(input as never)),
    defineApartmentTemplate: (input) => wrap((s) => s.createApartmentTemplateRow(input as never)),
    upsertBuilding: (input) => wrap((s) => s.upsertBuildingRow(input as never)),
    assignFloorTemplate: (input) => wrap((s) => s.assignFloorTemplateRow(input as never)),
    setBuildingLoads: (input) => wrap((s) => s.replaceBuildingLoads(input as never)),
    createBuildingsForSpec: (projectId, buildings) =>
      wrap((s) => s.createBuildingsForSpec(projectId, buildings as never) as Promise<CreatedBuildingResult[]>),

    loadReportBundle: (projectId) =>
      wrap(async (s) => {
        const data = await s.loadReportData(projectId);
        if (!data) throw new AgentApiError('Project not found.', 404);
        return data;
      }),
  };
}

function createHttpApi(options: AgentApiClientOptions): AgentApi {
  const base = (options.baseUrl ?? '').replace(/\/$/, '');
  if (!base || !options.token) {
    throw new Error('The http transport requires baseUrl and token.');
  }

  /**
   * Every URL is built from the shared route map, so the transport cannot call a
   * path that the map does not claim, and cannot drift from a renamed route.
   */
  const call = async <T>(tool: string, method: HttpMethod, params: Record<string, string>, body?: unknown): Promise<T> => {
    const spec = AGENT_ROUTES.find((r) => r.tool === tool);
    if (!spec) throw new AgentApiError(`No agent route is registered for ${tool}`, 500);

    const res = await fetch(`${base}${buildAgentUrl(spec, params)}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const body = parsed as { error?: string } | null;
      throw new AgentApiError(body?.error ?? `Agent API ${method} ${spec.path} failed`, res.status);
    }
    return parsed as T;
  };

  return {
    listProjects: () =>
      call<{ projects: VisibleProject[] }>('procal_list_projects', 'GET', {}).then((r) => r.projects),
    getProjectBrief: (projectId) => call('procal_get_project_brief', 'GET', { projectId }),
    getDesignSummary: (projectId) =>
      call<{ summary: DesignSummary[] }>('procal_get_design_summary', 'GET', { projectId }).then(
        (r) => r.summary
      ),
    recalculateProject: (projectId) => call('procal_recalculate_project', 'POST', { projectId }),
    createCheckout: (input) => call('procal_create_checkout', 'POST', {}, input),
    createProjectFromSpec: (input) => call('procal_create_project_from_spec', 'POST', {}, input),
    defineApartmentTemplate: (input) => call('procal_define_apartment_template', 'POST', {}, input),
    upsertBuilding: (input) => call('procal_upsert_building', 'POST', {}, input),
    assignFloorTemplate: (input) =>
      call('procal_assign_floor_template', 'POST', { projectId: (input as { projectId: string }).projectId }, input),
    setBuildingLoads: (input) =>
      call('procal_set_building_loads', 'PUT', {
        projectId: (input as { projectId: string }).projectId,
        buildingId: (input as { buildingId: string }).buildingId,
      }, input),
    // Composed from the building endpoint rather than a batch route of its own, so
    // the one-shot project creation works identically over both transports.
    createBuildingsForSpec: async (projectId, buildings) => {
      const out: CreatedBuildingResult[] = [];
      for (const b of buildings) {
        out.push(await call<CreatedBuildingResult>('procal_upsert_building', 'POST', {}, { projectId, ...(b as object) }));
      }
      return out;
    },
    loadReportBundle: (projectId) => call('procal_export_report_pdf', 'GET', { projectId }),
  };
}

export function createAgentApiClient(options: AgentApiClientOptions): AgentApi {
  const kind = options.transport ?? 'in-process';
  if (kind === 'in-process') return createInProcessApi(options.actor);
  if (kind === 'http') return createHttpApi(options);
  throw new Error(`Unknown transport "${kind}". Use "in-process" or "http".`);
}
