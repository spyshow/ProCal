import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';

/**
 * Pins the database blast radius of the agent surface.
 *
 * The MCP tools must not be able to reach the database, directly or by accident.
 * Release A made that true for direct imports; this makes it true transitively,
 * and pins *which* modules are allowed to hold a database handle on the MCP path.
 *
 * Why this matters more than it looks. Measuring the import graph from
 * /api/mcp shows 90 reachable files, of which 24 can reach `@/lib/db`. The tools
 * themselves are not among them — the services they call are, deliberately,
 * because a service is the shared implementation both the browser routes and the
 * agent use. That is the intended design, and it is also the whole risk: a service
 * holds a credential, so a bug inside one is privileged.
 *
 * There is no process boundary here (goal 3), and there is not meant to be one.
 * What we can do is make the blast radius an explicit, tested number rather than
 * an accident: if a tenth module gains a database handle on this path, or a tool
 * reaches one directly, the build fails.
 *
 * Any new module added to ALLOWED_DATA_OWNERS below is a deliberate decision to
 * widen the agent's database surface. It should be reviewed as one.
 */

const SRC = join(process.cwd(), 'src');
const TOOLS_DIR = join(SRC, 'mcp', 'tools');

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

/**
 * Modules permitted to hold a database handle on the agent path.
 *
 * Grouped by why each is here, because "add my file to the list" is only a safe
 * review if the reason is visible.
 */
const ALLOWED_DATA_OWNERS = {
  /** Shared business rules. Reached by the tools, and by the browser routes. */
  'lib/services/projects.ts': 'project reads and the design graph',
  'lib/services/recalculate.ts': 'apartment sizing and the recalculate rule',
  'lib/services/design-writes.ts': 'project construction writes',
  'lib/services/report-data.ts': 'the printable deliverable bundle',
  'lib/services/rate-limit.ts': 'per-token rate-limit windows',

  /**
   * MCP-owned infrastructure. Not shared with the browser, because the browser
   * has no equivalent: PATs and generated artifacts exist only for agents.
   *
   * `lib/mcp-auth.ts` is deliberately absent: it used to hold a database handle
   * and no longer does, since token persistence moved here. That was a real
   * reduction, found by this guard.
   */
  'lib/mcp-store.ts': 'McpToken and McpArtifact — agent infrastructure',

  /** Authorisation. Every tool resolves access through this. */
  'lib/project-auth.ts': 'membership and page permissions',

  /**
   * Session authentication. Statically reachable because project-auth imports
   * getSessionUser for the cookie-based wrapper — but the agent path calls
   * verifyProjectAccessAsUser directly and never invokes it. Listed because it
   * holds a database handle and is in the bundle, so a bug could reach it even
   * though no agent request does.
   */
  'lib/auth.ts': 'session user lookup — reachable via project-auth, unused by agents',

  /** Billing gate consulted before a project is created. */
  'lib/billing/entitlement.ts': 'project capacity check',

  /** Audit trail for agent-initiated writes. */
  'lib/audit-logger.ts': 'activity log entries',

  /** Report rendering, which reads company settings and project defaults. */
  'lib/app-settings.ts': 'company name and logo',
  'lib/project-defaults.ts': 'default templates seeded on project creation',
} as const;

type AllowedPath = keyof typeof ALLOWED_DATA_OWNERS;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

function rel(file: string): string {
  return relative(SRC, file).split('\\').join('/');
}

function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(candidate).isFile()) return rel(candidate);
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/** Every file reachable from an entry, by static and dynamic import. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const abs = queue.pop()!;
    const r = rel(abs);
    if (seen.has(r)) continue;
    let source: string;
    try {
      source = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    seen.add(r);
    for (const m of source.matchAll(IMPORT_RE)) {
      const target = resolveSpecifier(m[1], abs);
      if (target && !seen.has(target)) queue.push(join(SRC, target));
    }
  }
  return seen;
}

function importsDb(source: string): boolean {
  // Both the aliased and the relative spelling. A guard that only matched the alias
  // would let `from './db'` through, which is the same credential by another name.
  return /from\s+['"](?:@\/lib\/db|\.{1,2}\/[^'"]*\/db|\.\/db)['"]/.test(source);
}

const toolFiles = walk(TOOLS_DIR).filter((f) => !/\.test\.tsx?$/.test(f));
const allowed = new Set<string>(Object.keys(ALLOWED_DATA_OWNERS));

describe('the agent surface has a pinned database blast radius', () => {
  it('finds the tool files it is guarding', () => {
    expect(toolFiles.length).toBeGreaterThan(2);
  });

  it('no tool file imports the database directly', () => {
    const offenders = toolFiles.filter((f) => importsDb(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders, `tools must reach data through services:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('every allow-listed owner still exists and still imports the database', () => {
    // A stale entry would let the real set grow silently: removing the only
    // importer of @/lib/db from a module would make it invisible here.
    const stale: string[] = [];
    for (const p of allowed) {
      const file = join(SRC, p);
      try {
        if (!importsDb(readFileSync(file, 'utf8'))) stale.push(`${p} — no longer imports @/lib/db`);
      } catch {
        stale.push(`${p} — file not found`);
      }
    }
    expect(stale, `allow-list entries that no longer hold a database handle:\n  ${stale.join('\n  ')}`).toEqual([]);
  });

  it('the data owners reachable from the tools are exactly the allow-list', () => {
    const reachable = new Set<string>();
    for (const tool of toolFiles) {
      for (const file of reachableFrom(tool)) {
        try {
          if (importsDb(readFileSync(join(SRC, file), 'utf8'))) reachable.add(file);
        } catch {
          /* not a file we can read */
        }
      }
    }

    const unexpected = [...reachable].filter((f) => !allowed.has(f));
    expect(
      unexpected,
      `the agent path reaches a database owner that is not on the list. Adding one is a\n` +
        `deliberate widening of the agent's database surface:\n  ${unexpected.join('\n  ')}`
    ).toEqual([]);

    const unused = [...allowed].filter((f) => !reachable.has(f));
    // Not a failure: a tool may stop using an owner. Worth seeing, not worth blocking.
    if (unused.length) {
      console.info(`      note: ${unused.length} allow-list entries are no longer reached from the tools`);
    }
  });

  it('the allow-list has a recorded reason for every entry', () => {
    for (const [path, reason] of Object.entries(ALLOWED_DATA_OWNERS)) {
      expect(reason, `${path} needs a reason`).toBeTruthy();
      expect(reason.length, `${path} reason is too terse to review`).toBeGreaterThan(10);
    }
  });
});
