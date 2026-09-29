import { NextResponse } from 'next/server';
import { authenticateAgentRequest } from '@/lib/agent/request';
import { loadReportData } from '@/lib/services/report-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/agent/v1/projects/:projectId/export/excel
 *
 * The report bundle again, but the workbook builder consumes the equipment
 * catalogue and breaker settings from it, which the report renderer also needs.
 * Both exports are read-only projections of the same recalculated project, so
 * serving one payload keeps the caller from reimplementing the freshness check.
 *
 * The workbook itself is built by the caller: it is binary, and MCP results are
 * text or JSON.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await authenticateAgentRequest(request, {
    path: '/projects/:projectId/export/excel',
    projectId,
  });
  if (!auth.ok) return auth.response;

  try {
    const data = await loadReportData(projectId);
    if (!data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('agent export excel error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
