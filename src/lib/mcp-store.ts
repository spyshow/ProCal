import { db } from '@/lib/db';

/**
 * The only module in the MCP layer that touches the database.
 *
 * `McpToken` and `McpArtifact` are the MCP server's own infrastructure rather
 * than shared business data, so they have no browser-route equivalent to share
 * logic with. They still need a single owner, or token lifecycle rules end up
 * implemented once per call site.
 *
 * Everything else the MCP surface does — projects, buildings, templates, loads,
 * recalculation, exports, billing — goes through `src/lib/services/*`, which the
 * browser routes use too. See `src/mcp/db-boundary.test.ts`, which enforces this
 * split and lists this file as the single documented exception.
 */

export interface McpTokenRecord {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const TOKEN_SELECT = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export async function createTokenRecord(params: {
  userId: string;
  name: string;
  tokenHash: string;
  prefix: string;
}): Promise<McpTokenRecord> {
  return db.mcpToken.create({
    data: params,
    select: { ...TOKEN_SELECT },
  });
}

export async function findTokenRecordsForUser(userId: string): Promise<McpTokenRecord[]> {
  return db.mcpToken.findMany({
    where: { userId },
    select: { ...TOKEN_SELECT },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Revoke a token, scoped to its owner so one user cannot revoke another's.
 * Returns false when the token does not exist, is not owned by this user, or was
 * already revoked.
 */
export async function revokeTokenRecord(userId: string, tokenId: string): Promise<boolean> {
  const result = await db.mcpToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export interface McpActorRow {
  id: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    credits: number;
    email: string | null;
    theme: string;
  };
}

/**
 * Resolve a live token hash to its owner.
 *
 * Revoked tokens and disabled users are filtered in the query rather than after
 * it, so the selected shape is already exactly the actor the caller may use.
 */
export async function findLiveTokenByHash(tokenHash: string): Promise<McpActorRow | null> {
  return db.mcpToken.findFirst({
    where: { tokenHash, revokedAt: null, user: { disabled: false } },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          credits: true,
          email: true,
          theme: true,
        },
      },
    },
  });
}

/** Best-effort audit stamp; a failure here must never fail the request. */
export async function touchTokenLastUsed(tokenId: string): Promise<void> {
  await db.mcpToken.update({ where: { id: tokenId }, data: { lastUsedAt: new Date() } });
}

export async function deleteTokenRecord(id: string): Promise<void> {
  await db.mcpToken.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export interface NewArtifact {
  userId: string;
  projectId?: string | null;
  kind: 'report_pdf' | 'drawings_pdf' | 'excel';
  filename: string;
  mime: string;
  data: Uint8Array<ArrayBuffer>;
  sizeBytes: number;
  expiresAt: Date;
}

export interface ArtifactRecord {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  kind: string;
  expiresAt: Date;
}

export async function createArtifact(input: NewArtifact): Promise<ArtifactRecord> {
  return db.mcpArtifact.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      kind: input.kind,
      filename: input.filename,
      mime: input.mime,
      bytes: input.data,
      sizeBytes: input.sizeBytes,
      expiresAt: input.expiresAt,
    },
    select: { id: true, filename: true, mime: true, sizeBytes: true, kind: true, expiresAt: true },
  });
}

export interface ArtifactBytesRecord {
  id: string;
  filename: string;
  mime: string;
  bytes: Uint8Array<ArrayBuffer>;
  expiresAt: Date;
}

/** Load an artifact by id, scoped to its owner. */
export async function findArtifactForUser(
  userId: string,
  id: string
): Promise<ArtifactBytesRecord | null> {
  return db.mcpArtifact.findFirst({
    where: { id, userId },
    select: { id: true, filename: true, mime: true, bytes: true, expiresAt: true },
  });
}

export async function deleteArtifact(id: string): Promise<void> {
  await db.mcpArtifact.delete({ where: { id } });
}

/** Remove artifacts past their expiry. Best-effort by design. */
export async function deleteArtifactQuietly(id: string): Promise<void> {
  await db.mcpArtifact.delete({ where: { id } }).catch(() => undefined);
}
