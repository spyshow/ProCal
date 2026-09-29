import { NextResponse } from 'next/server';
import { authenticateAgentRequest } from '@/lib/agent/request';
import { loadDesignGraph } from '@/lib/services/projects';
import { loadReportData } from '@/lib/services/report-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/agent/v1/projects/:projectId/export/report-pdf
 *
 * Returns the data the engineering package is rendered from rather than the PDF
 * itself. A PDF is a multi-megabyte binary and MCP results are text or JSON, so
 * the MCP tool renders it and stores an artifact; promising a download URL for
 * bytes that were never produced would be a lie.
 *
 * This is the seam that lets an out-of-process agent surface serve the export
 * tools without the caller's own Chromium: the bundle goes over the wire and the
 * caller renders it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await authenticateAgentRequest(request, {
    path: '/projects/:projectId/export/report-pdf',
    projectId,
  });
  if (!auth.ok) return auth.response;

  try {
    const data = await loadReportData(projectId);
    if (!data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('agent export report-pdf error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
