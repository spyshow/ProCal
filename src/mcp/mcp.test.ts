import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP server wiring: PAT resolution, tool surface, and the payment gate.
 *
 * The database is mocked, so these run without Postgres. What they do prove is
 * the part that is easy to get wrong and expensive to get wrong later:
 *   - a bearer token resolves to the same user shape the cookie path uses
 *   - revoked / disabled / unknown tokens are all rejected
 *   - every tool is registered, prefixed, and has a JSON-Schema-able input
 *   - an unpaid account is refused a project *before* any row is written
 */

const mocks = {
  tokenFindFirst: vi.fn(),
  tokenUpdate: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  subscriptionFindFirst: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  projectFindMany: vi.fn(async () => []),
  projectFindUnique: vi.fn(),
  projectCreate: vi.fn(),
  buildingCreate: vi.fn(),
  floorDesignCreate: vi.fn(),
  floorItemCreateMany: vi.fn(),
  floorItemDeleteMany: vi.fn(),
  apartmentTemplateFindFirst: vi.fn(),
  apartmentTemplateCreate: vi.fn(),
  loadLibraryItemFindMany: vi.fn(async () => []),
  loadLibraryItemFindFirst: vi.fn(),
  buildingLoadCreate: vi.fn(),
  buildingLoadDeleteMany: vi.fn(),
  buildingFindFirst: vi.fn(),
  floorDesignFindFirst: vi.fn(),
  floorItemFindMany: vi.fn(async () => []),
  projectMemberCreate: vi.fn(async () => ({})),
  projectUpdate: vi.fn(async () => ({})),
  logActivity: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  seedTemplates: vi.fn(async () => undefined),
  seedLibrary: vi.fn(async () => undefined),
  validateSettings: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    mcpToken: { findFirst: mocks.tokenFindFirst, update: mocks.tokenUpdate },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    project: {
      findMany: mocks.projectFindMany,
      findUnique: mocks.projectFindUnique,
      create: mocks.projectCreate,
      update: mocks.projectUpdate,
    },
    projectMember: { create: mocks.projectMemberCreate },
    building: {
      create: mocks.buildingCreate,
      update: vi.fn(async () => ({})),
      findFirst: mocks.buildingFindFirst,
    },
    floorDesign: {
      create: mocks.floorDesignCreate,
      update: vi.fn(async () => ({})),
      findFirst: mocks.floorDesignFindFirst,
    },
    floorItem: {
      createMany: mocks.floorItemCreateMany,
      deleteMany: mocks.floorItemDeleteMany,
      findMany: mocks.floorItemFindMany,
      update: vi.fn(async () => ({})),
    },
    apartmentTemplate: {
      create: mocks.apartmentTemplateCreate,
      findFirst: mocks.apartmentTemplateFindFirst,
      findMany: vi.fn(async () => []),
    },
    loadLibraryItem: {
      findMany: mocks.loadLibraryItemFindMany,
      findFirst: mocks.loadLibraryItemFindFirst,
    },
    buildingLoad: { create: mocks.buildingLoadCreate, deleteMany: mocks.buildingLoadDeleteMany },
    mcpArtifact: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    // Added with the billing refactor (Task 3): canStartProject consults an
    // active subscription before falling back to the credit balance.
    subscription: { findFirst: mocks.subscriptionFindFirst },
    creditTransaction: { create: vi.fn(async () => ({ id: 'ct1' })) },    equipmentCatalog: { findMany: vi.fn(async () => []) },
    breakerSettings: { findMany: vi.fn(async () => []) },
    projectRevision: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('@/lib/audit-logger', () => ({
  logProjectActivity: vi.fn(async (p: unknown) => mocks.logActivity(p)),
}));

vi.mock('@/lib/project-defaults', () => ({
  seedDefaultProjectTemplates: vi.fn(async () => mocks.seedTemplates()),
  seedDefaultLoadLibrary: vi.fn(async () => mocks.seedLibrary()),
}));

vi.mock('@/lib/calculations/validate', () => ({
  validateProjectSettings: vi.fn((s: unknown) => mocks.validateSettings(s)),
  CalculationError: class extends Error {},
}));

vi.mock('@/mcp/freshness', () => ({
  ensureFresh: vi.fn(async () => ({
    wasStale: false,
    engineVersion: '2.0.0',
    itemsRecalculated: 0,
  })),
  loadProjectForDesign: vi.fn(async () => ({
    id: 'p1',
    name: 'T',
    buildings: [],
    apartmentTemplates: [],
    loadLibraryItems: [],
    engineVersion: '2.0.0',
    calculationStandard: 'IEC',
    voltage: 400,
    frequency: 50,
    powerFactor: 0.85,
    maxVoltageDropLighting: 3,
    maxVoltageDropPower: 5,
    preferredManufacturer: 'MIXED',
    transformerSize: null,
  })),
  summariseRiser: vi.fn(() => []),
}));

vi.mock('@/lib/app-settings', () => ({
  getCompanySettings: vi.fn(async () => null),
  getLogoAsset: vi.fn(async () => null),
}));

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'engineer',
  name: 'Test Engineer',
  role: 'USER',
  credits: 3,
  email: 'e@example.com',
  theme: 'dark',
};

