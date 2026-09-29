import 'dotenv/config';
import { db } from '../src/lib/db';
import { mintMcpToken, revokeMcpToken } from '../src/lib/mcp-auth';
import { RATE_LIMITS, consumeRateLimit } from '../src/lib/services/rate-limit';

/**
 * Proves the agent rate limiter throttles a real token against a real endpoint.
 *
 * Unit tests mock the database, so they cannot show that the route actually reads
 * the window, or that exports draw from the tighter budget. This mints a token,
 * calls a live MCP endpoint until it is refused, and confirms:
 *   - the refusal is 429 with a JSON-RPC error and a Retry-After header
 *   - the general and export budgets are accounted separately
 *   - a second token is unaffected
 *
 * Usage: npx tsx scripts/verify-rate-limit.ts http://localhost:3111
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const ENDPOINT = `${BASE}/api/mcp`;

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const HANDSHAKE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'rate-limit-probe', version: '1.0.0' },
  },
};

async function call(token: string, body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* SSE-framed responses are not JSON; the status is what matters here */
  }
  return { status: res.status, retryAfter: res.headers.get('retry-after'), json };
}

async function main() {
  const user = await db.user.findFirst({
    where: { disabled: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true },
  });
  if (!user) throw new Error('No user available to mint a token for.');

  const a = await mintMcpToken(user.id, 'rate-limit-probe-a');
  const b = await mintMcpToken(user.id, 'rate-limit-probe-b');
  console.log(`endpoint : ${ENDPOINT}`);
  console.log(`identity : ${user.username}\n`);

  try {
    console.log(`=== general budget (limit ${RATE_LIMITS.general.limit}/min) ===`);
    let firstRefusal: number | null = null;
    let sawRetryAfter = false;
    let jsonRpcCode: unknown;

    // One over the limit, so the refusal is unambiguous.
    for (let i = 1; i <= RATE_LIMITS.general.limit + 2; i++) {
      const r = await call(a.token, HANDSHAKE);
      if (r.status === 429 && firstRefusal === null) {
        firstRefusal = i;
        sawRetryAfter = Boolean(r.retryAfter);
        jsonRpcCode = (r.json as { error?: { code?: number } })?.error?.code;
      }
    }

    check(firstRefusal !== null, 'the general budget eventually refuses a request', `at call #${firstRefusal}`);
    check(
      firstRefusal === RATE_LIMITS.general.limit + 1,
      'refusal happens on the first request past the limit',
      `expected #${RATE_LIMITS.general.limit + 1}, got #${firstRefusal}`
    );
    check(sawRetryAfter, 'refusal carries a Retry-After header');
    check(jsonRpcCode === -32029, 'refusal is a JSON-RPC error, not an HTML crash', `code ${jsonRpcCode}`);

    console.log(`\n=== budgets are per token ===`);
    const other = await call(b.token, HANDSHAKE);
    check(other.status !== 429, 'a second token is not blocked by the first', `status ${other.status}`);

    console.log(`\n=== export budget is separate and tighter (${RATE_LIMITS.export.limit}/min) ===`);
    const c = await mintMcpToken(user.id, 'rate-limit-probe-c');
    try {
      const exportCall = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'procal_export_report_pdf', arguments: { projectId: '00000000-0000-4000-8000-000000000000' } },
      };
      let exportRefusal: number | null = null;
      for (let i = 1; i <= RATE_LIMITS.export.limit + 2; i++) {
        const r = await call(c.token, exportCall);
        if (r.status === 429 && exportRefusal === null) exportRefusal = i;
      }
      check(
        exportRefusal !== null && exportRefusal <= RATE_LIMITS.general.limit,
        'exports hit their ceiling well before the general one',
        `refused at #${exportRefusal} (general limit ${RATE_LIMITS.general.limit})`
      );

      // The general budget for this same token must still be untouched.
      const general = await call(c.token, HANDSHAKE);
      check(general.status !== 429, 'hitting the export ceiling does not spend the general budget', `status ${general.status}`);
    } finally {
      await revokeMcpToken(user.id, c.record.id);
      await db.mcpToken.delete({ where: { id: c.record.id } }).catch(() => undefined);
    }

    console.log(`\n=== stored windows ===`);
    const rows = await db.agentRateLimit.findMany({
      where: { key: { in: [`general:${a.record.id}`, `export:${c.record.id}`] } },
      select: { key: true, count: true },
    });
    for (const r of rows) console.log(`  ${r.key.padEnd(44)} count=${r.count}`);
    check(rows.length > 0, 'windows are persisted per identity and bucket', `${rows.length} rows`);

    console.log(failures === 0 ? '\nRATE LIMIT OK' : `\n${failures} CHECK(S) FAILED`);
  } finally {
    for (const rec of [a.record, b.record]) {
      await revokeMcpToken(user.id, rec.id);
      await db.mcpToken.delete({ where: { id: rec.id } }).catch(() => undefined);
    }
    await db.agentRateLimit
      .deleteMany({ where: { key: { in: [`general:${a.record.id}`, `general:${b.record.id}`] } } })
      .catch(() => undefined);
    console.log('\nCleaned up probe tokens and windows');
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-rate-limit failed:', e);
  process.exit(1);
});
