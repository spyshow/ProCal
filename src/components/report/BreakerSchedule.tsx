'use client';

import { useMemo, useState, useEffect } from 'react';
import { createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';
import BreakerScheduleTable, { type BreakerScheduleTableProps } from './BreakerScheduleTable';

export type BreakerScheduleProps = BreakerScheduleTableProps;

export default function BreakerSchedule({
  project,
  buildingId,
  manufacturer,
  showHeader = true,
  equipment: preloadedEquipment,
  breakerSettings: preloadedBreakerSettings,
  findBreaker: preloadedFindBreaker,
}: BreakerScheduleProps) {
  const [internalBreakerSettings, setInternalBreakerSettings] = useState<BreakerSettingItem[]>([]);

  useEffect(() => {
    if (preloadedBreakerSettings) return;
    fetch(`/api/breaker-settings?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setInternalBreakerSettings(data))
      .catch(() => {});
  }, [preloadedBreakerSettings]);

  const breakerSettings = preloadedBreakerSettings || internalBreakerSettings;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (manufacturer && manufacturer !== 'MIXED') {
      params.set('manufacturer', manufacturer);
    }
    return params.toString();
  }, [manufacturer]);
  const { equipment: fetchedEquipment, catalogLoaded } = useEquipmentCatalog(query);
  const equipment = preloadedEquipment || fetchedEquipment;

  const findBreaker: FindBreaker = useMemo(
    () =>
      preloadedFindBreaker ||
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        manufacturer || project.preferredManufacturer
      ),
    [preloadedFindBreaker, equipment, project, manufacturer]
  );

  if (!preloadedEquipment && !catalogLoaded) {
    return (
      <div className="space-y-4 font-sans text-slate-900">
        {showHeader && (
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-mono">
            <span className="font-semibold text-slate-900">{project.name}</span>
            <span>{project.date || new Date().toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
            Circuit Breakers &amp; Protection Coordination Schedule
          </h2>
        </div>
        <div className="p-6 text-center text-sm text-slate-400 font-mono">Loading breaker catalog…</div>
      </div>
    );
  }

  return (
    <BreakerScheduleTable
      project={project}
      buildingId={buildingId}
      manufacturer={manufacturer}
      showHeader={showHeader}
      equipment={equipment}
      breakerSettings={breakerSettings}
      findBreaker={findBreaker}
    />
  );
}
