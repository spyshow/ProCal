'use client';

import { useMemo } from 'react';
import { computeFeeders, createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import type { Project } from '@/types';

export interface BreakerScheduleProps {
  project: Project;
  buildingId?: string;
  manufacturer?: string;
  showHeader?: boolean;
}

interface BreakerRow {
  id: string;
  name: string;
  type: string;
  floor: number;
  buildingName: string;
  current: number;
  breakerSize: number;
  baseBreakerSize?: number;
  isBreakerUpsized?: boolean;
  upsizeReason?: string;
  cableSize: number;
  breakerModel: string;
  isThreePhase: boolean;
  parentFeederName?: string | null;
  faultCurrentKa?: number;
  selectivityStatus?: 'FULL' | 'PARTIAL' | 'NONE' | null;
  cableDamageOk?: boolean;
  suggestedAlternative?: string | null;
}

/**
 * Printable breaker schedule.
 *
 * Uses the shared `computeFeeders` helper so the printed schedule always agrees
 * with the Panel Designer and Breaker Schedule page.
 */
export default function BreakerSchedule({
  project,
  buildingId,
  manufacturer,
  showHeader = true,
}: BreakerScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (manufacturer && manufacturer !== 'MIXED') {
      params.set('manufacturer', manufacturer);
    }
    return params.toString();
  }, [manufacturer]);
  const { equipment, catalogLoaded } = useEquipmentCatalog(query);

  const findBreaker: FindBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        manufacturer || project.preferredManufacturer
      ),
    [equipment, project, manufacturer]
  );

  // The printed breaker list is derived purely from project inputs + the live
  // catalog. Memoized so unrelated reports-page state changes (tab switches,
  // revision panel, export spinners) don't recompute every building's feeders.
  const breakers: BreakerRow[] = useMemo(() => {
    const list: BreakerRow[] = [];

    for (const bldg of project.buildings) {
      if (buildingId && bldg.id !== buildingId) continue;
      const {
        mdbFeeders,
        smdbFloorNumbers,
        smdbFeeders,
        mainIncomerSettings,
        mainBreakerIn,
        mainCableSize,
        mainIncomerCurrent,
        transformerIscKa,
      } = computeFeeders(bldg, project, findBreaker);

      // 1. Main Incomer Row
      list.push({
        id: `${bldg.id}-incomer`,
        name: project.buildings.length > 1 ? `${bldg.name} – Main Incomer` : 'Main Incomer',
        type: 'INCOMER',
        floor: 0,
        buildingName: bldg.name,
        current: mainIncomerCurrent || mainIncomerSettings.ir,
        breakerSize: mainBreakerIn,
        baseBreakerSize: mainBreakerIn,
        cableSize: mainCableSize,
        breakerModel: mainIncomerSettings.model,
        isThreePhase: true,
        parentFeederName: 'Utility / Transformer Supply',
        faultCurrentKa: transformerIscKa,
        selectivityStatus: 'FULL',
        cableDamageOk: true,
      });

      const feederFloor = (feederName: string): number => {
        const m = feederName.match(/^F(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };

      for (const f of mdbFeeders) {
        list.push({
          id: `${bldg.id}-mdb-${list.length}`,
          name: f.name,
          type: f.type,
          floor: feederFloor(f.name),
          buildingName: bldg.name,
          current: f.current,
          breakerSize: f.breakerSize,
          baseBreakerSize: f.baseBreakerSize,
          isBreakerUpsized: f.isBreakerUpsized,
          upsizeReason: f.upsizeReason,
          cableSize: f.cableSize,
          breakerModel: f.breakerModel,
          isThreePhase: f.type !== 'APARTMENT',
          parentFeederName: f.parentFeederName,
          faultCurrentKa: f.faultCurrentKa,
          selectivityStatus: f.selectivityStatus,
          cableDamageOk: f.cableDamageOk,
          suggestedAlternative: f.suggestedAlternative,
        });
      }

      for (const floorNumber of smdbFloorNumbers) {
        for (const f of smdbFeeders(floorNumber)) {
          list.push({
            id: `${bldg.id}-smdb-${list.length}`,
            name: f.name,
            type: f.type,
            floor: floorNumber,
            buildingName: bldg.name,
            current: f.current,
            breakerSize: f.breakerSize,
            baseBreakerSize: f.baseBreakerSize,
            isBreakerUpsized: f.isBreakerUpsized,
            upsizeReason: f.upsizeReason,
            cableSize: f.cableSize,
            breakerModel: f.breakerModel,
            isThreePhase: f.type !== 'APARTMENT',
            parentFeederName: f.parentFeederName,
            faultCurrentKa: f.faultCurrentKa,
            selectivityStatus: f.selectivityStatus,
            cableDamageOk: f.cableDamageOk,
            suggestedAlternative: f.suggestedAlternative,
          });
        }
      }
    }
    return list;
  }, [project, buildingId, findBreaker]);

  const grouped = breakers.reduce<Record<string, BreakerRow[]>>((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {});

  if (!catalogLoaded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
        <h2 className="text-lg font-bold border-b pb-2">Breaker & Protection Schedule</h2>
        <div className="p-6 text-center text-sm text-gray-400">Loading breaker catalog…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <h2 className="text-lg font-bold border-b pb-2">Breaker & Protection Schedule</h2>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-sm font-bold text-orange-600">{type.replace('_', ' ')}</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1.5 text-left">Feeder</th>
                <th className="border p-1.5 text-left">Upstream Parent</th>
                <th className="border p-1.5 text-center">Floor</th>
                <th className="border p-1.5 text-right">Current (A)</th>
                <th className="border p-1.5 text-center">Breaker</th>
                <th className="border p-1.5 text-left">Model</th>
                <th className="border p-1.5 text-center">Cable (mm²)</th>
                <th className="border p-1.5 text-right">Isc (kA)</th>
                <th className="border p-1.5 text-center">Selectivity</th>
                <th className="border p-1.5 text-center">Cable Protected</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="border p-1.5 font-semibold">{b.name}</td>
                  <td className="border p-1.5 text-gray-600 font-mono">{b.parentFeederName ?? 'Main Incomer'}</td>
                  <td className="border p-1.5 text-center font-mono text-orange-600">F{b.floor}</td>
                  <td className="border p-1.5 text-right font-mono">{b.current.toFixed(1)}</td>
                  <td className="border p-1.5 text-center font-mono text-blue-600 font-bold">
                    {b.isBreakerUpsized ? (
                      <span
                        className="border-b border-dashed border-blue-600 cursor-help"
                        title={
                          b.upsizeReason ??
                          `Sized to ${b.breakerSize}A (exceeds base load rating ${b.baseBreakerSize ?? Math.ceil(b.current)}A): Upsized for selectivity grading and electronic trip unit sizing.`
                        }
                      >
                        {b.breakerSize}A
                      </span>
                    ) : (
                      `${b.breakerSize}A`
                    )}
                  </td>
                  <td className="border p-1.5 text-xs text-gray-600">{b.breakerModel}</td>
                  <td className="border p-1.5 text-center font-mono text-green-600">{b.cableSize}</td>
                  <td className="border p-1.5 text-right font-mono">{b.faultCurrentKa ? b.faultCurrentKa.toFixed(2) : '—'}</td>
                  <td className="border p-1.5 text-center font-bold">
                    {b.selectivityStatus === 'FULL' ? (
                      <span className="text-green-600">FULL</span>
                    ) : b.selectivityStatus === 'PARTIAL' ? (
                      <div>
                        <span className="text-yellow-600">PARTIAL</span>
                        {b.suggestedAlternative && (
                          <div className="text-[9px] text-orange-700 font-normal italic mt-0.5">
                            💡 {b.suggestedAlternative}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-red-600">NONE</span>
                        {b.suggestedAlternative && (
                          <div className="text-[9px] text-orange-700 font-normal italic mt-0.5">
                            💡 {b.suggestedAlternative}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="border p-1.5 text-center font-semibold">
                    {b.cableDamageOk !== false ? (
                      <span className="text-green-600">✓ Safe</span>
                    ) : (
                      <span className="text-red-600">✗ Risk</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {breakers.length === 0 && (
        <p className="text-sm text-gray-500">No breakers to display for this selection.</p>
      )}
    </div>
  );
}