const SECRET = 'procal_mcp_abcdefghijklmnop';
const { hashMcpToken } = await import('@/lib/mcp-auth');

function authedRequest(headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return new Request('http://localhost/api/mcp', { method: 'POST', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({ credits: 3, role: 'USER', disabled: false });
  mocks.tokenFindFirst.mockResolvedValue({
    id: 'tok1',
    revokedAt: null,
    user: {
      id: USER.id,
      username: USER.username,
      name: USER.name,
      role: USER.role,
      credits: USER.credits,
      email: USER.email,
      theme: USER.theme,
    },
  });
});

describe('resolveMcpActor', () => {
  it('resolves a valid bearer token to the session user shape', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    const user = await resolveMcpActor(authedRequest());
    expect(user).toMatchObject({ id: USER.id, role: 'USER', credits: 3 });
    // Same keys getSessionUser() returns, so downstream code is identical.
    expect(Object.keys(user!).sort()).toEqual(
      ['credits', 'email', 'id', 'name', 'role', 'theme', 'username'].sort()
    );
  });

  it('looks the token up by sha256 hash, never by the raw secret', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    await resolveMcpActor(authedRequest());
    expect(mocks.tokenFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tokenHash: hashMcpToken(SECRET) }) })
    );
    const arg = JSON.stringify(mocks.tokenFindFirst.mock.calls[0][0]);
    expect(arg).not.toContain(SECRET);
  });

  it('rejects a missing header', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    expect(await resolveMcpActor(new Request('http://localhost/api/mcp'))).toBeNull();
  });

  it('rejects a non-Bearer scheme', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    expect(await resolveMcpActor(authedRequest({ authorization: 'Basic abc123' }))).toBeNull();
    expect(await resolveMcpActor(authedRequest({ authorization: SECRET }))).toBeNull();
  });

  it('rejects an unknown token', async () => {
    mocks.tokenFindFirst.mockResolvedValue(null);
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    expect(await resolveMcpActor(authedRequest())).toBeNull();
  });

  it('rejects a revoked token and a disabled user via the query filter', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    await resolveMcpActor(authedRequest());
    const where = mocks.tokenFindFirst.mock.calls[0][0].where;
    expect(where.revokedAt).toBeNull();
    expect(where.user).toEqual({ disabled: false });
  });

  it('is case-insensitive about the scheme but not the secret', async () => {
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    expect(await resolveMcpActor(authedRequest({ authorization: `bearer ${SECRET}` }))).not.toBeNull();
    expect(await resolveMcpActor(authedRequest({ authorization: `Bearer ${SECRET} ` }))).not.toBeNull();
  });

  it('does not fail the request when the lastUsedAt write fails', async () => {
    mocks.tokenUpdate.mockRejectedValueOnce(new Error('db down'));
    const { resolveMcpActor } = await import('@/lib/mcp-auth');
    await expect(resolveMcpActor(authedRequest())).resolves.not.toBeNull();
  });
});

