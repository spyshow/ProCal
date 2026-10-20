'use client';

import { useState, useMemo, useEffect } from 'react';
import { createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';
import BOMScheduleTable, { type BOMScheduleTableProps } from './BOMScheduleTable';

export type BOMScheduleProps = BOMScheduleTableProps;

export default function BOMSchedule({
  project,
  buildingId,
  showHeader = true,
  equipment: preloadedEquipment,
  breakerSettings: preloadedBreakerSettings,
  findBreaker: preloadedFindBreaker,
}: BOMScheduleProps) {
  const [internalBreakerSettings, setInternalBreakerSettings] = useState<BreakerSettingItem[]>([]);

  useEffect(() => {
    if (preloadedBreakerSettings) return;
    fetch(`/api/breaker-settings?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setInternalBreakerSettings(data))
      .catch(() => {});
  }, [preloadedBreakerSettings]);

  const breakerSettings = preloadedBreakerSettings || internalBreakerSettings;

  const { equipment: fetchedEquipment, catalogLoaded } = useEquipmentCatalog('category=ACB,MCCB,MCB');
  const equipment = preloadedEquipment || fetchedEquipment;
  const isLoaded = preloadedEquipment !== undefined || catalogLoaded;

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

  if (!isLoaded) {
    return (
      <div className="space-y-6 font-sans text-slate-900">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-mono">
          <span className="font-semibold text-slate-900">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-l-4 border-amber-500 pl-2.5">
            Bill of Materials (BOM) &amp; Equipment Procurement Schedule
          </h2>
        </div>
        <div className="p-6 text-center text-sm text-slate-500 font-mono">Loading breaker catalog…</div>
      </div>
    );
  }

  return (
    <BOMScheduleTable
      project={project}
      buildingId={buildingId}
      showHeader={showHeader}
      equipment={equipment}
      breakerSettings={breakerSettings}
      findBreaker={findBreaker}
    />
  );
}
