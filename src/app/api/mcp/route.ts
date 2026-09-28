import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { resolveMcpActor } from '@/lib/mcp-auth';
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

function methodNotAllowed(message: string) {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: JSONRPC_METHOD_NOT_ALLOWED, message }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  );
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
  const user = await resolveMcpActor(request);
  if (!user) {
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
