import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import type { AuthedUser } from './project-auth';

/**
 * Personal Access Token authentication for the MCP server.
 *
 * MCP clients cannot send the `session_token` cookie, so `POST /api/mcp`
 * authenticates with `Authorization: Bearer <secret>`. The secret is shown to
 * the user exactly once, at mint time; only its SHA-256 hash is stored.
 *
 * Tokens are deliberately *not* JWTs: they must be revocable, individually
 * identifiable in the settings UI, and comparable in constant time.
 */

const TOKEN_PREFIX_LEN = 8;

/** Shape used by the public shape of a session user. Mirrors getSessionUser(). */
export type McpUser = AuthedUser;

export function hashMcpToken(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function tokenPrefix(secret: string): string {
  return secret.slice(0, TOKEN_PREFIX_LEN);
}

/** Mint a new token. Returns the secret exactly once, plus the stored record. */
export async function mintMcpToken(
  userId: string,
  name: string
): Promise<{ token: string; prefix: string; record: McpTokenRecord }> {
  // 32 bytes of entropy, URL-safe so it survives a JSON config file.
  const secret = `procal_mcp_${randomBytes(32).toString('base64url')}`;
  const record = await db.mcpToken.create({
    data: {
      userId,
      name,
      tokenHash: hashMcpToken(secret),
      prefix: tokenPrefix(secret),
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return { token: secret, prefix: record.prefix, record };
}

export interface McpTokenRecord {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export async function listMcpTokens(userId: string): Promise<McpTokenRecord[]> {
  return db.mcpToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeMcpToken(
  userId: string,
  tokenId: string
): Promise<boolean> {
  // Scoped to the caller's own tokens, so one user cannot revoke another's.
  const result = await db.mcpToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Resolve the bearer token on a request to a user.
 *
 * Returns null for: no header, wrong scheme, unknown token, revoked token, or a
 * disabled user. `lastUsedAt` is a best-effort side effect — a failure there must
 * not fail the request.
 *
 * Lookup is an exact, indexed match on the SHA-256 hash, so no constant-time
 * compare is needed: an attacker guessing a secret would have to collide with a
 * stored hash rather than be compared against one.
 */
export async function resolveMcpActor(request: Request): Promise<McpUser | null> {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const secret = match[1].trim();
  if (!secret) return null;

  // Revoked tokens and disabled users are filtered out in the query rather than
  // after it, so the selected shape is already exactly `McpUser`.
  const row = await db.mcpToken.findFirst({
    where: {
      tokenHash: hashMcpToken(secret),
      revokedAt: null,
      user: { disabled: false },
    },
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

  if (!row) return null;

  void db.mcpToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return row.user;
}
