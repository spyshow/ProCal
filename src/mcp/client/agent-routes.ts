/**
 * The single mapping from MCP tool to agent API endpoint.
 *
 * Two surfaces serve the same thirteen operations: the MCP tools, and the HTTP
 * API in `src/app/api/agent/v1`. When those are defined independently they drift
 * — an operation gains a field on one side, or a tool gains a parameter the route
 * silently drops. That is the same class of defect as the v1.6.0 report-PDF bug:
 * two code paths for one behaviour, with nothing checking they agree.
 *
 * So the correspondence is declared once, here, and
 * `src/mcp/client/route-drift.test.ts` fails if either surface stops matching it.
 *
 * Paths are the ones `HttpTransport` in `agent-api-client.ts` already calls.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface AgentRouteSpec {
  method: HttpMethod;
  /** Path under /api/agent/v1, with :params for dynamic segments. */
  path: string;
  /** The tool this endpoint serves. */
  tool: string;
}

export const AGENT_ROUTES: AgentRouteSpec[] = [
  // --- discover -------------------------------------------------------------
  { tool: 'procal_list_projects', method: 'GET', path: '/projects' },
  { tool: 'procal_get_project_brief', method: 'GET', path: '/projects/:projectId' },
  { tool: 'procal_get_design_summary', method: 'GET', path: '/projects/:projectId/summary' },
  { tool: 'procal_recalculate_project', method: 'POST', path: '/projects/:projectId/recalculate' },
  { tool: 'procal_create_checkout', method: 'POST', path: '/checkout' },

  // --- build ----------------------------------------------------------------
  { tool: 'procal_create_project_from_spec', method: 'POST', path: '/projects' },
  { tool: 'procal_define_apartment_template', method: 'POST', path: '/templates' },
  { tool: 'procal_upsert_building', method: 'POST', path: '/buildings' },
  {
    tool: 'procal_assign_floor_template',
    method: 'POST',
    path: '/projects/:projectId/floors/assign-template',
  },
  { tool: 'procal_set_building_loads', method: 'PUT', path: '/projects/:projectId/buildings/:buildingId/loads' },

  // --- export ---------------------------------------------------------------
  { tool: 'procal_export_report_pdf', method: 'GET', path: '/projects/:projectId/export/report-pdf' },
  { tool: 'procal_export_excel', method: 'GET', path: '/projects/:projectId/export/excel' },
  { tool: 'procal_export_drawings_pdf', method: 'GET', path: '/projects/:projectId/export/drawings-pdf' },
];

/** Render a spec path into a concrete URL for the given parameter values. */
export function buildAgentUrl(spec: AgentRouteSpec, params: Record<string, string> = {}): string {
  const path = spec.path.replace(/:([A-Za-z0-9_]+)/g, (_m, key: string) => {
    const value = params[key];
    if (!value) throw new Error(`Missing route parameter "${key}" for ${spec.path}`);
    return encodeURIComponent(value);
  });
  return `/api/agent/v1${path}`;
}

/** The export tools, which spawn a browser and share the tighter rate budget. */
export const AGENT_EXPORT_PATHS = new Set(
  AGENT_ROUTES.filter((r) => r.path.includes('/export/')).map((r) => r.path)
);
