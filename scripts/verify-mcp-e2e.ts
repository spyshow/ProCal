import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * End-to-end MCP verification against a RUNNING server.
 *
 * Complements `src/mcp/protocol.test.ts` (in-process, no DB) by exercising the
 * real HTTP path: bearer auth, the proxy allow-list, the actual Postgres queries,
 * and real Chromium PDF generation.
 *
 * Usage:
 *   1. npm run dev                      (or a deployed QA URL)
 *   2. Settings -> AI Agent Access (MCP) -> Create token
 *   3. $env:PROCAL_MCP_URL   = "http://localhost:3000/api/mcp"
 *      $env:PROCAL_MCP_TOKEN = "procal_mcp_..."
 *   4. npx tsx scripts/verify-mcp-e2e.ts
 *
 * Add -ProjectId <uuid> to run the export tools against an existing project
 * instead of skipping them.
 */

const URL_ = process.env.PROCAL_MCP_URL ?? 'http://localhost:3000/api/mcp';
const TOKEN = process.env.PROCAL_MCP_TOKEN;
const PROJECT_ID = process.env.PROCAL_PROJECT_ID;

let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

function parse(result: unknown): Record<string, unknown> {
  const content = (result as { content?: Array<{ type: string; text: string }> }).content ?? [];
  const text = content.find((c) => c.type === 'text')?.text ?? '{}';
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { _unparsed: text.slice(0, 200) };
  }
}

async function main() {
  if (!TOKEN) {
    console.error(
      'PROCAL_MCP_TOKEN is not set.\n' +
        'Create a token in Settings -> AI Agent Access (MCP), then re-run.'
    );
    process.exit(1);
  }

  console.log(`Connecting to ${URL_}\n`);

  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  });
  const client = new Client({ name: 'procal-verify', version: '1.0.0' });

  // --- auth ---------------------------------------------------------------
  console.log('=== 1. authentication ===');
  try {
    await client.connect(transport);
    check('handshake with a valid token', true, client.getServerVersion()?.name ?? '');
  } catch (err) {
    check('handshake with a valid token', false, err instanceof Error ? err.message : String(err));
    return;
  }

  // --- tool surface -------------------------------------------------------
  console.log('\n=== 2. tool surface ===');
  const { tools } = await client.listTools();
  check('tools are advertised', tools.length === 13, `${tools.length} tools`);
  check(
    'all tools are prefixed',
    tools.every((t) => t.name.startsWith('procal_')),
    tools.filter((t) => !t.name.startsWith('procal_')).map((t) => t.name).join(', ')
  );
  console.log('  ' + tools.map((t) => t.name).sort().join('\n  '));

  // --- read tools ---------------------------------------------------------
  console.log('\n=== 3. read tools ===');
  const listResult = parse(await client.callTool({ name: 'procal_list_projects', arguments: {} }));
  check('procal_list_projects', typeof listResult.count === 'number', `${listResult.count} projects`);

  if (PROJECT_ID) {
    const brief = parse(
      await client.callTool({ name: 'procal_get_project_brief', arguments: { projectId: PROJECT_ID } })
    );
    check('procal_get_project_brief', !brief._unparsed, String(brief.name ?? ''));
    check(
      'brief reports engine staleness',
      typeof brief.calculationsAreStale === 'boolean',
      `stale=${brief.calculationsAreStale}`
    );

    const summary = parse(
      await client.callTool({ name: 'procal_get_design_summary', arguments: { projectId: PROJECT_ID } })
    );
    check('procal_get_design_summary', !summary._unparsed, `${String(summary.name ?? '')}`);

    // --- mutation + export ------------------------------------------------
    console.log('\n=== 4. recalculate + exports (slow: launches Chromium) ===');
    const t0 = Date.now();
    const recalc = parse(
      await client.callTool({ name: 'procal_recalculate_project', arguments: { projectId: PROJECT_ID } })
    );
    check(
      'procal_recalculate_project',
      typeof recalc.itemsRecalculated === 'number',
      `${recalc.itemsRecalculated} circuits, wasStale=${recalc.wasStale}`
    );

    for (const tool of ['procal_export_excel', 'procal_export_drawings_pdf', 'procal_export_report_pdf']) {
      const started = Date.now();
      const res = parse(await client.callTool({ name: tool, arguments: { projectId: PROJECT_ID } }));
      const url = res.downloadUrl as string | undefined;
      const size = res.sizeBytes as number | undefined;
      const sheets = res.sheets as string[] | undefined;
      const ok = Boolean(url) && typeof size === 'number' && size > 1024;
      check(
        tool,
        ok,
        `${res.sheetCount ?? sheets?.length ?? ''} ${Math.round((Date.now() - started) / 1000)}s, ${((size ?? 0) / 1024).toFixed(0)} KB`
      );
      if (tool === 'procal_export_drawings_pdf' && typeof res.totalSheets === 'number') {
        console.log(`        ${res.totalSheets} sheets (${res.sldSheets} SLD, ${res.riserSheets} riser)`);
      }

      // Fetch the artifact the way an agent or the user would.
      if (url) {
        const fetched = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
        const buf = Buffer.from(await fetched.arrayBuffer());
        check(
          `  ${tool} artifact downloads`,
          fetched.ok && buf.length === size,
          `${fetched.status} · ${(buf.length / 1024).toFixed(0)} KB · ${fetched.headers.get('content-type')}`
        );
      }
    }
    console.log(`  total export wall-clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } else {
    console.log('\n  (set PROCAL_PROJECT_ID to exercise the recalculate + export tools)');
  }

  // --- error handling -----------------------------------------------------
  console.log('\n=== 5. error handling ===');
  const badUuid = await client.callTool({
    name: 'procal_get_project_brief',
    arguments: { projectId: 'not-a-uuid' },
  });
  check('malformed uuid is rejected, not crashed', badUuid.isError === true);

  const missingProject = await client.callTool({
    name: 'procal_get_project_brief',
    arguments: { projectId: '11111111-1111-4111-8111-111111111111' },
  });
  check('unknown project returns an error result', missingProject.isError === true);

  await client.close();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nverify-mcp-e2e failed:', err);
  process.exitCode = 1;
});
