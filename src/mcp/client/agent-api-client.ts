import type { DesignGraph, VisibleProject } from '@/lib/services/projects';
import type { Project, ProjectRevision } from '@/types';
import type { EquipmentItem } from '@/lib/calculations/feeders';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';

/**
 * The single seam between MCP tools and the application.
 *
 * Tools call these methods and nothing else. The operation itself lives in
 * `src/lib/services/*`, which the browser routes also use; how the call reaches
 * it is the transport's problem, not the tool's.
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

export interface AgentApi {
  // --- discover -------------------------------------------------------------
  listProjects(): Promise<VisibleProject[]>;
  getProjectGraph(projectId: string): Promise<DesignGraph>;
  // --- derive ---------------------------------------------------------------
  recalculateProject(projectId: string): Promise<RecalculateResult>;
  // --- build ----------------------------------------------------------------
  createProject(input: unknown): Promise<{ id: string; [key: string]: unknown }>;
  createBuildingsForSpec(projectId: string, buildings: unknown[]): Promise<unknown[]>;
  defineApartmentTemplate(input: unknown): Promise<CreatedTemplate>;
  upsertBuilding(input: unknown): Promise<CreatedBuildingResult>;
  assignFloorTemplate(input: unknown): Promise<{ floorNumber: number; apartmentCount: number }>;
  setBuildingLoads(input: unknown): Promise<AppliedLoad[]>;
  // --- export ---------------------------------------------------------------
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
  ENGINE_VERSION: string;
}

function createInProcessApi(actor: AgentApiActor): AgentApi {
  // Resolved lazily so that the http transport — the one used when the MCP server
  // is deployed as its own service — never pulls the application's data layer into
  // the bundle. Static imports here would defeat the point of having two
  // transports at all.
  let depsPromise: Promise<InProcessDeps> | null = null;
  const deps = (): Promise<InProcessDeps> => {
    if (depsPromise) return depsPromise;
    depsPromise = (async () => {
      const [projects, recalculate, writes, reportData, version] = await Promise.all([
        import('@/lib/services/projects'),
        import('@/lib/services/recalculate'),
        import('@/lib/services/design-writes'),
        import('@/lib/services/report-data'),
        import('@/lib/calculations/version'),
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

  return {
    listProjects: () => wrap((s) => s.listVisibleProjects(actor.id)),

    getProjectGraph: (projectId) =>
      wrap(async (s) => {
        const graph = await s.loadDesignGraph(projectId);
        if (!graph) throw new AgentApiError(`Project ${projectId} not found`, 404);
        return graph;
      }),

    recalculateProject: (projectId) =>
      wrap(async (s) => {
        // "Was it stale" is a comparison against the stored engine version, which
        // only the service can see. Recomputing the rule here would duplicate it.
        const graph = (await s.loadDesignGraph(projectId)) as
          | { engineVersion?: string | null }
          | null;
        if (!graph) throw new AgentApiError(`Project ${projectId} not found`, 404);
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

    createProject: (input) => wrap((s) => s.createProjectRow(input as never)),
    createBuildingsForSpec: (projectId, buildings) =>
      wrap((s) => s.createBuildingsForSpec(projectId, buildings as never)),
    defineApartmentTemplate: (input) => wrap((s) => s.createApartmentTemplateRow(input as never)),
    upsertBuilding: (input) => wrap((s) => s.upsertBuildingRow(input as never)),
    assignFloorTemplate: (input) => wrap((s) => s.assignFloorTemplateRow(input as never)),
    setBuildingLoads: (input) => wrap((s) => s.replaceBuildingLoads(input as never)),

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

  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}/api/agent/v1${path}`, {
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
      const err = (parsed as { error?: string } | null)?.error;
      throw new AgentApiError(err ?? `Agent API ${method} ${path} failed`, res.status);
    }
    return parsed as T;
  };

  return {
    listProjects: () => call('GET', '/projects'),
    getProjectGraph: (projectId) => call('GET', `/projects/${projectId}`),
    recalculateProject: (projectId) => call('POST', `/projects/${projectId}/recalculate`),
    createProject: (input) => call('POST', '/projects', input),
    createBuildingsForSpec: (projectId, buildings) =>
      call('POST', `/projects/${projectId}/buildings`, { buildings }),
    defineApartmentTemplate: (input) => call('POST', '/templates', input),
    upsertBuilding: (input) => call('POST', '/buildings', input),
    assignFloorTemplate: (input) => call('POST', '/floors/assign-template', input),
    setBuildingLoads: (input) => call('PUT', '/buildings/loads', input),
    loadReportBundle: (projectId) => call('GET', `/projects/${projectId}/report-bundle`),
  };
}

export function createAgentApiClient(options: AgentApiClientOptions): AgentApi {
  const kind = options.transport ?? 'in-process';
  if (kind === 'in-process') return createInProcessApi(options.actor);
  if (kind === 'http') return createHttpApi(options);
  throw new Error(`Unknown transport "${kind}". Use "in-process" or "http".`);
}
