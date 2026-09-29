import { handleAgentRequest } from '@/lib/agent/request';
import { listVisibleProjects } from '@/lib/services/projects';
import { createProjectRow } from '@/lib/services/design-writes';

export const dynamic = 'force-dynamic';

/** GET /api/agent/v1/projects — projects the token's owner can see. */
export async function GET(request: Request) {
  return handleAgentRequest(request, { path: '/projects' }, async ({ user }) => ({
    projects: await listVisibleProjects(user.id),
  }));
}

/**
 * POST /api/agent/v1/projects — create a project from a declarative spec.
 *
 * Creates the project row, its creator membership and the default templates. The
 * spec's buildings and circuits are materialised by the caller so that a failure
 * part-way can refund the credit the MCP tool charged.
 */
export async function POST(request: Request) {
  return handleAgentRequest(request, { path: '/projects' }, async ({ user }) => {
    const spec = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!spec || typeof spec.name !== 'string' || spec.name.length === 0) {
      throw Object.assign(new Error('A project name is required.'), { status: 400 });
    }

    const project = await createProjectRow({
      name: spec.name,
      client: (spec.client as string) ?? '',
      consultant: (spec.consultant as string) ?? '',
      contractor: (spec.contractor as string) ?? '',
      location: (spec.location as string) ?? '',
      engineer: (spec.engineer as string) || user.name || user.username || '',
      voltage: Number(spec.voltage ?? 400),
      frequency: Number(spec.frequency ?? 50),
      powerFactor: Number(spec.powerFactor ?? 0.9),
      maxDemandFactor: Number(spec.maxDemandFactor ?? 0.8),
      maxVoltageDropLighting: Number(spec.maxVoltageDropLighting ?? 3),
      maxVoltageDropPower: Number(spec.maxVoltageDropPower ?? 5),
      calculationStandard: (spec.calculationStandard as string) ?? 'IEC',
      preferredManufacturer: (spec.preferredManufacturer as string) ?? 'MIXED',
      ownerId: user.id,
    });

    return { projectId: project.id, name: project.name };
  });
}
