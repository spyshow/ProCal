import { db } from '@/lib/db';
import { getCompanySettings } from '@/lib/app-settings';
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
 * Loads everything the engineering package needs, in one round trip.
 *
 * Shared by the print route and the PDF route so the two cannot drift — the
 * browser-POST path and the headless-Chromium path must render the same
 * document from the same data.
 */
export async function loadReportData(projectId: string): Promise<LoadedReportData | null> {
  const [project, company, rawRevisions, rawEquipment, breakerSettings] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      include: {
        buildings: {
          include: {
            floorDesigns: {
              include: {
                items: {
                  include: {
                    apartmentTemplate: {
                      include: { rooms: true },
                    },
                    loadLibraryItem: true,
                  },
                },
              },
            },
            buildingLoads: {
              include: {
                loadLibraryItem: true,
              },
            },
          },
        },
        apartmentTemplates: {
          include: { rooms: true },
        },
        loadLibraryItems: true,
      },
    }),

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
