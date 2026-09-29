import { db } from '@/lib/db';
import { getCompanySettings } from '@/lib/app-settings';
import { loadDesignGraph } from './projects';
import type { Project, ProjectRevision } from '@/types';
import type { EquipmentItem } from '@/lib/calculations/feeders';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';

export interface LoadedReportData {
  project: Project;
  companyName: string;
  companyLogoUrl?: string;
  equipment: EquipmentItem[];
  breakerSettings: BreakerSettingItem[];
  revisions: ProjectRevision[];
}

/**
 * Loads everything a printable engineering deliverable needs, in one round trip.
 *
 * Shared by the headless print route, the PDF download route and the MCP export
 * tools, so the three cannot drift and produce different documents from the same
 * project. The MCP layer previously carried its own copy of this loader.
 */
export async function loadReportData(projectId: string): Promise<LoadedReportData | null> {
  const [project, company, rawRevisions, rawEquipment, breakerSettings] = await Promise.all([
    loadDesignGraph(projectId),

    getCompanySettings().catch(() => null),
    db.projectRevision.findMany({
      where: { projectId },
      include: {
        createdBy: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.equipmentCatalog.findMany({
      include: { family: true },
      orderBy: [
        { manufacturer: 'asc' },
        { category: 'asc' },
        { ratedCurrent: 'asc' },
      ],
    }),
    db.breakerSettings.findMany({
      orderBy: { model: 'asc' },
    }),
  ]);

  if (!project) return null;

  const revisions = rawRevisions.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    rev: r.rev,
    description: r.description,
    createdById: r.createdById,
    createdByUsername: r.createdBy?.username,
    createdAt: r.createdAt.toISOString(),
  }));

  const equipment = rawEquipment.map((e) => ({
    ...e,
    familyId: e.family?.id ?? null,
    familyName: e.family?.name ?? null,
  }));

  return {
    project: project as unknown as Project,
    companyName: company?.companyName || 'ProCal — Low-voltage Electrical design, Solved',
    companyLogoUrl: company?.logoUrl || undefined,
    equipment: equipment as unknown as EquipmentItem[],
    breakerSettings,
    revisions: revisions as unknown as ProjectRevision[],
  };
}
