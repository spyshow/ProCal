import { NextResponse } from 'next/server';
import { authenticateAgentRequest } from '@/lib/agent/request';
import { loadDesignGraph } from '@/lib/services/projects';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/agent/v1/projects/:projectId/export/drawings-pdf
 *
 * The drawing generator reads the design graph, not the report bundle: the SLD and
 * riser are rendered from circuit topology. Returned for the caller to render,
 * because a drawing pack is a multi-megabyte binary.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await authenticateAgentRequest(request, {
    path: '/projects/:projectId/export/drawings-pdf',
    projectId,
  });
  if (!auth.ok) return auth.response;

  try {
    const graph = await loadDesignGraph(projectId);
    if (!graph) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json({ project: graph });
  } catch (err) {
    console.error('agent export drawings-pdf error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
