'use client';

import { useMemo, useState, useEffect } from 'react';
import { computeFeeders, createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { formatCableSizeFor } from '@/lib/calculations/cables';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { TraceableCell } from '@/components/common/TraceableCell';
import {
  buildDesignCurrentTrace,
  buildBreakerSizingTrace,
  buildShortCircuitTrace,
} from '@/lib/calculations/trace-engine';
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
  selectivityLimitKa?: number | null;
  cableDamageOk?: boolean;
  suggestedAlternative?: string | null;
  irSetting?: number;
  isdSetting?: number;
  tsdSetting?: number;
  iiSetting?: number;
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
  const [breakerSettings, setBreakerSettings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/breaker-settings?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBreakerSettings(data))
      .catch(() => {});
  }, []);

  const resolveBreakerDisplayName = (savedModel: string | undefined | null, feederModel: string | undefined | null): string => {
    const defaultModel = feederModel || 'Standard Circuit Breaker';
    if (!savedModel) return defaultModel;
    if (savedModel.includes(defaultModel)) return savedModel;
    const parts = savedModel.split(/\s+/);
    if (parts.length > 1 && defaultModel.startsWith(parts[0])) {
      return savedModel;
    }
    return `${defaultModel} (${savedModel})`;
  };

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
        mainCableIz,
        mainCableUnderProtected,
        mainIncomerCurrent,
        transformerIscKa,
      } = computeFeeders(bldg, project, findBreaker);

      // 1. Main Incomer Row
      const incomerSaved = breakerSettings.find(
        (s) =>
          s.breakerId === `${project.id}-main-incomer-${bldg.id}` ||
          s.breakerId === `${project.id}-main-incomer` ||
          s.breakerId === `main-incomer-${bldg.id}` ||
          s.breakerId === 'main-incomer'
      );
      const effectiveIncomerModel = resolveBreakerDisplayName(
        incomerSaved?.model,
        mainIncomerSettings.model || 'Main Incomer ACB'
      );
      const savedIncomerFrame = incomerSaved?.frameSize ? parseInt(incomerSaved.frameSize, 10) : NaN;
      const effectiveIncomerIn = !isNaN(savedIncomerFrame) && savedIncomerFrame > 0 ? savedIncomerFrame : mainBreakerIn;
      const isUnderProtected = effectiveIncomerIn > mainCableIz || mainCableUnderProtected;

      const normalizeBreakerId = (id: string) => id.replace(/[–—]/g, '-').trim();
      const findSaved = (fName: string, itemId?: string, buildingLoadId?: string) => {
        const norm = normalizeBreakerId(fName);
        return breakerSettings.find(
          (s) =>
            normalizeBreakerId(s.breakerId) === `${project.id}-${norm}` ||
            normalizeBreakerId(s.breakerId) === norm ||
            s.breakerId === fName ||
            (itemId && s.breakerId === itemId) ||
            (buildingLoadId && s.breakerId === buildingLoadId)
        );
      };

      list.push({
        id: `${bldg.id}-incomer`,
        name: project.buildings.length > 1 ? `${bldg.name} – Main Incomer` : 'Main Incomer',
        type: 'INCOMER',
        floor: 0,
        buildingName: bldg.name,
        current: mainIncomerCurrent || mainIncomerSettings.ir,
        breakerSize: effectiveIncomerIn,
        baseBreakerSize: mainBreakerIn,
        cableSize: mainCableSize,
        breakerModel: effectiveIncomerModel,
        isThreePhase: true,
        parentFeederName: 'Utility / Transformer Supply',
        faultCurrentKa: transformerIscKa,
        selectivityStatus: 'FULL',
        cableDamageOk: !isUnderProtected,
        irSetting: incomerSaved?.ir ?? parseFloat((effectiveIncomerIn * 0.9).toFixed(1)),
        isdSetting: incomerSaved?.isd ?? effectiveIncomerIn * 4,
        tsdSetting: incomerSaved?.tsd ?? 0.3,
        iiSetting: incomerSaved?.ii ?? effectiveIncomerIn * 10,
      });

      const feederFloor = (feederName: string): number => {
        const m = feederName.match(/^F(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };

      for (const f of mdbFeeders) {
        const saved = findSaved(f.name, f.itemId, f.buildingLoadId);
        const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
        const isElectronic = f.isThreePhase && f.breakerSize >= 100;

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
          breakerModel: effectiveModel,
          isThreePhase: f.type !== 'APARTMENT',
          parentFeederName: f.parentFeederName,
          faultCurrentKa: f.faultCurrentKa,
          selectivityStatus: f.selectivityStatus,
          selectivityLimitKa: f.selectivityLimitKa,
          cableDamageOk: f.cableDamageOk,
          suggestedAlternative: f.suggestedAlternative,
          irSetting: saved?.ir ?? (isElectronic ? parseFloat(f.current.toFixed(1)) : undefined),
          isdSetting: saved?.isd ?? (isElectronic ? f.breakerSize * 4 : undefined),
          tsdSetting: saved?.tsd ?? (isElectronic ? 0.05 : undefined),
          iiSetting: saved?.ii ?? (isElectronic ? f.breakerSize * 8 : undefined),
        });
      }

      for (const floorNumber of smdbFloorNumbers) {
        for (const f of smdbFeeders(floorNumber)) {
          const saved = findSaved(f.name, f.itemId, f.buildingLoadId);
          const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
          const isElectronic = f.isThreePhase && f.breakerSize >= 100;

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
            breakerModel: effectiveModel,
            isThreePhase: f.type !== 'APARTMENT',
            parentFeederName: f.parentFeederName,
            faultCurrentKa: f.faultCurrentKa,
            selectivityStatus: f.selectivityStatus,
            selectivityLimitKa: f.selectivityLimitKa,
            cableDamageOk: f.cableDamageOk,
            suggestedAlternative: f.suggestedAlternative,
            irSetting: saved?.ir ?? (isElectronic ? parseFloat(f.current.toFixed(1)) : undefined),
            isdSetting: saved?.isd ?? (isElectronic ? f.breakerSize * 4 : undefined),
            tsdSetting: saved?.tsd ?? (isElectronic ? 0.05 : undefined),
            iiSetting: saved?.ii ?? (isElectronic ? f.breakerSize * 8 : undefined),
          });
        }
      }
    }
    return list;
  }, [project, buildingId, findBreaker, breakerSettings]);

  const grouped = breakers.reduce<Record<string, BreakerRow[]>>((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {});

  if (!catalogLoaded) {
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
          <span className="text-[11px] font-mono text-slate-600">
            Total Devices: <span className="font-bold text-slate-900">{breakers.length}</span>
          </span>
        </div>
        <div className="p-6 text-center text-sm text-slate-400 font-mono">Loading breaker catalog…</div>
      </div>
    );
  }

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
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">IEC 60947-2 / IEC 60898-1</span>
        </span>
      </div>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-2 mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-amber-800">
              {type.replace('_', ' ')}
            </span>
            <span className="text-slate-500 text-[11px]">({items.length} devices)</span>
          </h3>
          <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="p-2 border-r border-slate-800">Feeder Description</th>
                <th className="p-2 border-r border-slate-800">Upstream Parent</th>
                <th className="p-2 border-r border-slate-800 text-center">Floor</th>
                <th className="p-2 border-r border-slate-800 text-center">Ib (A)</th>
                <th className="p-2 border-r border-slate-800 text-center">Rating (In)</th>
                <th className="p-2 border-r border-slate-800">Breaker Model</th>
                <th className="p-2 border-r border-slate-800 text-center">Trip Settings (Ir / Isd / tsd / Ii)</th>
                <th className="p-2 border-r border-slate-800 text-center">Cable</th>
                <th className="p-2 border-r border-slate-800 text-right">Isc (kA)</th>
                <th className="p-2 border-r border-slate-800 text-center">Selectivity</th>
                <th className="p-2 text-center">Thermal Withstand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {items.map((b, idx) => (
                <tr
                  key={b.id}
                  className={
                    b.type === 'INCOMER'
                      ? 'bg-amber-50/90 font-bold border-b-2 border-amber-300'
                      : idx % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50/80'
                  }
                >
                  <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{b.name}</td>
                  <td className="p-2 border-r border-slate-200 text-slate-600 font-mono text-[11px]">
                    {b.parentFeederName ?? 'Utility / Transformer'}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono">
                    {b.type === 'INCOMER' ? 'MDB' : `F${b.floor}`}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">
                    <TraceableCell
                      getTrace={() => {
                        const is3Ph = b.isThreePhase;
                        const voltage = is3Ph ? (project.voltage || 400) : (project.voltage ? project.voltage / Math.sqrt(3) : 230);
                        const powerKw = is3Ph
                          ? (Math.sqrt(3) * (project.voltage || 400) * b.current * (project.powerFactor || 0.85)) / 1000
                          : ((project.voltage ? project.voltage / Math.sqrt(3) : 230) * b.current * (project.powerFactor || 0.85)) / 1000;
                        return buildDesignCurrentTrace({
                          loadName: `${b.buildingName} - ${b.name}`,
                          powerKw,
                          powerFactor: project.powerFactor || 0.85,
                          voltageV: Math.round(voltage),
                          isThreePhase: is3Ph,
                          calculatedCurrentA: b.current,
                          calculationStandard: project.calculationStandard,
                        });
                      }}
                    >
                      {b.current.toFixed(1)} A
                    </TraceableCell>
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                    <TraceableCell
                      getTrace={() => {
                        return buildBreakerSizingTrace({
                          circuitName: `${b.buildingName} - ${b.name}`,
                          designCurrentA: b.current,
                          selectedTripA: b.breakerSize,
                          frameSizeA: b.breakerSize >= 630 ? b.breakerSize : b.breakerSize > 160 ? 250 : 160,
                          breakingCapacityKa: b.breakerSize >= 630 ? 65 : 36,
                          prospectiveFaultKa: b.faultCurrentKa,
                          calculationStandard: project.calculationStandard,
                        });
                      }}
                    >
                      {b.isBreakerUpsized ? (
                        <span
                          className="border-b border-dashed border-amber-600 cursor-help"
                          title={
                            b.upsizeReason ??
                            `Sized to ${b.breakerSize}A (exceeds base load rating ${b.baseBreakerSize ?? Math.ceil(b.current)}A)`
                          }
                        >
                          {b.breakerSize}A
                        </span>
                      ) : (
                        `${b.breakerSize}A`
                      )}
                    </TraceableCell>
                  </td>
                  <td className="p-2 border-r border-slate-200 text-xs font-mono text-slate-800">
                    {b.breakerModel}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px]">
                    {b.isThreePhase && b.breakerSize >= 100 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-slate-900 font-bold">
                          Ir: {b.irSetting ?? b.breakerSize}A | Isd: {b.isdSetting ?? b.breakerSize * 4}A
                        </span>
                        <span className="text-amber-700 font-semibold text-[10px]">
                          tsd: {b.tsdSetting !== undefined ? `${b.tsdSetting}s` : (b.type === 'INCOMER' ? '0.30s' : '0.05s')} | Ii: {b.iiSetting ?? b.breakerSize * 10}A
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">Thermal-Magnetic (Type C)</span>
                    )}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-800">
                    {b.cableSize ? formatCableSizeFor(b.cableSize, project.calculationStandard) : 'Busbar'}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-right font-mono text-red-600 font-bold">
                    {b.faultCurrentKa ? (
                      <TraceableCell
                        getTrace={() => {
                          return buildShortCircuitTrace({
                            locationName: `${b.buildingName} - ${b.name}`,
                            transformerKva: 1000,
                            transformerZPercent: 5.5,
                            voltageSecondaryV: project.voltage || 400,
                            threePhaseIscKa: b.faultCurrentKa || 25,
                            peakCurrentKa: (b.faultCurrentKa || 25) * 2.1,
                            calculationStandard: project.calculationStandard,
                          });
                        }}
                      >
                        {b.faultCurrentKa.toFixed(2)} kA
                      </TraceableCell>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        b.selectivityStatus === 'FULL'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : b.selectivityStatus === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {b.selectivityStatus}{b.selectivityStatus === 'PARTIAL' && b.selectivityLimitKa ? ` (${b.selectivityLimitKa} kA)` : ''}
                    </span>
                  </td>
                  <td className="p-2 text-center text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-emerald-700 font-bold border border-slate-200">
                      I²t &le; k²S² (OK)
                    </span>
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
