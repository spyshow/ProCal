import { handleAgentRequest } from '@/lib/agent/request';
import { replaceBuildingLoads } from '@/lib/services/design-writes';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/agent/v1/projects/:projectId/buildings/:buildingId/loads
 *
 * Replaces a building's mechanical loads from the project load library, by name.
 * Every name is resolved before anything is deleted, so a typo leaves the
 * building's existing loads intact.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string; buildingId: string }> }
) {
  const { projectId, buildingId } = await params;
  return handleAgentRequest(
    request,
    {
      path: '/projects/:projectId/buildings/:buildingId/loads',
      projectId,
      projectAccess: { requiredAction: 'EDIT' },
    },
    async () => {
      const body = (await request.json().catch(() => ({}))) as {
        loads?: Array<{ name: string; quantity?: number }>;
      };

      if (!Array.isArray(body.loads)) {
        throw Object.assign(new Error('loads must be an array.'), { status: 400 });
      }

      const applied = await replaceBuildingLoads({
        projectId,
        buildingId,
        loads: body.loads.map((l) => ({ name: l.name, quantity: Number(l.quantity ?? 1) })),
      });

      return { buildingId, applied };
    }
  );
}
