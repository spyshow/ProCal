import { handleAgentRequest } from '@/lib/agent/request';
import { upsertBuildingRow, replaceBuildingLoads } from '@/lib/services/design-writes';

export const dynamic = 'force-dynamic';

/** POST /api/agent/v1/buildings — create or update a building and its floors. */
export async function POST(request: Request) {
  return handleAgentRequest(
    request,
    { path: '/buildings', projectAccess: { requiredAction: 'EDIT' } },
    async () => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      if (!body.projectId) throw Object.assign(new Error('projectId is required.'), { status: 400 });

      const { projectId, buildingId, floors, ...fields } = body;

      const result = await upsertBuildingRow({
        projectId: projectId as string,
        buildingId: buildingId as string | undefined,
        fields: fields as never,
        floors: floors as never,
      });

      return {
        buildingId: result.building.id,
        name: result.building.name,
        updatedFloors: result.updatedFloors,
      };
    }
  );
}
