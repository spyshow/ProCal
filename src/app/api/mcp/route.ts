import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
  import { resolveMcpActorWithToken } from '@/lib/mcp-auth';
  import { bucketForTool, consumeRateLimit, type RateBucket } from '@/lib/services/rate-limit';
  import { createMcpServer } from '@/mcp/registry';

/**
 * ProCal MCP endpoint (Task 5 Step 1).
 *
 * Streamable HTTP, stateless: a fresh `McpServer` and transport per request, no
 * session state. That is what lets this scale across serverless instances and
 * survive recycling — a stateful transport would pin the instance to a session.
 *
 * Auth is a Personal Access Token in `Authorization: Bearer <secret>`, resolved by
 * `resolveMcpActor`. `src/proxy.ts` excludes this path from its matcher AND
 * allow-lists it, because a browser redirect to /login is useless to an MCP
 * client — a 401 JSON response is what it needs.
 *
 * Every tool resolves project access through `ctx.resolveProject`, which is the
 * same `verifyProjectAccessAsUser` the HTTP routes use. A token cannot reach
 * anything the account could not reach in the UI.
 */

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

  const JSONRPC_METHOD_NOT_ALLOWED = -32601;
  // Implementation-defined server error, per JSON-RPC 2.0. Rate limited.
  const JSONRPC_RATE_LIMITED = -32029;

function methodNotAllowed(message: string) {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: JSONRPC_METHOD_NOT_ALLOWED, message }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

/**
 * Decide which budget a request draws from, by peeking at the JSON-RPC body.
 *
 * Only `tools/call` for a browser-spawning tool needs the tight window; the
 * handshake and listing are cheap. A malformed body is charged to the general
 * budget and then rejected by the transport, so a client cannot dodge the limiter
 * by sending garbage.
 */
async function bucketForRequest(request: Request): Promise<RateBucket> {
  try {
    // Cloned, because the transport reads the real body afterwards.
    const parsed = (await request.clone().json()) as {
      method?: string;
      params?: { name?: string };
    } | null;
    if (parsed?.method === 'tools/call' && typeof parsed.params?.name === 'string') {
      return bucketForTool(parsed.params.name);
    }
  } catch {
    // Unparseable JSON: charge the general budget and let the transport complain.
  }
  return 'general';
}

export async function GET() {
  // A stateless transport has no server-initiated stream to listen on.
  return methodNotAllowed(
    'MCP is stateless here. Use POST for initialize, tools/list and tools/call.'
  );
}

export async function DELETE() {
  return methodNotAllowed('MCP is stateless here; there is no session to terminate.');
}

export async function POST(request: Request) {
  const actor = await resolveMcpActorWithToken(request);
  if (!actor) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message:
            'Unauthorized. Create a Personal Access Token under Settings → AI Agent Access (MCP) and send it as "Authorization: Bearer <token>".',
        },
        id: null,
      },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="procal-mcp"' },
      }
    );
  }
  const { user, tokenId } = actor;

  // Charge one unit of budget per request. Export tools spawn a headless Chromium
  // instance each, so they draw from a much tighter window than ordinary calls —
  // without a bound, a looping or confused client could saturate the function pool.
  const limit = await consumeRateLimit({ key: tokenId, bucket: await bucketForRequest(request) });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: JSONRPC_RATE_LIMITED,
          message: `Rate limit exceeded (${limit.limit} requests per minute for this token on this endpoint class). Retry in ${limit.retryAfterSeconds}s.`,
        },
        id: null,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const origin = new URL(request.url).origin;
  const server = createMcpServer(user, origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session id, no server-side session state.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (err) {
    console.error('POST /api/mcp Error:', err);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal MCP error',
        },
        id: null,
      },
      { status: 500 }
    );
  } finally {
    // Both objects are per-request; drop the connection so nothing leaks.
    await server.close().catch(() => undefined);
  }
}
