import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Prisma query is mocked, so these tests cover what actually carries risk in
 * this service: the visibility rule (owner OR member), the ownership flag the UI
 * and MCP both branch on, and the ordering. The query shape itself is pinned by
 * `architecture.test.ts`, which fails if this file stops being the only place the
 * design graph is defined.
 */

const mocks = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
  },
}));

const { listVisibleProjects, loadDesignGraph } = await import('./projects');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listVisibleProjects', () => {
  it('scopes to projects the user owns or is a member of', async () => {
    mocks.findMany.mockResolvedValue([]);

    await listVisibleProjects('u1');

    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      OR: [{ userId: 'u1' }, { members: { some: { userId: 'u1' } } }],
    });
  });

  it('reports ownership per project rather than filtering on it', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    mocks.findMany.mockResolvedValue([
      {
        id: 'owned',
        name: 'Mine',
        client: 'C',
        location: 'L',
        updatedAt: now,
        userId: 'u1',
      },
      {
        id: 'shared',
        name: 'Shared',
        client: 'C',
        location: 'L',
        updatedAt: now,
        userId: 'someone-else',
      },
    ]);

    const result = await listVisibleProjects('u1');

    expect(result).toHaveLength(2);
    expect(result[0].isOwner).toBe(true);
    expect(result[1].isOwner).toBe(false);
  });

  it('orders most recently updated first and caps the result set', async () => {
    mocks.findMany.mockResolvedValue([]);

    await listVisibleProjects('u1', { take: 25 });

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ updatedAt: 'desc' });
    expect(args.take).toBe(25);
  });

  it('defaults to a bounded page so a large account cannot exhaust memory', async () => {
    mocks.findMany.mockResolvedValue([]);

    await listVisibleProjects('u1');

    expect(mocks.findMany.mock.calls[0][0].take).toBe(100);
  });
});

describe('loadDesignGraph', () => {
  it('returns null for a project that does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await loadDesignGraph('missing')).toBeNull();
  });

  it('loads the design graph in one query', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'p1', buildings: [] });

    await loadDesignGraph('p1');

    const args = mocks.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'p1' });
    // Buildings -> floor designs -> items, with templates, rooms and load library.
    expect(args.include.buildings.include.floorDesigns.include.items.include.apartmentTemplate.include.rooms).toBe(
      true
    );
    expect(args.include.apartmentTemplates.include.rooms).toBe(true);
    expect(args.include.loadLibraryItems).toBe(true);
    expect(args.include.buildings.include.buildingLoads.include.loadLibraryItem).toBe(true);
  });
});
