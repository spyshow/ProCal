import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Architecture guard: the MCP surface must not talk to the database.
 *
 * The MCP server runs inside the Next.js process. When its tools import `@/lib/db`
 * directly, every business rule they apply is a second implementation of a rule
 * the HTTP routes already enforce — and nothing in the type system or the test
 * suite notices when the two drift. That already happened once: the v1.6.0
 * engineering-PDF bug was a code path that diverged while every test stayed green.
 *
 * The intended shape is that MCP reaches data only through `src/lib/services/*`,
 * the same modules the browser routes use. Services may import `@/lib/db`; the MCP
 * layer may not.
 */

const SRC = join(process.cwd(), 'src');
const MCP_DIR = join(SRC, 'mcp');

/**
 * MCP infrastructure that lives under `src/lib` because the HTTP routes use it
 * too, but which is still the MCP surface and must not query directly.
 */
const EXTRA_MCP_FILES = ['lib/mcp-auth.ts'];

/**
 * The one documented exception: the module that owns `McpToken` and `McpArtifact`
 * access. These two tables are the MCP server's own infrastructure, not shared
 * business data, so they have no browser equivalent to share logic with.
 */
const STORE_FILE = 'lib/mcp-store.ts';

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

describe('MCP layer does not reach the database directly', () => {
  const guarded: string[] = [
    ...walk(MCP_DIR).filter((f) => !/\.test\.tsx?$/.test(f)),
    ...EXTRA_MCP_FILES.map((f) => join(SRC, f)).filter((f) => statSync(f, { throwIfNoEntry: false })),
  ];

  it('finds the MCP source files it is meant to guard', () => {
    // If this ever returns zero, the guard is silently passing on an empty set.
    expect(guarded.length).toBeGreaterThan(5);
  });

  it('no MCP file imports @/lib/db', () => {
    const offenders: string[] = [];
    for (const file of guarded) {
      const r = rel(file);
      if (r === STORE_FILE) continue;
      const source = readFileSync(file, 'utf8');
      if (/from\s+['"]@\/lib\/db['"]/.test(source)) offenders.push(r);
    }
    expect(
      offenders,
      `MCP files must reach the database through src/lib/services/* or ${STORE_FILE}:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('no MCP file re-exports or dynamically imports @/lib/db', () => {
    // Catches the shapes a plain `from` check misses: require(), import(), and
    // re-exports that smuggle the client in through another module.
    const offenders: string[] = [];
    for (const file of guarded) {
      const r = rel(file);
      if (r === STORE_FILE) continue;
      const source = readFileSync(file, 'utf8');
      if (
        /import\s*\(\s*['"]@\/lib\/db['"]/.test(source) ||
        /require\s*\(\s*['"]@\/lib\/db['"]/.test(source) ||
        /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]@\/lib\/db['"]/.test(source)
      ) {
        offenders.push(r);
      }
    }
    expect(offenders, `MCP files must not load @/lib/db indirectly:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('the exception exists, so it does not rot into a loophole', () => {
    // If the store is deleted, the exemption above becomes meaningless and the
    // next person quietly widens it. Keep it honest.
    const store = join(SRC, STORE_FILE);
    let exists = true;
    try {
      statSync(store);
    } catch {
      exists = false;
    }
    expect(exists, `${STORE_FILE} is the documented db exception and must exist`).toBe(true);
  });
});
