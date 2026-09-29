import { handleAgentRequest } from '@/lib/agent/request';
import { assignFloorTemplateRow } from '@/lib/services/design-writes';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/v1/projects/:projectId/floors/assign-template
 *
 * Replaces a floor's apartment circuits from a template. Destructive by design, so
 * the caller must pass the full intended count.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return handleAgentRequest(
    request,
    {
      path: '/projects/:projectId/floors/assign-template',
      projectId,
      projectAccess: { requiredAction: 'EDIT' },
    },
    async () => {
      const body = (await request.json().catch(() => ({}))) as {
        floorDesignId?: string;
        templateName?: string;
        apartmentCount?: number;
      };

      if (!body.floorDesignId || !body.templateName) {
        throw Object.assign(new Error('floorDesignId and templateName are required.'), { status: 400 });
      }

      const result = await assignFloorTemplateRow({
        projectId,
        floorDesignId: body.floorDesignId,
        templateName: body.templateName,
        apartmentCount: Number(body.apartmentCount ?? 0),
      });

      return { floorDesignId: body.floorDesignId, ...result };
    }
  );
}
