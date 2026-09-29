import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';

/**
 * Measures what the MCP surface can actually reach inside the app.
 *
 * Goal 3 needs a real boundary, which needs a real number. "The MCP code could
 * reach the admin panel" is a guess until you walk the import graph from the route
 * handler. This does that, and separates what is genuinely needed from what is
 * merely dragged in.
 *
 * Read-only. Run: npx tsx scripts/analyze-mcp-surface.ts
 */

const SRC = join(process.cwd(), 'src');

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) {
    base = join(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec);
  } else {
    return null; // an external package
  }
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

function walkFrom(entry: string) {
  const files = new Set<string>();
  const external = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    if (!existsSync(file)) continue;
    files.add(file);
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      const resolved = resolveSpecifier(spec, file);
      if (resolved) {
        if (!files.has(resolved)) queue.push(resolved);
      } else if (!spec.startsWith('.') && !spec.startsWith('@/')) {
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        external.add(pkg);
      }
    }
  }
  return { files, external };
}

function byArea(files: Set<string>): Map<string, number> {
  const areas = new Map<string, number>();
  for (const f of files) {
    const rel = relative(SRC, f).split('\\').join('/');
    // Group by meaningful boundary rather than full path.
    let area: string;
    if (rel.startsWith('app/api/agent')) area = 'api/agent (the contract)';
    else if (rel.startsWith('app/api/mcp')) area = 'api/mcp (the endpoint)';
    else if (rel.startsWith('app/api/admin')) area = 'app/api/admin  <-- ADMIN';
    else if (rel.startsWith('app/api/billing')) area = 'app/api/billing';
    else if (rel.startsWith('app/api/auth')) area = 'app/api/auth';
    else if (rel.startsWith('app/print')) area = 'app/print (headless render)';
    else if (rel.startsWith('app/(app)')) area = `app/(app) UI  [${rel.split('/')[2]}]`;
    else if (rel.startsWith('app/')) area = 'app/ (other)';
    else if (rel.startsWith('lib/services')) area = 'lib/services  <-- SHARED RULES';
    else if (rel.startsWith('lib/reports')) area = 'lib/reports (PDF/Excel)';
    else if (rel.startsWith('lib/drawings')) area = 'lib/drawings (Chromium)';
    else if (rel.startsWith('lib/calculations')) area = 'lib/calculations (engine)';
    else if (rel.startsWith('lib/billing')) area = 'lib/billing';
    else if (rel.startsWith('lib/agent')) area = 'lib/agent (front door)';
    else if (rel.startsWith('lib/i18n')) area = 'lib/i18n';
    else if (rel.startsWith('mcp/client')) area = 'mcp/client (transport)';
    else if (rel.startsWith('mcp/tools')) area = 'mcp/tools';
    else if (rel.startsWith('mcp')) area = 'mcp (rest)';
    else if (rel.startsWith('components/report')) area = 'components/report (UI)';
    else if (rel.startsWith('components')) area = 'components (UI)';
    else if (rel.startsWith('generated')) area = 'generated (Prisma client)';
    else if (rel.startsWith('hooks')) area = 'hooks';
    else area = 'lib (other)';
    areas.set(area, (areas.get(area) ?? 0) + 1);
  }
  return areas;
}

function report(label: string, entry: string) {
  const { files, external } = walkFrom(entry);
  const areas = [...byArea(files)].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${label} ===`);
  console.log(`entry    : ${relative(SRC, entry)}`);
  console.log(`internal : ${files.size} files`);
  console.log(`external : ${external.size} packages\n  by area:`);
  for (const [area, n] of areas) console.log(`    ${String(n).padStart(4)}  ${area}`);

  const heavy = [...external].filter((p) =>
    /chromium|puppeteer|schematex|resend|stripe|jose|excel|xlsx|pg|prisma/i.test(p)
  );
  if (heavy.length) {
    console.log(`\n  heavy / attack-surface-relevant deps: ${heavy.join(', ')}`);
  }
  const adminish = [...files].filter((f) => /app\/api\/admin|app\/api\/billing|lib\/billing/.test(relative(SRC, f)));
  if (adminish.length) {
    console.log(`\n  admin/billing code reachable (${adminish.length}):`);
    for (const f of adminish.slice(0, 12)) console.log(`    ${relative(SRC, f)}`);
  }
  return { files, external, areas };
}

const mcp = report('MCP endpoint as shipped', join(SRC, 'app/api/mcp/route.ts'));
const agent = report('Agent API (the out-of-process contract)', join(SRC, 'app/api/agent/v1/projects/route.ts'));

console.log('\n=== comparison ===');
console.log(`  MCP endpoint reaches ${mcp.files.size} files, agent API ${agent.files.size}`);
const onlyMcp = [...mcp.files].filter((f) => !agent.files.has(f));
console.log(`  files only the in-process MCP path reaches: ${onlyMcp.length}`);
const areas = byArea(new Set(onlyMcp));
for (const [area, n] of [...areas].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`    ${String(n).padStart(4)}  ${area}`);
}
console.log('\n  That difference is the blast radius that a process boundary would remove.');
