import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyProjectAccessAsUser,
  type AuthedUser,
  type ProjectAccessOptions,
  type ProjectAuthSuccess,
} from '@/lib/project-auth';

/**
 * Per-request context handed to every MCP tool.
 *
 * The point of this class is that a tool cannot accidentally skip a permission
 * check: it resolves projects through `resolveProject()`, which delegates to the
 * same `verifyProjectAccessAsUser` the HTTP routes use. A role that cannot open a
 * page in the UI cannot drive that page through MCP either.
 */

export class McpToolError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'tool_error'
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

export interface McpCtx {
  user: AuthedUser;
  /** Resolve project access, or throw a structured tool error. */
  resolveProject(projectId: string, opts?: ProjectAccessOptions): Promise<ProjectAuthSuccess>;
  /** Projects the caller can see, as owner or member. */
  listVisibleProjects(): Promise<
    Array<{ id: string; name: string; client: string; location: string; updatedAt: Date; isOwner: boolean }>
  >;
}

function fromNextResponse(res: NextResponse): McpToolError {
  let message = 'Forbidden';
  try {
    const body = res.json() as unknown as { error?: string };
    if (body && typeof body.error === 'string') message = body.error;
  } catch {
    // keep the default
  }
  const status = res.status;
  return new McpToolError(message, status, status === 404 ? 'not_found' : 'forbidden');
}

export function createMcpCtx(user: AuthedUser): McpCtx {
  return {
    user,

    async resolveProject(projectId, opts) {
      const auth = await verifyProjectAccessAsUser(user, projectId, opts);
      if (auth instanceof NextResponse) {
        throw fromNextResponse(auth);
      }
      return auth;
    },

    async listVisibleProjects() {
      const rows = await db.project.findMany({
        where: {
          OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
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
        take: 100,
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        client: r.client,
        location: r.location,
        updatedAt: r.updatedAt,
        isOwner: r.userId === user.id,
      }));
    },
  };
}
