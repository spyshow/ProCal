import { db } from '@/lib/db';

/**
 * Project reads.
 *
 * The "design graph" — a project with its buildings, floor designs, circuit
 * items, apartment templates, rooms, building loads and load library — was
 * written out six times across this codebase, each copy free to drift. It is
 * defined once here and used by both the browser routes and the MCP tools.
 *
 * This is the only place that queries projects on behalf of the MCP surface.
 */

/**
 * The canonical design-graph selection.
 *
 * Structured so it can be composed into a Prisma `include`, which keeps the
 * shared shape in one type-checked object rather than one copy-pasted literal
 * per call site.
 */
const designGraphSelect = {
  buildings: {
    include: {
      floorDesigns: {
        include: {
          items: {
            include: {
              apartmentTemplate: { include: { rooms: true } },
              loadLibraryItem: true,
            },
          },
        },
      },
      buildingLoads: { include: { loadLibraryItem: true } },
    },
  },
  apartmentTemplates: { include: { rooms: true } },
  loadLibraryItems: true,
} as const;

export type DesignGraph = NonNullable<
  Awaited<ReturnType<typeof loadDesignGraph>>
>;

/** A project loaded with the full design graph, or null when it does not exist. */
export async function loadDesignGraph(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: designGraphSelect,
  });
}

export async function loadDesignGraphOrThrow(projectId: string) {
  const project = await loadDesignGraph(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

/**
 * The design graph plus the project's members, for the project detail screen.
 *
 * A second legitimate shape, so it lives here rather than being re-spelled in the
 * route. The graph itself is still referenced from the single definition above.
 */
export async function loadProjectWithMembers(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      ...designGraphSelect,
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, username: true } },
        },
      },
    },
  });
}

export interface VisibleProject {
  id: string;
  name: string;
  client: string;
  location: string;
  updatedAt: Date;
  isOwner: boolean;
}

/**
 * Every project the caller owns or is a member of, most recently updated first.
 *
 * Ownership is reported rather than filtered, because the MCP and UI both need to
 * tell "your project" from "shared with you".
 */
export async function listVisibleProjects(
  userId: string,
  options?: { take?: number }
): Promise<VisibleProject[]> {
  const rows = await db.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      name: true,
      client: true,
      location: true,
      updatedAt: true,
      userId: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: options?.take ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    client: r.client,
    location: r.location,
    updatedAt: r.updatedAt,
    isOwner: r.userId === userId,
  }));
}

/**
 * Just the inputs the default-seeding step needs.
 *
 * A deliberately narrower shape than the design graph — seeding does not need
 * buildings, floors or circuit items — but it is defined here so the
 * template-with-rooms selection still has exactly one home.
 */
export async function loadProjectSeedInputs(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      country: true,
      apartmentTemplates: { include: { rooms: true } },
      loadLibraryItems: true,
    },
  });
}

/** The project row only, for callers that need membership rather than design. */
export async function findProjectRow(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      userId: true,
      voltage: true,
      powerFactor: true,
      engineVersion: true,
      preferredManufacturer: true,
      buildings: {
        select: {
          id: true,
          name: true,
          floorDesigns: { select: { id: true } },
        },
      },
    },
  });
}
