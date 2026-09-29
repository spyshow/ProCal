import { db } from '@/lib/db';
import { verifyPrintTicket } from '@/lib/reports/print-ticket';
import { loadReportData } from '@/lib/reports/load-report-data';
import PrintReportClient from './PrintReportClient';

/**
 * Headless-print entry point for the engineering package.
 *
 * Not a user-facing page. It exists so headless Chromium — which has no session
 * cookie — can render the report through a short-lived signed ticket, and so the
 * PDF path never has to server-render client components.
 *
 * The report schedules are client components because of the "Show Your Work"
 * trace popover, so `renderToStaticMarkup` cannot be used here; see
 * `src/lib/reports/print-ticket.ts` for the full explanation.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { ticket } = await searchParams;
  const payload = verifyPrintTicket(ticket);

  if (!payload) {
    return (
      <html>
        <body style={{ fontFamily: 'sans-serif', padding: 24 }}>
          <h1>Print ticket rejected</h1>
          <p>This link is invalid or has expired. Print tickets last two minutes.</p>
        </body>
      </html>
    );
  }

  // Defence in depth: the ticket is signed, but re-check that the user it names
  // can still read the project, and that the account is not disabled. A ticket
  // minted before a membership or account change must not outlive it.
  const [project, user] = await Promise.all([
    db.project.findUnique({
      where: { id: payload.projectId },
      select: {
        id: true,
        userId: true,
        members: { select: { userId: true } },
      },
    }),
    db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, disabled: true },
    }),
  ]);

  const allowed =
    !!project &&
    !!user &&
    !user.disabled &&
    (user.role === 'ADMIN' ||
      project.userId === user.id ||
      project.members.some((m) => m.userId === user.id));

  if (!allowed) {
    return (
      <html>
        <body style={{ fontFamily: 'sans-serif', padding: 24 }}>
          <h1>Not authorised</h1>
          <p>You no longer have access to this project.</p>
        </body>
      </html>
    );
  }

  const data = await loadReportData(payload.projectId);
  if (!data) {
    return (
      <html>
        <body style={{ fontFamily: 'sans-serif', padding: 24 }}>
          <h1>Project not found</h1>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{data.project.name} - Engineering Package</title>
      </head>
      <body className="bg-white">
        <PrintReportClient
          project={data.project}
          equipment={data.equipment}
          breakerSettings={data.breakerSettings}
          revisions={data.revisions}
          companyName={data.companyName}
          companyLogoUrl={data.companyLogoUrl}
          buildingId={payload.buildingId}
          manufacturer={payload.manufacturer}
        />
      </body>
    </html>
  );
}
