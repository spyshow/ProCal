'use client';

import { useMemo } from 'react';
import { createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import CableScheduleTable, { type CableScheduleTableProps } from './CableScheduleTable';

export type CableScheduleProps = CableScheduleTableProps;

export default function CableSchedule({
  project,
  buildingId,
  showHeader = true,
  equipment: preloadedEquipment,
  findBreaker: preloadedFindBreaker,
}: CableScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project.preferredManufacturer]);
  const { equipment: fetchedEquipment } = useEquipmentCatalog(query);
  const equipment = preloadedEquipment || fetchedEquipment;

  const findBreaker = useMemo(
    () =>
      preloadedFindBreaker ||
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        project.preferredManufacturer
      ),
    [preloadedFindBreaker, equipment, project]
  );

  return (
    <CableScheduleTable
      project={project}
      buildingId={buildingId}
      showHeader={showHeader}
      equipment={equipment}
      findBreaker={findBreaker}
    />
  );
}
