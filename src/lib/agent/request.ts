import { NextResponse } from 'next/server';
import { resolveMcpActorWithToken } from '@/lib/mcp-auth';
import { verifyProjectAccessAsUser, type AuthedUser, type ProjectAccessOptions } from '@/lib/project-auth';
import { consumeRateLimit, type RateBucket } from '@/lib/services/rate-limit';
import { AGENT_EXPORT_PATHS } from '@/mcp/client/agent-routes';

/**
 * Shared front door for `/api/agent/v1/*`.
 *
 * The agent API is a public contract: it is authenticated with a Personal Access
 * Token rather than a session cookie, because the caller may be an MCP client in
 * another process, a script, or a third-party integration. That makes it a
 * genuinely external surface, so every route goes through this helper rather than
 * authenticating ad hoc.
 *
 * Three things happen here, in this order, for every request:
 *
 *  1. Resolve the bearer token to a user. Nothing else is accepted — in
 *     particular no cookie, so a browser session cannot be used to reach it.
 *  2. Charge a rate limit. Export endpoints spawn a headless Chromium each, so
 *     they draw from the tighter budget. This is the same limiter the MCP endpoint
 *     uses, keyed per token, so one client cannot exhaust another's.
 *  3. For project-scoped routes, check project access. The services deliberately
 *     do not authorise — they assume the caller already did — so skipping this
 *     step would be a real authorisation bypass, not a formality.
 */

export interface AgentRequestOptions {
  /** Path under /api/agent/v1, used to pick the rate-limit bucket. */
  path: string;
  /** Project to authorise against, when the route is project-scoped. */
  projectId?: string;
  projectAccess?: ProjectAccessOptions;
  /** Fallback rate bucket when the path does not match a known export route. */
  bucket?: RateBucket;
}

export type AgentAuthResult =
  | { ok: true; user: AuthedUser; tokenId: string }
  | { ok: false; response: NextResponse };

function jsonError(status: number, code: string, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message, code }, { status, headers });
}

export async function authenticateAgentRequest(
  request: Request,
  options: AgentRequestOptions
): Promise<AgentAuthResult> {
  const actor = await resolveMcpActorWithToken(request);
  if (!actor) {
    return {
      ok: false,
      response: jsonError(
        401,
        'unauthorized',
        'Create a Personal Access Token under Settings → AI Agent Access (MCP) and send it as "Authorization: Bearer <token>".',
        { 'WWW-Authenticate': 'Bearer realm="procal-agent"' }
      ),
    };
  }

  const bucket = options.bucket ?? (AGENT_EXPORT_PATHS.has(options.path) ? 'export' : 'general');
  const limit = await consumeRateLimit({ key: actor.tokenId, bucket });
  if (!limit.allowed) {
    return {
      ok: false,
      response: jsonError(
        429,
        'rate_limited',
        `Rate limit exceeded (${limit.limit} requests per minute). Retry in ${limit.retryAfterSeconds}s.`,
        { 'Retry-After': String(limit.retryAfterSeconds) }
      ),
    };
  }

  if (options.projectId) {
    const access = await verifyProjectAccessAsUser(actor.user, options.projectId, {
      pageKey: 'calculator',
      requiredAction: 'VIEW',
      ...options.projectAccess,
    });
    if (access instanceof NextResponse) {
      const body = (await access.clone().json().catch(() => null)) as { error?: string } | null;
      return {
        ok: false,
        response: jsonError(access.status, 'forbidden', body?.error ?? 'Forbidden'),
      };
    }
  }

  return { ok: true, user: actor.user, tokenId: actor.tokenId };
}

/** A handler result, or an error response to return as-is. */
export type AgentResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Wrap a handler so the route file stays a single expression, and so a thrown
 * service error becomes a JSON body rather than an HTML crash page.
 */
export async function handleAgentRequest<T>(
  request: Request,
  options: AgentRequestOptions,
  handler: (ctx: { user: AuthedUser; tokenId: string }) => Promise<T>
): Promise<NextResponse> {
  const auth = await authenticateAgentRequest(request, options);
  if (!auth.ok) return auth.response;

  try {
    const data = await handler({ user: auth.user, tokenId: auth.tokenId });
    return NextResponse.json(data);
  } catch (err) {
    const status = typeof (err as { status?: number })?.status === 'number'
      ? (err as { status: number }).status
      : 500;
    if (status === 500) console.error('agent api error:', err);
    return jsonError(
      status,
      status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'agent_api_error',
      err instanceof Error ? err.message : 'Request failed'
    );
  }
}
