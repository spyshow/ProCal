import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { AGENT_ROUTES, buildAgentUrl } from './agent-routes';

/**
 * Drift guard between the two surfaces that serve the same operations.
 *
 * The MCP tools and the `/api/agent/v1` HTTP API both exist so that a caller can
 * reach the same thirteen operations. When they are defined separately they drift:
 * a tool grows a parameter the route drops, or a route ships with no tool behind
 * it. Nothing in the type system or an ordinary test notices, because both sides
 * are independently valid.
 *
 * The correspondence is declared once in `agent-routes.ts`. These tests fail if
 * either surface stops matching it.
 */

const SRC = join(process.cwd(), 'src');
const TOOLS_DIR = join(SRC, 'mcp', 'tools');
const AGENT_DIR = join(SRC, 'app', 'api', 'agent', 'v1');

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
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

/** Every tool name registered with the MCP server. */
function registeredTools(): Set<string> {
  const names = new Set<string>();
  for (const file of walk(TOOLS_DIR)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/'(procal_[a-z_]+)'/g)) names.add(m[1]);
  }
  return names;
}

/**
 * Next.js file-system routing: `projects/[projectId]/route.ts` serves
 * `/projects/:projectId`, so a spec path maps to a path with a `[param]` segment.
 */
function routeFileFor(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? `[${seg.slice(1)}]` : seg))
    .join('/');
}

describe('agent API and MCP tools stay in step', () => {
  it('every registered tool has an entry in the route map', () => {
    const tools = registeredTools();
    expect(tools.size).toBeGreaterThanOrEqual(13);

    const mapped = new Set(AGENT_ROUTES.map((r) => r.tool));
    const unmapped = [...tools].filter((t) => !mapped.has(t));
    expect(unmapped, `tools with no agent API endpoint:\n  ${unmapped.join('\n  ')}`).toEqual([]);
  });

  it('the route map has no entry for a tool that does not exist', () => {
    const tools = registeredTools();
    const phantom = AGENT_ROUTES.map((r) => r.tool).filter((t) => !tools.has(t));
    expect(phantom, `route map references tools that were renamed or removed:\n  ${phantom.join('\n  ')}`).toEqual([]);
  });

  it('every route in the map is actually implemented', () => {
    const missing: string[] = [];
    for (const spec of AGENT_ROUTES) {
      const file = join(AGENT_DIR, routeFileFor(spec.path), 'route.ts');
      if (!existsSync(file)) missing.push(`${spec.method} ${spec.path}  (expected ${rel(file)})`);
    }
    expect(missing, `agent API endpoints declared but not implemented:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('implements the method the map claims, not just the path', () => {
    const wrong: string[] = [];
    for (const spec of AGENT_ROUTES) {
      const file = join(AGENT_DIR, routeFileFor(spec.path), 'route.ts');
      if (!existsSync(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (!new RegExp(`export async function ${spec.method}\\b`).test(source)) {
        const found = ['GET', 'POST', 'PUT', 'DELETE'].filter((m) =>
          new RegExp(`export async function ${m}\\b`).test(source)
        );
        wrong.push(`${spec.path}: map says ${spec.method}, file exports ${found.join('/') || 'nothing'}`);
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('has no agent route file that the map does not cover', () => {
    const declared = new Set(AGENT_ROUTES.map((r) => routeFileFor(r.path)));
    const orphans: string[] = [];
    for (const file of walk(AGENT_DIR)) {
      if (!file.endsWith('route.ts')) continue;
      const routePath = '/' + rel(file).replace(/^app\/api\/agent\/v1\//, '').replace(/\/route\.ts$/, '');
      if (!declared.has(routePath)) orphans.push(routePath);
    }
    expect(orphans, `agent route files with no entry in the map:\n  ${orphans.join('\n  ')}`).toEqual([]);
  });
});

describe('buildAgentUrl', () => {
  it('substitutes and encodes parameters', () => {
    const spec = { method: 'GET' as const, path: '/projects/:projectId/export/excel', tool: 'x' };
    expect(buildAgentUrl(spec, { projectId: 'abc-123' })).toBe(
      '/api/agent/v1/projects/abc-123/export/excel'
    );
  });

  it('refuses to build a URL with a missing parameter', () => {
    // Silently producing /projects/undefined would reach the wrong route.
    const spec = { method: 'GET' as const, path: '/projects/:projectId', tool: 'x' };
    expect(() => buildAgentUrl(spec, {})).toThrow(/projectId/);
  });

  it('leaves a static path untouched', () => {
    const spec = { method: 'GET' as const, path: '/projects', tool: 'x' };
    expect(buildAgentUrl(spec)).toBe('/api/agent/v1/projects');
  });
});
