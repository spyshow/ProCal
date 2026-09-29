import { handleAgentRequest } from '@/lib/agent/request';
import { loadDesignGraph } from '@/lib/services/projects';
import { summariseRiser } from '@/mcp/freshness';

export const dynamic = 'force-dynamic';

/** GET /api/agent/v1/projects/:projectId/summary — per-floor ΔV verdicts. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return handleAgentRequest(request, { path: '/projects/:projectId/summary', projectId }, async () => {
    const graph = await loadDesignGraph(projectId);
    if (!graph) throw Object.assign(new Error('Project not found.'), { status: 404 });
    return { summary: summariseRiser(graph as never) };
  });
}
