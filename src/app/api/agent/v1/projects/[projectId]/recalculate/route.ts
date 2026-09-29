import { handleAgentRequest } from '@/lib/agent/request';
import { applyApartmentSizing } from '@/lib/services/recalculate';
import { findProjectRow } from '@/lib/services/projects';
import { ENGINE_VERSION } from '@/lib/calculations/version';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/agent/v1/projects/:projectId/recalculate
 *
 * Re-derives every apartment circuit and stamps the engine version. Requires
 * EDIT: it rewrites stored demand values, which is a design change, not a read.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return handleAgentRequest(
    request,
    {
      path: '/projects/:projectId/recalculate',
      projectId,
      projectAccess: { requiredAction: 'EDIT' },
    },
    async () => {
      const project = await findProjectRow(projectId);
      if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 });

      if (project.engineVersion === ENGINE_VERSION) {
        return { wasStale: false, engineVersion: project.engineVersion, itemsRecalculated: 0 };
      }

      const result = await applyApartmentSizing(projectId);
      return {
        wasStale: true,
        engineVersion: ENGINE_VERSION,
        itemsRecalculated: result?.itemsRecalculated ?? 0,
      };
    }
  );
}
