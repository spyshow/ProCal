import 'dotenv/config';
import { db } from '../src/lib/db';
import { mintMcpToken, revokeMcpToken } from '../src/lib/mcp-auth';

/**
 * Disposable authenticated smoke test against a DEPLOYED MCP endpoint.
 *
 * Mints a token for a throwaway QA account, drives a real MCP client against the
 * live server, then revokes and deletes the token. Leaves no trace.
 *
 * Usage: PROCAL_MCP_URL=https://procal-mu.vercel.app/api/mcp npx tsx scripts/verify-live-mcp.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const rawUrl = process.env.PROCAL_MCP_URL;
if (!rawUrl) {
  console.error('Set PROCAL_MCP_URL, e.g. https://procal-mu.vercel.app/api/mcp');
  process.exit(1);
}
const URL_: string = rawUrl;

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function main() {
  // A clearly disposable auto-generated QA account, never a real user.
  const user = await db.user.findFirst({
    where: { OR: [{ username: { startsWith: 'qa_' } }, { username: { startsWith: 'engineer_1' } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, role: true, credits: true },
  });
  if (!user) {
    console.error('No disposable QA account found to test with.');
    process.exit(1);
  }
  console.log(`Using disposable account: ${user.username} (${user.role}, ${user.credits} credits)\n`);

  const { token, record } = await mintMcpToken(user.id, 'live-smoke-test');
  console.log(`Minted token ${record.prefix}…\n`);

  try {
    console.log('=== 1. handshake ===');
    const transport = new StreamableHTTPClientTransport(new URL(URL_), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client = new Client({ name: 'procal-live-smoke', version: '1.0.0' });
    await client.connect(transport);
    check('initialize succeeds', true, `server ${client.getServerVersion()?.name} v${client.getServerVersion()?.version}`);
    check('tools capability advertised', Boolean(client.getServerCapabilities()?.tools));

    console.log('\n=== 2. tool list over the wire ===');
    const { tools } = await client.listTools();
    check('13 tools advertised', tools.length === 13, `${tools.length}`);
    for (const t of tools) {
      console.log(
        `    ${t.name.padEnd(36)} read=${String(t.annotations?.readOnlyHint ?? '-').padEnd(5)} schema=${t.inputSchema.type}`
      );
    }

    console.log('\n=== 3. dispatch a real tool ===');
    const res = await client.callTool({ name: 'procal_list_projects', arguments: {} });
    check('procal_list_projects returns without error', res.isError !== true);
    const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? '{}';
    let parsed: { count?: number } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* handled by the assertion below */
    }
    check('returns parseable JSON', parsed.count !== undefined, `count=${parsed.count}`);

    console.log('\n=== 4. input validation is enforced remotely ===');
    const bad = await client.callTool({
      name: 'procal_get_project_brief',
      arguments: { projectId: 'not-a-uuid' },
    });
    check('malformed uuid rejected server-side', bad.isError === true);

    console.log('\n=== 5. a revoked token stops working immediately ===');
    await revokeMcpToken(user.id, record.id);
    const transport2 = new StreamableHTTPClientTransport(new URL(URL_), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client2 = new Client({ name: 'procal-live-smoke-2', version: '1.0.0' });
    let rejected = false;
    try {
      await client2.connect(transport2);
    } catch {
      rejected = true;
    }
    check('revoked token is refused', rejected);

    await client.close();
    console.log(`\n${failures === 0 ? 'LIVE SMOKE OK' : `${failures} CHECK(S) FAILED`}`);
  } finally {
    // Clean up: revoke if not already, then hard-delete the token row.
    await db.mcpToken.deleteMany({ where: { id: record.id } }).catch(() => undefined);
    console.log(`\nCleaned up token ${record.id}`);
  }

  if (failures > 0) process.exitCode = 1;
  process.exit(0);
}

main().catch((e) => {
  console.error('live smoke error:', e);
  process.exit(1);
});
