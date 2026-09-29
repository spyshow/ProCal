import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regression guard for the v1.6.0 bug where `procal_export_report_pdf` failed in
 * production with a React Server Component error.
 *
 * The report schedules are client components because `TraceableCell` owns the
 * "Show Your Work" trace popover. A server module that imports one and hands it
 * to `renderToStaticMarkup` compiles fine and passes every unit test — Vitest
 * applies no RSC transform — but at runtime Next substitutes a client-reference
 * proxy and rendering throws. Nothing but a real build catches it.
 *
 * So assert the invariant structurally: no module reachable from the server-side
 * report path may carry a `'use client'` directive.
 */

const SRC = join(process.cwd(), 'src');

/** Files that legitimately cross the boundary from the server report path. */
const ALLOWED_CLIENT_FILES = new Set([
  // Rendered by Chromium at the print route, not by the server.
  'components/report/PrintReportClient.tsx',
  'components/report/CoverPage.tsx',
  'components/report/LoadSchedule.tsx',
  'components/report/MDBSchedule.tsx',
  'components/report/CableSchedule.tsx',
  'components/report/BreakerSchedule.tsx',
  'components/report/VDSchedule.tsx',
  'components/report/ShortCircuitSchedule.tsx',
  'components/report/BOMSchedule.tsx',
  'components/report/ReportHeader.tsx',
  'components/common/TraceableCell.tsx',
  'components/common/CalculationTracePopover.tsx',
  'hooks/useEquipmentCatalog.ts',
  'hooks/useTranslation.ts',
]);

/** Entry points that must stay server-safe. */
const SERVER_ENTRY_POINTS = [
  'lib/reports/render-report-html.tsx',
  'lib/reports/print-report-pdf.ts',
  'lib/reports/print-ticket.ts',
  'lib/reports/load-report-data.ts',
  'lib/reports/inline-images.ts',
  'lib/reports/server-pdf.ts',
  'app/api/projects/[id]/pdf/route.ts',
];

function isTsFile(f: string): boolean {
  return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f);
}

/** Walk relative imports from an entry point, staying inside src/. */
function collectImports(entry: string, seen = new Set<string>()): Map<string, string> {
  const results = new Map<string, string>();
  const abs = join(SRC, entry);
  let source: string;
  try {
    source = readFileSync(abs, 'utf8');
  } catch {
    return results;
  }
  if (seen.has(entry)) return results;
  seen.add(entry);

  const importRe = /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    const spec = m[1];
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;

    // Resolve the specifier to a path inside src/, trying the usual extensions.
    const base = spec.startsWith('@/') ? spec.slice(2) : join(entry, '..', spec);
    const normalized = base.split('\\').join('/');
    const dir = normalized.startsWith('..') ? join(SRC, '..') : SRC;
    const target = normalized.startsWith('..') ? join(SRC, normalized) : join(SRC, normalized);

    let resolved: string | null = null;
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), join(target, 'index.tsx')]) {
      try {
        if (statSync(candidate).isFile()) {
          resolved = candidate.split('\\').join('/').replace(/\\/g, '/');
          break;
        }
      } catch {
        /* keep trying */
      }
    }
    if (!resolved) continue;
    const rel = resolved.replace(SRC.split('\\').join('/'), '').replace(/^\//, '');
    if (seen.has(rel)) continue;
    results.set(rel, rel);
    for (const [k, v] of collectImports(rel, seen)) results.set(k, v);
  }
  return results;
}

describe('server report path has no client boundary', () => {
  for (const entry of SERVER_ENTRY_POINTS) {
    it(`${entry} never imports a 'use client' module`, () => {
      const graph = collectImports(entry);
      const offenders: string[] = [];

      for (const rel of graph.keys()) {
        if (ALLOWED_CLIENT_FILES.has(rel)) continue;
        // The graph may legitimately reach client components *through* the print
        // client component, which is itself in the allow-list and is rendered by
        // Chromium. Only flag modules reachable without passing through it.
        let source: string;
        try {
          source = readFileSync(join(SRC, rel), 'utf8');
        } catch {
          continue;
        }
        if (/^\s*['"]use client['"]/m.test(source)) offenders.push(rel);
      }

      expect(offenders, `client components reachable from ${entry}: ${offenders.join(', ')}`).toEqual([]);
    });
  }

  it('render-report-html.tsx does not import the report schedules at all', () => {
    const source = readFileSync(join(SRC, 'lib/reports/render-report-html.tsx'), 'utf8');
    // The original defect: this module imported the nine schedules and rendered
    // them with renderToStaticMarkup. It should now only supply the wrapper.
    expect(source).not.toMatch(/@\/components\/report\//);
    expect(source).not.toMatch(/from\s+['"]react-dom\/server['"]/);
    expect(source).not.toMatch(/\.renderToStaticMarkup\s*\(/);
  });

  it('the print page crosses the client boundary exactly once, at PrintReportClient', () => {
    // The print page is the one server module that *deliberately* renders a client
    // component: Chromium needs a real React tree for the trace popover. Exactly
    // one client import is acceptable there, and everything else must stay server.
    const source = readFileSync(join(SRC, 'app/print/report/page.tsx'), 'utf8');
    const direct = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g))
      .map((m) => m[1])
      .filter((s) => s.startsWith('.') || s.startsWith('@/'));

    expect(direct).toContain('./PrintReportClient');

    const clientDirect = direct.filter((spec) => {
      const base = spec.startsWith('@/') ? spec.slice(2) : spec.replace(/^\.\//, '');
      const candidates = spec.startsWith('@/')
        ? [`${base}.tsx`, `${base}.ts`]
        : [
            join('app/print/report', `${base}.tsx`),
            join('app/print/report', `${base}.ts`),
          ];
      for (const rel of candidates) {
        try {
          const body = readFileSync(join(SRC, rel), 'utf8');
          if (/^\s*['"]use client['"]/m.test(body)) return true;
        } catch {
          /* try next candidate */
        }
      }
      return false;
    });

    expect(clientDirect, 'print page may only import PrintReportClient as a client module').toEqual([
      './PrintReportClient',
    ]);
  });

  it('the schedules remain client components, so the browser trace popover works', () => {
    // If someone "fixes" this by stripping 'use client' from the schedules, the
    // popover breaks in the UI. The trade is deliberate: render in a browser.
    for (const rel of ['components/report/CoverPage.tsx', 'components/common/TraceableCell.tsx']) {
      const source = readFileSync(join(SRC, rel), 'utf8');
      expect(/^\s*['"]use client['"]/m.test(source), `${rel} should stay a client component`).toBe(true);
    }
  });
});
