import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The client is the single seam between MCP tools and the application. Its
 * contract is deliberately small: one method per operation, no database, no
 * knowledge of how the operation is reached.
 *
 * These tests cover the seam rather than the operations, which the services
 * already test. What matters here is that the two transports are
 * interchangeable — the same tool code must work whether the operations are
 * called in-process or over HTTP, because that is what makes extracting the MCP
 * server into its own service a deployment change instead of a rewrite.
 */

const serviceMocks = {
  listVisibleProjects: vi.fn(),
  loadDesignGraph: vi.fn(),
  applyApartmentSizing: vi.fn(),
  applyBuildingSizing: vi.fn(),
  createApartmentTemplateRow: vi.fn(),
  createBuildingsForSpec: vi.fn(),
  createProjectRow: vi.fn(),
  assignFloorTemplateRow: vi.fn(),
  replaceBuildingLoads: vi.fn(),
  upsertBuildingRow: vi.fn(),
  loadReportData: vi.fn(),
};

vi.mock('@/lib/services/projects', () => ({
  listVisibleProjects: serviceMocks.listVisibleProjects,
  loadDesignGraph: serviceMocks.loadDesignGraph,
}));

vi.mock('@/lib/services/recalculate', () => ({
  applyApartmentSizing: serviceMocks.applyApartmentSizing,
  applyBuildingSizing: serviceMocks.applyBuildingSizing,
}));

vi.mock('@/lib/services/design-writes', () => ({
  createApartmentTemplateRow: serviceMocks.createApartmentTemplateRow,
  createBuildingsForSpec: serviceMocks.createBuildingsForSpec,
  createProjectRow: serviceMocks.createProjectRow,
  assignFloorTemplateRow: serviceMocks.assignFloorTemplateRow,
  replaceBuildingLoads: serviceMocks.replaceBuildingLoads,
  upsertBuildingRow: serviceMocks.upsertBuildingRow,
}));

vi.mock('@/lib/services/report-data', () => ({
  loadReportData: serviceMocks.loadReportData,
}));

const { createAgentApiClient, AgentApiError } = await import('./agent-api-client');

const ACTOR = { id: 'u1', role: 'ENGINEER' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listVisibleProjects.mockResolvedValue([]);
  serviceMocks.loadReportData.mockResolvedValue({ project: { name: 'Tower' } });
});

describe('AgentApiClient in-process transport', () => {
  it('lists the projects the actor can see', async () => {
    serviceMocks.listVisibleProjects.mockResolvedValue([{ id: 'p1', name: 'Mine' }]);
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    const projects = await client.listProjects();

    expect(projects).toEqual([{ id: 'p1', name: 'Mine' }]);
    expect(serviceMocks.listVisibleProjects).toHaveBeenCalledWith('u1');
  });

  it('never receives the actor from the caller', async () => {
    // The identity comes from the resolved token, not from anything a tool can
    // pass in. A tool that could supply its own actor would be an auth bypass.
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });
    await client.listProjects();
    expect(serviceMocks.listVisibleProjects).toHaveBeenCalledWith('u1');
  });

  it('loads a report bundle, or reports that the project is missing', async () => {
    serviceMocks.loadReportData.mockResolvedValue(null);
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    await expect(client.loadReportBundle('missing')).rejects.toBeInstanceOf(AgentApiError);
    await expect(client.loadReportBundle('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('wraps a service failure as a structured error rather than leaking it', async () => {
    // Stale, so the call proceeds into the service that then fails.
    serviceMocks.loadDesignGraph.mockResolvedValue({ id: 'p1', engineVersion: 'ancient' });
    serviceMocks.applyApartmentSizing.mockRejectedValue(new Error('connection reset'));
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    await expect(client.recalculateProject('p1')).rejects.toBeInstanceOf(AgentApiError);
    await expect(client.recalculateProject('p1')).rejects.toMatchObject({ status: 500 });
  });

  it('reports staleness from the recalculate call rather than re-deriving it', async () => {
    // Deliberately not a real engine version, so this cannot become a false pass
    // when the engine is bumped.
    serviceMocks.loadDesignGraph.mockResolvedValue({ id: 'p1', engineVersion: 'v0-stale' });
    serviceMocks.applyApartmentSizing.mockResolvedValue({ itemsRecalculated: 4 });
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    const result = await client.recalculateProject('p1');

    expect(result).toMatchObject({ wasStale: true, itemsRecalculated: 4 });
    expect(result.engineVersion).toBeTruthy();
  });

  it('skips the recalculation entirely when the engine version is current', async () => {
    serviceMocks.loadDesignGraph.mockResolvedValue({ id: 'p1', engineVersion: '2.0.0' });
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    const result = await client.recalculateProject('p1');

    expect(result).toMatchObject({ wasStale: false, itemsRecalculated: 0 });
    expect(serviceMocks.applyApartmentSizing).not.toHaveBeenCalled();
  });

  it('reports a missing project rather than returning an empty graph', async () => {
    serviceMocks.loadDesignGraph.mockResolvedValue(null);
    const client = createAgentApiClient({ actor: ACTOR, transport: 'in-process' });

    await expect(client.getProjectGraph('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('transport selection', () => {
  it('defaults to in-process, which is what runs today', async () => {
    const client = createAgentApiClient({ actor: ACTOR });
    await client.listProjects();
    expect(serviceMocks.listVisibleProjects).toHaveBeenCalled();
  });

  it('rejects an unknown transport at construction rather than at call time', () => {
    // A typo must not silently fall back to a working transport.
    expect(() =>
      createAgentApiClient({ actor: ACTOR, transport: 'carrier-pigeon' as never })
    ).toThrow();
  });
});
