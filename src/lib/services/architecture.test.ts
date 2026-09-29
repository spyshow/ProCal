import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Architecture guard: shared business rules have exactly one implementation.
 *
 * The design-graph query — a project with its buildings, floor designs, circuit
 * items, apartment templates, rooms, building loads and load library — was
 * written out six times across the app, each copy free to drift. The recalculate
 * rule was worse: `isUndersizedForLoad`, an overload-safety check that clears a
 * manually-set breaker smaller than its design current, existed twice, and the
 * MCP copy described the other as one it "mirrors".
 *
 * Duplication here is not tidiness. On a write path, drift corrupts stored
 * engineering numbers while the app still looks correct.
 *
 * Both rules now live in `src/lib/services/*`, used by both the browser routes
 * and the MCP tools.
 */

const SRC = join(process.cwd(), 'src');
const SERVICES = join(SRC, 'lib', 'services');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

function rel(file: string): string {
  return relative(SRC, file).split('\\').join('/');
}

/**
 * Files allowed to keep their own copy of the design-graph shape.
 *
 * `lib/revisions.ts` is exempt on purpose. A revision snapshot is a historical
 * record: it is serialised when an issue is cut and read back years later by the
 * restore and diff paths. If it tracked the live design graph, a routine refactor
 * would change the shape of already-issued revisions and make old snapshots
 * unrestorable. That data is deliberately frozen.
 */
const DESIGN_GRAPH_EXEMPT = new Set(['lib/revisions.ts']);

/** Every source file that could plausibly contain a duplicated query. */
function allSourceFiles(): string[] {
  const acc: string[] = [];
  for (const dir of ['app', 'lib', 'mcp']) {
    const full = join(SRC, dir);
    if (statSync(full, { throwIfNoEntry: false })) walk(full, acc);
  }
  return acc;
}

describe('shared rules have one implementation', () => {
  it('lib/services exists', () => {
    // Guards the rest of this file from passing vacuously.
    expect(statSync(SERVICES, { throwIfNoEntry: false })?.isDirectory()).toBe(true);
  });

  it('defines the project design-graph query in exactly one place', () => {
    // The combination that identifies "the full design graph": apartment templates
    // with their rooms, plus the load library.
    const marker = /apartmentTemplates:\s*\{[^}]*include:\s*\{\s*rooms:\s*true/;
    const offenders = allSourceFiles()
      .filter((f) => marker.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((r) => !r.startsWith('lib/services/') && !DESIGN_GRAPH_EXEMPT.has(r));

    expect(
      offenders,
      `The design-graph query must live in src/lib/services/projects.ts only. Duplicated in:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('defines the undersized-breaker safety rule in exactly one place', () => {
    const marker = /isUndersizedForLoad/;
    const offenders = allSourceFiles()
      .filter((f) => marker.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((r) => !r.startsWith('lib/services/'));

    expect(
      offenders,
      `The undersized-breaker rule must live in src/lib/services/recalculate.ts only. Duplicated in:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('services never import from the HTTP layer or the MCP layer', () => {
    // Keeps the dependency arrow pointing one way: routes and tools call services,
    // services call the database. A service importing a route would invert that.
    const offenders: string[] = [];
    for (const file of walk(SERVICES)) {
      const source = readFileSync(file, 'utf8');
      if (/from\s+['"]@\/app\//.test(source) || /from\s+['"]@\/mcp\//.test(source)) {
        offenders.push(rel(file));
      }
    }
    expect(
      offenders,
      `services must not import from app or mcp:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});
