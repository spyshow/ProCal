import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

/**
 * End-to-end MCP protocol test.
 *
 * Drives a real `Client` against a real `McpServer` over a linked transport pair,
 * so this exercises the actual handshake, capability negotiation, schema
 * conversion, and tool dispatch — not just internal registration state. If the
 * server does not speak MCP, this fails.
 */

const mocks = {
  projectFindMany: vi.fn(async () => []),
  projectFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
  subscriptionFindFirst: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  projectCount: vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0),
  logActivity: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
};

vi.mock('@/lib/db', () => ({
  db: {
    project: { findMany: mocks.projectFindMany, findUnique: mocks.projectFindUnique, count: mocks.projectCount },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    mcpToken: { findFirst: vi.fn(), update: vi.fn() },
    mcpArtifact: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    subscription: { findFirst: mocks.subscriptionFindFirst },
    creditTransaction: { create: vi.fn(async () => ({ id: 'ct1' })) },
  },
}));

vi.mock('@/lib/audit-logger', () => ({
  logProjectActivity: vi.fn(async (p: unknown) => mocks.logActivity(p)),
}));

vi.mock('@/mcp/freshness', () => ({
  ensureFresh: vi.fn(async () => ({ wasStale: false, engineVersion: '2.0.0', itemsRecalculated: 0 })),
  loadProjectForDesign: vi.fn(async () => ({
    id: 'p1', name: 'T', buildings: [], apartmentTemplates: [], loadLibraryItems: [],
    engineVersion: '2.0.0', calculationStandard: 'IEC', voltage: 400, frequency: 50,
    powerFactor: 0.85, maxVoltageDropLighting: 3, maxVoltageDropPower: 5,
    preferredManufacturer: 'MIXED', transformerSize: null,
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

async function connect() {
  const { createMcpServer } = await import('@/mcp/registry');
  const server = createMcpServer(USER, 'http://localhost');
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.projectFindMany.mockResolvedValue([]);
});

describe('MCP protocol', () => {
  it('completes the initialize handshake and reports server info', async () => {
    const { client, server } = await connect();
    const version = client.getServerVersion();
    expect(version?.name).toBe('procal');
    expect(client.getServerCapabilities()?.tools).toBeDefined();
    await client.close();
    await server.close();
  });

  it('advertises 13 tools over the wire with usable JSON Schemas', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(13);
    for (const t of tools) {
      expect(t.name).toMatch(/^procal_/);
      expect(t.description).toBeTruthy();
      expect(t.inputSchema.type).toBe('object');
    }
    await client.close();
    await server.close();
  });

  it('marks read-only tools so a client can decide what to auto-approve', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    const readOnly = tools.filter((t) => t.annotations?.readOnlyHint === true).map((t) => t.name);
    const mutating = tools.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name);
    expect(readOnly).toContain('procal_list_projects');
    expect(readOnly).toContain('procal_export_excel');
    expect(mutating).toContain('procal_create_project_from_spec');
    expect(mutating).toContain('procal_recalculate_project');
    await client.close();
    await server.close();
  });

  it('dispatches a tool call and returns structured content', async () => {
    const { client, server } = await connect();
    const result = await client.callTool({ name: 'procal_list_projects', arguments: {} });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty('count');
    expect(Array.isArray(parsed.projects)).toBe(true);
    await client.close();
    await server.close();
  });

  it('rejects a malformed argument with a validation error, not a crash', async () => {
    const { client, server } = await connect();
    const result = await client.callTool({
      name: 'procal_get_project_brief',
      arguments: { projectId: 'not-a-uuid' },
    });
    expect(result.isError).toBe(true);
    await client.close();
    await server.close();
  });

  it('returns a structured payment_required instead of failing when out of credits', async () => {
    mocks.userFindUnique.mockResolvedValue({ credits: 0, role: 'USER', disabled: false });
    const { client, server } = await connect();
    const result = await client.callTool({
      name: 'procal_create_project_from_spec',
      arguments: {
        spec: {
          name: 'Test Tower',
          buildings: [
            {
              name: 'Tower A',
              floors: [{ hasFloorSubPanels: true, apartmentCount: 0, buildingLoadNames: [], buildingLoadQuantities: [] }],
            },
          ],
        },
      },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.status).toBe('payment_required');
    expect(parsed.projectCreated).toBe(false);
    expect(parsed.creditsRequired).toBe(1);
    // Crucially, nothing was written.
    expect(mocks.projectFindMany).not.toHaveBeenCalled();
    await client.close();
    await server.close();
  });

  it('distinguishes a spent subscription quota from having no credits', async () => {
    mocks.subscriptionFindFirst.mockResolvedValue({
      tier: 'professional',
      currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
    });
    mocks.projectCount.mockResolvedValue(5); // all 5 used
    mocks.userFindUnique.mockResolvedValue({ credits: 99, role: 'USER', disabled: false });

    const { client, server } = await connect();
    const result = await client.callTool({
      name: 'procal_create_project_from_spec',
      arguments: {
        spec: {
          name: 'Quota Tower',
          buildings: [
            {
              name: 'Tower A',
              floors: [{ hasFloorSubPanels: true, apartmentCount: 0, buildingLoadNames: [], buildingLoadQuantities: [] }],
            },
          ],
        },
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(result.isError).toBeFalsy();
    expect(parsed.status).toBe('quota_exhausted');
    expect(parsed.tier).toBe('professional');
    expect(parsed.allowance).toBe(5);
    expect(parsed.usedThisPeriod).toBe(5);
    expect(parsed.projectCreated).toBe(false);
    // A paying customer must never be told to buy credits — they already pay.
    expect(parsed.nextStep).toMatch(/already pay/i);
    expect(parsed.nextStep).not.toMatch(/buy credits/i);
    await client.close();
    await server.close();
  });
});
