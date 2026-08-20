'use client';

import { useState, useMemo, useEffect } from 'react';
import { parseMm2, getItemCableLength, getBuildingLoadCableLength } from '@/lib/calculations/cables';
import { computeFeeders, createFindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import type { FloorItem, Project, FallbackType, GenericBreakerSpec } from '@/types';
import { FileText, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface BOMScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface CableBOMItem {
  key: string;
  sizeNum: number;
  cores: number;
  phase: number;
  sizeLabel: string;
  length: number;
  count: number;
}

interface BreakerBOMItem {
  ratingAmps: number;
  ratingLabel: string;
  category: 'ACB' | 'MCCB' | 'MCB';
  poles: string;
  model: string;
  manufacturer: string;
  fallbackType?: FallbackType;
  genericSpec?: GenericBreakerSpec;
  count: number;
}

/**
 * Printable Bill of Materials schedule.
 *
 * Aggregates cable and breaker quantities across every floor item and building load
 * in the project, with a dedicated Procurement Annex for technical purchasing specs.
 */
export default function BOMSchedule({ project, buildingId, showHeader = true }: BOMScheduleProps) {
  const [annexOpen, setAnnexOpen] = useState(true);
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

  // Catalog arrives async; until it resolves, createFindBreaker([]) would label
  // every feeder GENERIC_SPEC. Gate the table so that flash never renders.
  const { equipment, catalogLoaded } = useEquipmentCatalog('category=ACB,MCCB,MCB');

  const findBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        project.preferredManufacturer
      ),
    [equipment, project]
  );

  // The whole BOM (all items + cable/breaker aggregation) is derived purely
  // from project inputs + the live catalog. Memoized so unrelated reports-page
  // state changes (tab switches, revision panel, export spinners) don't
  // recompute every building's feeders.
  const { allItems, cableRows, totalCableLength, breakerRows, totalBreakers, annexItems } = useMemo(() => {
    const allItems: (FloorItem & { floor: number; building: string })[] = [];

    for (const b of project.buildings) {
      if (buildingId && b.id !== buildingId) continue;
      for (const fd of b.floorDesigns) {
        for (const item of fd.items) {
          allItems.push({
            ...item,
            floor: fd.floorNumber,
            building: b.name,
          });
        }
      }
      for (const bl of b.buildingLoads || []) {
        if (!bl.loadLibraryItem) continue;
        allItems.push({
          id: bl.id,
          name: bl.loadLibraryItem.name,
          type: 'SERVICE_PANEL' as const,
          calculatedConnectedLoad: bl.loadLibraryItem.power * bl.quantity,
          calculatedMaxDemand: bl.loadLibraryItem.power * bl.quantity,
          calculatedCurrent: 0,
          breakerSize: (bl as any).breakerSize || '32A',
          cableSize: bl.cableSize || '4 mm²',
          voltageDrop: 0,
          cableLength: getBuildingLoadCableLength(bl),
          floor: 0,
          building: b.name,
        });
      }
    }

    // Aggregate Cables differentiating 2-core (1-phase) and 4-core (3-phase)
    const cableBOM: Record<string, CableBOMItem> = {};
    for (const item of allItems) {
      const sizeNum = parseMm2(item.cableSize) ?? 4;
      const phase = item.type === 'APARTMENT'
        ? (item.apartmentTemplate?.phases ?? 1)
        : item.loadLibraryItem
        ? item.loadLibraryItem.phase
        : (item as any).phases ?? (item as any).phase ?? 3;
      const cores = phase === 1 ? 2 : 4;
      const key = `${cores}C-${sizeNum}`;
      const sizeLabel = `${cores}C × ${sizeNum} mm²`;

      if (!cableBOM[key]) {
        cableBOM[key] = { key, sizeNum, cores, phase, sizeLabel, length: 0, count: 0 };
      }
      cableBOM[key].length += getItemCableLength(item, item.floor);
      cableBOM[key].count += 1;
    }

    // Aggregate Breakers with real catalog & fallback model details
    const breakerMap = new Map<string, BreakerBOMItem>();

    for (const bldg of project.buildings) {
      if (buildingId && bldg.id !== buildingId) continue;
      const {
        mdbFeeders,
        smdbFloorNumbers,
        smdbFeeders,
        mainIncomerSettings,
        mainBreakerIn,
        mainCableSize,
        mainParallelRuns,
      } = computeFeeders(bldg, project, findBreaker);

      // 1. Process Main Incoming Supply Feeder Cable (typically 20m from transformer to MDB)
      if (mainCableSize > 0) {
        const cores = 4;
        const key = `${cores}C-${mainCableSize}`;
        const sizeLabel = `${cores}C × ${mainCableSize} mm²`;
        if (!cableBOM[key]) {
          cableBOM[key] = { key, sizeNum: mainCableSize, cores, phase: 3, sizeLabel, length: 0, count: 0 };
        }
        cableBOM[key].length += 20 * (mainParallelRuns || 1);
        cableBOM[key].count += (mainParallelRuns || 1);
      }

      const processFeeder = (f: { breakerSize: number; isThreePhase: boolean; type: string; breakerModel: string; manufacturer: string | null; fallbackType?: FallbackType; genericSpec?: GenericBreakerSpec }) => {
        const cat: 'ACB' | 'MCCB' | 'MCB' =
          f.breakerSize >= 630 ? 'ACB' : f.breakerSize > 63 || f.type !== 'APARTMENT' ? 'MCCB' : 'MCB';
        const polesStr = f.isThreePhase ? '3P' : cat === 'MCB' ? '1P' : '3P';
        const key = `${f.breakerSize}-${cat}-${polesStr}-${f.breakerModel}`;

        const existing = breakerMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          breakerMap.set(key, {
            ratingAmps: f.breakerSize,
            ratingLabel: `${f.breakerSize}A`,
            category: cat,
            poles: polesStr,
            model: f.breakerModel,
            manufacturer: f.manufacturer || 'Standard',
            fallbackType: f.fallbackType,
            genericSpec: f.genericSpec,
            count: 1,
          });
        }
      };

      // 2. Process Main Incomer Breaker
      const incomerSaved = breakerSettings.find(
        (s) =>
          s.breakerId === `${project.id}-main-incomer-${bldg.id}` ||
          s.breakerId === `${project.id}-main-incomer` ||
          s.breakerId === `main-incomer-${bldg.id}` ||
          s.breakerId === 'main-incomer'
      );
      const effectiveIncomerModel = resolveBreakerDisplayName(
        incomerSaved?.model,
        mainIncomerSettings.model || `${mainIncomerSettings.manufacturer || 'Standard'} Incomer ACB`
      );

      processFeeder({
        breakerSize: mainBreakerIn,
        isThreePhase: true,
        type: 'INCOMER',
        breakerModel: effectiveIncomerModel,
        manufacturer: mainIncomerSettings.manufacturer || 'Standard',
        fallbackType: mainIncomerSettings.isGeneric ? 'GENERIC_SPEC' : 'SAME_FAMILY',
        genericSpec: mainIncomerSettings.isGeneric
          ? {
              category: mainBreakerIn >= 630 ? 'ACB' : 'MCCB',
              ratingAmps: mainBreakerIn,
              requiredIcuKa: 50,
              poles: 3,
              tripUnitType: 'Electronic LSI / LSIG (Adjustable Ir, Isd, tsd, Ii)',
              standard: 'IEC 60947-2',
              procurementNotes: `Procure ${mainBreakerIn}A ${mainBreakerIn >= 630 ? 'ACB' : 'MCCB'} 3P incomer breaker compliant with IEC 60947-2.`,
            }
          : undefined,
      });

      for (const f of mdbFeeders) {
        const stableId = `${project.id}-${f.name}`;
        const saved = breakerSettings.find((s) => s.breakerId === stableId);
        const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
        processFeeder({ ...f, breakerModel: effectiveModel });
      }
      for (const fl of smdbFloorNumbers) {
        for (const f of smdbFeeders(fl)) {
          const stableId = `${project.id}-${f.name}`;
          const saved = breakerSettings.find((s) => s.breakerId === stableId);
          const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
          processFeeder({ ...f, breakerModel: effectiveModel });
        }
      }
    }

    const cableRows = Object.values(cableBOM).sort((a, b) => a.cores - b.cores || a.sizeNum - b.sizeNum);
    const totalCableLength = Math.round(cableRows.reduce((s, e) => s + e.length, 0));

    const breakerRows = Array.from(breakerMap.values()).sort((a, b) => a.ratingAmps - b.ratingAmps || a.category.localeCompare(b.category));
    const totalBreakers = breakerRows.reduce((sum, b) => sum + b.count, 0);

    // Filter items that have generic specs or fallbacks for the Annex
    const annexItems = breakerRows.filter((b) => b.fallbackType || b.genericSpec);

    return { allItems, cableRows, totalCableLength, breakerRows, totalBreakers, annexItems };
  }, [project, buildingId, findBreaker, breakerSettings]);

  if (!catalogLoaded) {
    return (
      <div className="space-y-6 font-sans text-slate-900">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-mono">
          <span className="font-semibold text-slate-900">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
            Bill of Materials (BOM) &amp; Equipment Procurement Schedule
          </h2>
        </div>
        <div className="p-6 text-center text-sm text-slate-400 font-mono">Loading breaker catalog…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-900">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-mono">
          <span className="font-semibold text-slate-900">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2.5">
          Bill of Materials (BOM) &amp; Equipment Procurement Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Preferred Brand: <strong className="text-slate-900">{project.preferredManufacturer || 'Schneider Electric'}</strong>
        </span>
      </div>

      {/* 1. Cable Schedule */}
      <div className="space-y-2">
        <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center justify-between">
          <span>1. Cable Drums &amp; Total Conductor Sizing Bill of Quantities</span>
          <span className="font-mono text-slate-500 text-[11px]">Total Estimated Run: {totalCableLength} m</span>
        </h3>
        <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="p-2 border-r border-slate-800">Cable Specification</th>
              <th className="p-2 border-r border-slate-800 text-center">Cores / System</th>
              <th className="p-2 border-r border-slate-800 text-center">Conductor Size</th>
              <th className="p-2 border-r border-slate-800 text-center">Connected Circuits</th>
              <th className="p-2 text-right">Total Estimated Length (m)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {cableRows.map((entry, idx) => (
              <tr key={entry.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">{entry.sizeLabel}</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px] font-semibold">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.cores === 2 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                    {entry.cores === 2 ? '2-Core (1φ)' : '4-Core (3φ)'}
                  </span>
                </td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">{entry.sizeNum} mm²</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">{entry.count}</td>
                <td className="p-2 text-right font-mono font-bold text-amber-700">{Math.round(entry.length)} m</td>
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-bold text-xs">
              <td className="p-2 border-r border-slate-800 uppercase tracking-wider" colSpan={3}>Total Aggregated Cables</td>
              <td className="p-2 border-r border-slate-800 text-center font-mono">{allItems.length} circuits</td>
              <td className="p-2 text-right font-mono text-amber-400">{totalCableLength} m</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Circuit Breakers & Switchgear Schedule */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800">
            2. Protective Switchgear &amp; Circuit Breakers BOQ
          </h3>
          <span className="text-[11px] text-slate-600 font-mono">Total Units: <strong className="text-slate-900">{totalBreakers}</strong></span>
        </div>
        <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="p-2 border-r border-slate-800">Rating (In)</th>
              <th className="p-2 border-r border-slate-800 text-center">Category</th>
              <th className="p-2 border-r border-slate-800 text-center">Poles</th>
              <th className="p-2 border-r border-slate-800">Model &amp; Manufacturer</th>
              <th className="p-2 border-r border-slate-800 text-center">Sourcing Status</th>
              <th className="p-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {breakerRows.map((entry, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">{entry.ratingLabel}</td>
                <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-800">{entry.category}</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">{entry.poles}</td>
                <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{entry.model}</td>
                <td className="p-2 border-r border-slate-200 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 border border-slate-200 text-slate-800">
                    {entry.fallbackType === 'SAME_FAMILY' || !entry.fallbackType
                      ? 'Catalog Match'
                      : entry.fallbackType === 'OTHER_FAMILY'
                      ? 'Alternative Family'
                      : entry.fallbackType === 'OTHER_BRAND'
                      ? `Alt Brand (${entry.manufacturer})`
                      : 'Generic Spec'}
                  </span>
                </td>
                <td className="p-2 text-right font-mono font-bold text-amber-700">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Procurement Technical Specifications Annex */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
        <button
          onClick={() => setAnnexOpen(!annexOpen)}
          className="w-full p-3 flex items-center justify-between bg-slate-100 hover:bg-slate-200/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              3. Procurement Annex &amp; Engineering Specifications for Purchase Orders
            </span>
          </div>
          {annexOpen ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
        </button>

        {annexOpen && (
          <div className="p-3.5 space-y-3 text-xs">
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Minimum breaking capacity (Icu), trip unit specifications, and IEC standard compliance required when sourcing:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {breakerRows.map((b, idx) => {
                const spec = b.genericSpec ?? {
                  ratingAmps: b.ratingAmps,
                  category: b.category,
                  poles: b.poles === '1P' ? 1 : 3,
                  requiredIcuKa: b.category === 'ACB' ? 65 : b.category === 'MCCB' ? 36 : 10,
                  tripUnitType:
                    b.category === 'ACB'
                      ? 'Electronic LSI / LSIG (Adjustable Ir, Isd, tsd, Ii)'
                      : b.category === 'MCCB' && b.ratingAmps >= 160
                      ? 'Electronic LSI (Adjustable Ir, Isd, tsd)'
                      : 'Thermal-Magnetic (IEC 60947-2 TMD)',
                  standard: b.category === 'MCB' ? 'IEC 60898-1 / IEC 60947-2' : 'IEC 60947-2',
                };
                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-mono text-xs">{b.ratingLabel} {b.category} ({b.poles})</strong>
                      <span className="text-slate-500 font-mono text-[10px]">Qty: {b.count}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-700 font-mono">
                      <div>Min Breaking Cap: <strong className="text-red-600">{spec.requiredIcuKa} kA</strong></div>
                      <div>Standard: <strong className="text-slate-900">{spec.standard}</strong></div>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Trip Unit: <span className="text-slate-900 font-medium">{spec.tripUnitType}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