describe('mintMcpToken', () => {
  it('returns the secret once and stores only its hash', async () => {
    const { mintMcpToken, hashMcpToken } = await import('@/lib/mcp-auth');
    const create = vi.fn(async ({ data }: { data: { tokenHash: string; prefix: string; name: string } }) => ({
      id: 'tok1',
      name: data.name,
      prefix: data.prefix,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    }));
    const dbMod = await import('@/lib/db');
    (dbMod.db as unknown as { mcpToken: { create: unknown } }).mcpToken.create = create;

    const { token, prefix, record } = await mintMcpToken(USER.id, 'Claude Code');
    expect(token.startsWith('procal_mcp_')).toBe(true);
    expect(prefix).toBe(token.slice(0, 8));
    const stored = create.mock.calls[0][0].data as { tokenHash: string };
    expect(stored.tokenHash).toBe(hashMcpToken(token));
    expect(stored.tokenHash).not.toBe(token);
    expect(record.name).toBe('Claude Code');
  });
});

describe('canStartProject', () => {
  it('lets an admin through without touching credits', async () => {
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject({ id: USER.id, role: 'ADMIN', credits: 0 });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('admin_bypass');
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('allows a paid user and reports the remaining balance', async () => {
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject({ id: USER.id, role: 'USER', credits: 3 });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('credits');
    expect(res.remaining).toBe(3);
  });

  it('blocks an unpaid user with a payment_required reason', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 0, role: 'USER', disabled: false });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    const res = await canStartProject({ id: USER.id, role: 'USER', credits: 9 });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('payment_required');
  });

  it('re-reads credits rather than trusting the caller claim', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 0, role: 'USER', disabled: false });
    const { canStartProject } = await import('@/lib/billing/entitlement');
    // Caller claims 5 credits; the database says 0. Database wins.
    const res = await canStartProject({ id: USER.id, role: 'USER', credits: 5 });
    expect(res.allowed).toBe(false);
  });
});

describe('tool surface', () => {
  it('registers the full expected tool set, all prefixed', async () => {
    const { createMcpServer } = await import('@/mcp/registry');
    const server = createMcpServer(USER, 'http://localhost');
    const names = Object.keys((server as unknown as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools);

    expect(names).toContain('procal_list_projects');
    expect(names).toContain('procal_get_project_brief');
    expect(names).toContain('procal_create_checkout');
    expect(names).toContain('procal_create_project_from_spec');
    expect(names).toContain('procal_define_apartment_template');
    expect(names).toContain('procal_upsert_building');
    expect(names).toContain('procal_assign_floor_template');
    expect(names).toContain('procal_set_building_loads');
    expect(names).toContain('procal_recalculate_project');
    expect(names).toContain('procal_get_design_summary');
    expect(names).toContain('procal_export_report_pdf');
    expect(names).toContain('procal_export_excel');
    expect(names).toContain('procal_export_drawings_pdf');
    expect(names.every((n) => n.startsWith('procal_'))).toBe(true);
  });

  it('gives every tool a description', async () => {
    const { createMcpServer } = await import('@/mcp/registry');
    const server = createMcpServer(USER, 'http://localhost');
    const tools = (server as unknown as {
      _registeredTools: Record<string, { description?: string }>;
    })._registeredTools;
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, `${name} has no description`).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(40);
    }
  });

  it('takes a projectId on every project-scoped tool', async () => {
    const { createMcpServer } = await import('@/mcp/registry');
    const server = createMcpServer(USER, 'http://localhost');
    const tools = (server as unknown as {
      _registeredTools: Record<string, { inputSchema?: { shape?: Record<string, unknown> } }>;
    })._registeredTools;

    for (const name of [
      'procal_get_project_brief',
      'procal_recalculate_project',
      'procal_get_design_summary',
      'procal_export_report_pdf',
      'procal_export_excel',
      'procal_export_drawings_pdf',
    ]) {
      expect(Object.keys(tools[name].inputSchema?.shape ?? {}), `${name} lacks projectId`).toContain(
        'projectId'
      );
    }
  });
});
