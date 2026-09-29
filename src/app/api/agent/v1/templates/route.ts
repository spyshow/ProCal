import { handleAgentRequest } from '@/lib/agent/request';
import { createApartmentTemplateRow } from '@/lib/services/design-writes';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/v1/templates — define a reusable apartment template.
 *
 * The caller supplies areas and load densities; connected load is derived here,
 * so an agent cannot invent an engineering value.
 */
export async function POST(request: Request) {
  return handleAgentRequest(
    request,
    { path: '/templates', projectAccess: { requiredAction: 'EDIT' } },
    async () => {
      const body = (await request.json().catch(() => ({}))) as {
        projectId?: string;
        name?: string;
        phases?: 1 | 3;
        rooms?: Array<{ name: string; type: string; area: number; loadDensity: number; hasAc?: boolean; acBtu?: number }>;
      };

      if (!body.projectId) throw Object.assign(new Error('projectId is required.'), { status: 400 });
      if (!body.name) throw Object.assign(new Error('name is required.'), { status: 400 });
      if (!body.rooms?.length) throw Object.assign(new Error('At least one room is required.'), { status: 400 });

      const template = await createApartmentTemplateRow({
        projectId: body.projectId,
        name: body.name,
        phases: body.phases ?? 1,
        rooms: body.rooms,
      });

      const connectedLoadVA = template.rooms.reduce((s, r) => s + r.connectedLoad, 0);
      return {
        templateId: template.id,
        name: template.name,
        phases: template.phases,
        rooms: template.rooms,
        connectedLoadVA,
        connectedLoadKw: Number((connectedLoadVA / 1000).toFixed(3)),
      };
    }
  );
}
