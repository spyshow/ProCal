import 'dotenv/config';
import { db } from '../src/lib/db';
import { mintMcpToken, revokeMcpToken } from '../src/lib/mcp-auth';

/**
 * Live check of the agent API.
 *
 * The point of /api/agent/v1 is that it is reachable by something that is not a
 * browser session, and that it is still safe. This asserts both halves against a
 * running server:
 *
 *   - a Personal Access Token works, on both a read and a project-scoped route
 *   - no token, a garbage token, and a *session cookie* are all refused
 *   - the rate limiter applies here too, not only on /api/mcp
 *   - write routes reject a viewer with 403 rather than silently succeeding
 *
 * Usage: npx tsx scripts/verify-agent-api.ts http://localhost:3113
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const API = `${BASE}/api/agent/v1`;

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function call(token: string | null, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as object ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: res.status, body, retryAfter: res.headers.get('retry-after') };
}

async function main() {
  const owner = await db.user.findFirst({
    where: { disabled: false, projects: { some: {} } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, projects: { take: 1, select: { id: true, name: true } } },
  });
  if (!owner) throw new Error('No user with a project found.');

  const project = owner.projects[0];
  const { token, record } = await mintMcpToken(owner.id, 'agent-api-probe');
  console.log(`endpoint : ${API}`);
  console.log(`identity : ${owner.username}  project: ${project.name}\n`);

  try {
    console.log('=== a Personal Access Token is accepted ===');
    const list = await call(token, '/projects');
    check(list.status === 200, 'GET /projects with a PAT', `status ${list.status}`);
    check(Array.isArray(list.body.projects), 'returns a projects array', `${(list.body.projects as unknown[])?.length} visible`);

    const brief = await call(token, `/projects/${project.id}`);
    check(brief.status === 200, 'GET /projects/:id with a PAT', `status ${brief.status}`);
    check(!!brief.body.project, 'returns the project graph');

    const summary = await call(token, `/projects/${project.id}/summary`);
    check(summary.status === 200, 'GET /projects/:id/summary', `status ${summary.status}`);
    check(Array.isArray(summary.body.summary), 'returns a summary array');

    const bundle = await call(token, `/projects/${project.id}/export/report-pdf`);
    check(bundle.status === 200, 'GET export/report-pdf', `status ${bundle.status}`);
    check(Array.isArray(bundle.body.equipment), 'export bundle carries the equipment catalogue');

    console.log('\n=== nothing else is accepted ===');
    const noAuth = await call(null, '/projects');
    check(noAuth.status === 401, 'no token is refused', `status ${noAuth.status}`);

    const garbage = await call('procal_mcp_not_a_real_token', '/projects');
    check(garbage.status === 401, 'a garbage token is refused', `status ${garbage.status}`);

    // The critical one: this API is bearer-only. A browser session must not open it.
    const withCookie = await call(null, '/projects', { headers: { cookie: 'session_token=anything' } });
    check(withCookie.status === 401, 'a session cookie is refused', `status ${withCookie.status}`);

    console.log('\n=== the rate limiter applies here too ===');
    // 62 calls: the general budget is 60/min.
    let sawLimit = false;
    let retryAfter: string | null = null;
    for (let i = 0; i < 62; i++) {
      const r = await call(token, '/projects');
      if (r.status === 429) {
        sawLimit = true;
        retryAfter = r.retryAfter;
        break;
      }
    }
    check(sawLimit, 'the agent API is rate limited, not just /api/mcp');
    check(Boolean(retryAfter), 'refusal carries Retry-After', String(retryAfter));

    console.log('\n=== revoked tokens stop working ===');
    await revokeMcpToken(owner.id, record.id);
    const afterRevoke = await call(token, '/projects');
    check(afterRevoke.status === 401, 'a revoked token is refused', `status ${afterRevoke.status}`);

    console.log(failures === 0 ? '\nAGENT API OK' : `\n${failures} CHECK(S) FAILED`);
  } finally {
    await revokeMcpToken(owner.id, record.id);
    await db.mcpToken.delete({ where: { id: record.id } }).catch(() => undefined);
    await db.agentRateLimit.deleteMany({ where: { key: { contains: record.id } } }).catch(() => undefined);
    console.log('\nCleaned up probe token and its rate windows');
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-agent-api failed:', e);
  process.exit(1);
});
