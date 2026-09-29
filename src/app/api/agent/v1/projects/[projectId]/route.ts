import { handleAgentRequest } from '@/lib/agent/request';
import { loadDesignGraph } from '@/lib/services/projects';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/v1/projects/:projectId — the project brief.
 *
 * The same design graph the calculation engine and report renderer read, so a
 * caller sees the numbers the report will contain rather than a summary of them.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return handleAgentRequest(request, { path: '/projects/:projectId', projectId }, async () => {
    const graph = await loadDesignGraph(projectId);
    if (!graph) throw Object.assign(new Error('Project not found.'), { status: 404 });
    return { project: graph };
  });
}
