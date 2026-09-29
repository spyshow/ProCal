import {
  createArtifact,
  deleteArtifactQuietly,
  findArtifactForUser,
} from '@/lib/mcp-store';
import type { McpCtx } from './context';

/**
 * Storage for generated binaries (Task 5 Step 5).
 *
 * MCP tool results are text or JSON, so a 2 MB PDF cannot be returned inline.
 * Tools store the bytes and return a download URL the agent hands to the user.
 *
 * Bytes live in Postgres rather than on disk: Vercel serverless filesystems are
 * ephemeral, and a drawing pack is only 1-3 MB, which is a reasonable row size.
 */

const DEFAULT_TTL_HOURS = 24;

export interface StoredArtifact {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  kind: string;
  /** Absolute URL, derived from the request origin at read time. */
  downloadUrl: (origin: string) => string;
  expiresAt: string;
}

export async function storeArtifact(params: {
  ctx: McpCtx;
  projectId?: string | null;
  kind: 'report_pdf' | 'drawings_pdf' | 'excel';
  filename: string;
  mime: string;
  data: Buffer;
  ttlHours?: number;
}): Promise<StoredArtifact> {
  const ttl = params.ttlHours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);

  const row = await createArtifact({
    userId: params.ctx.user.id,
    projectId: params.projectId ?? null,
    kind: params.kind,
    filename: params.filename,
    mime: params.mime,
    data: new Uint8Array(params.data),
    sizeBytes: params.data.length,
    expiresAt,
  });

  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    kind: row.kind,
    expiresAt: row.expiresAt.toISOString(),
    downloadUrl: (origin: string) => `${origin}/api/mcp/artifacts/${row.id}`,
  };
}

/** Load an artifact, enforcing ownership and expiry. */
export async function readArtifact(userId: string, id: string) {
  const row = await findArtifactForUser(userId, id);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    // Best-effort cleanup of a row the caller can no longer use.
    void deleteArtifactQuietly(id);
    return null;
  }
  return row;
}

/** Strip characters that would break a Content-Disposition header. */
export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
