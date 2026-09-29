import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Architecture guard: MCP tools speak to the application layer, never to the
 * database or the services directly.
 *
 * After Release A the tools stopped importing `@/lib/db`, but they still called
 * the service functions by name. That leaves two problems:
 *
 *  - The tool decides how to reach the operation, so the same operation can be
 *    assembled differently by the tool, the HTTP route, and the future agent API.
 *  - Extracting the MCP server into its own process would mean rewriting every
 *    tool, because the import graph assumes it lives beside the database.
 *
 * So tools now go through `AgentApiClient`, which is the only thing they may
 * import from the application layer. The client has two interchangeable
 * transports: an in-process one that calls services directly, and an HTTP one
 * that calls `/api/agent/v1`. Which one is used is configuration, not a rewrite,
 * which is what makes goal 3 (running the agent surface as its own service) a
 * deployment change rather than a refactor.
 */

const SRC = join(process.cwd(), 'src');
const TOOLS_DIR = join(SRC, 'mcp', 'tools');

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

const toolFiles = walk(TOOLS_DIR).filter((f) => !/\.test\.tsx?$/.test(f));

describe('MCP tools go through the agent client', () => {
  it('finds the tool files it is meant to guard', () => {
    expect(toolFiles.length).toBeGreaterThan(2);
  });

  it('no tool imports the database', () => {
    const offenders: string[] = [];
    for (const file of toolFiles) {
      if (/from\s+['"]@\/lib\/db['"]/.test(readFileSync(file, 'utf8'))) offenders.push(rel(file));
    }
    expect(offenders, `tools must reach data via AgentApiClient:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('no tool imports a service directly', () => {
    // The point of the client is that the tool cannot choose how an operation is
    // reached. Importing a service lets it do exactly that.
    const offenders: string[] = [];
    for (const file of toolFiles) {
      if (/from\s+['"]@\/lib\/services\//.test(readFileSync(file, 'utf8'))) offenders.push(rel(file));
    }
    expect(
      offenders,
      `tools must reach services through AgentApiClient:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('the client exists, so the exceptions above are not a loophole', () => {
    const client = join(SRC, 'mcp', 'client', 'agent-api-client.ts');
    let exists = true;
    try {
      statSync(client);
    } catch {
      exists = false;
    }
    expect(exists, 'mcp/client/agent-api-client.ts must exist').toBe(true);
  });
});
