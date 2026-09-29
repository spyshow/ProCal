import 'dotenv/config';
import { db } from '../src/lib/db';
import { createPrintTicket } from '../src/lib/reports/print-ticket';
import { generateReportPdfFromPrintRoute } from '../src/lib/reports/print-report-pdf';

/**
 * End-to-end check of the report PDF path that failed in v1.6.0.
 *
 * The unit suite and `next build` both passed while `procal_export_report_pdf`
 * threw in production, so this exercises the real thing: a running server, a real
 * project, a real Chromium print, and a page count.
 *
 * Usage: npx tsx scripts/verify-report-pdf.ts [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:3000';

function pdfPageCount(buf: Buffer): number {
  const text = buf.toString('latin1');
  const counts = text.match(/\/Type\s*\/Page[^s]/g);
  return counts ? counts.length : 0;
}

async function main() {
  // A project with real design content, and a user who can actually read it.
  const project = await db.project.findFirst({
    where: { buildings: { some: {} } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      userId: true,
      members: { select: { userId: true } },
      _count: { select: { buildings: true } },
    },
  });
  if (!project) throw new Error('No project with buildings found.');

  const userId = project.userId;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, disabled: true },
  });
  if (!user) throw new Error('Project owner not found.');

  console.log(`project : ${project.name}`);
  console.log(`         ${project._count.buildings} building(s), id=${project.id}`);
  console.log(`user    : ${user.username} (${user.role})`);
  console.log(`base    : ${BASE}\n`);

  const ticket = createPrintTicket({ projectId: project.id, userId: user.id });
  const printUrl = `${BASE}/print/report?ticket=${encodeURIComponent(ticket)}`;
  console.log(`print   : ${BASE}/print/report?ticket=${ticket.slice(0, 24)}…\n`);

  const started = Date.now();
  const pdf = await generateReportPdfFromPrintRoute(
    printUrl,
    `${project.name} - Engineering Package`
  );
  const elapsed = Date.now() - started;

  const pages = pdfPageCount(pdf);
  const head = pdf.subarray(0, 5).toString('latin1');

  console.log('--- result ---');
  console.log(`elapsed  : ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`bytes    : ${pdf.byteLength.toLocaleString()}`);
  console.log(`pages    : ${pages}`);
  console.log(`header   : ${head} ${head === '%PDF-' ? '(valid PDF)' : '(NOT A PDF!)'}`);

  let failures = 0;
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failures++;
  };

  console.log('');
  check(head === '%PDF-', 'output is a real PDF');
  check(pdf.byteLength > 20000, 'PDF is not empty (has content)');
  // 8 scheduled pages; allow a little slack for schedules that overflow.
  check(pages >= 8, `has at least the 8 scheduled pages (got ${pages})`);

  if (failures === 0) console.log('\nREPORT PDF OK');
  else console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-report-pdf failed:', e);
  process.exit(1);
});
