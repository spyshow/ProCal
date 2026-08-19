'use client';

import { useState, useMemo } from 'react';
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
  sizeNum: number;
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

    // Aggregate Cables
    const cableBOM: Record<number, CableBOMItem> = {};
    for (const item of allItems) {
      const sizeNum = parseMm2(item.cableSize) ?? 4;
      const sizeLabel = `${sizeNum} mm²`;

      if (!cableBOM[sizeNum]) {
        cableBOM[sizeNum] = { sizeNum, sizeLabel, length: 0, count: 0 };
      }
      cableBOM[sizeNum].length += getItemCableLength(item, item.floor);
      cableBOM[sizeNum].count += 1;
    }
    const cableRows = Object.values(cableBOM).sort((a, b) => a.sizeNum - b.sizeNum);
    const totalCableLength = Math.round(cableRows.reduce((s, e) => s + e.length, 0));

    // Aggregate Breakers with real catalog & fallback model details
    const breakerMap = new Map<string, BreakerBOMItem>();

    for (const bldg of project.buildings) {
      if (buildingId && bldg.id !== buildingId) continue;
      const { mdbFeeders, smdbFloorNumbers, smdbFeeders } = computeFeeders(bldg, project, findBreaker);

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

      for (const f of mdbFeeders) {
        processFeeder(f);
      }
      for (const fl of smdbFloorNumbers) {
        for (const f of smdbFeeders(fl)) {
          processFeeder(f);
        }
      }
    }

    const breakerRows = Array.from(breakerMap.values()).sort((a, b) => a.ratingAmps - b.ratingAmps || a.category.localeCompare(b.category));
    const totalBreakers = breakerRows.reduce((sum, b) => sum + b.count, 0);

    // Filter items that have generic specs or fallbacks for the Annex
    const annexItems = breakerRows.filter((b) => b.fallbackType || b.genericSpec);

    return { allItems, cableRows, totalCableLength, breakerRows, totalBreakers, annexItems };
  }, [project, buildingId, findBreaker]);

  if (!catalogLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            Bill of Materials (BOM) & Equipment Procurement
          </h2>
        </div>
        <div className="p-6 text-center text-sm text-gray-400">Loading breaker catalog…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <FileText size={18} className="text-orange-500" />
          Bill of Materials (BOM) & Equipment Procurement
        </h2>
        <span className="text-xs text-gray-400 font-mono">
          Preferred Brand: <strong>{project.preferredManufacturer || 'Schneider'}</strong>
        </span>
      </div>

      {/* Cable Schedule */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-gray-300">1. Cable Schedule</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-800/80 text-gray-200">
              <th className="border border-gray-700 p-2 text-left">Size (mm²)</th>
              <th className="border border-gray-700 p-2 text-right">Circuits</th>
              <th className="border border-gray-700 p-2 text-right">Est. Length (m)</th>
            </tr>
          </thead>
          <tbody>
            {cableRows.map((entry) => (
              <tr key={entry.sizeNum} className="hover:bg-gray-800/40">
                <td className="border border-gray-800 p-2 font-mono font-semibold text-gray-200">{entry.sizeLabel}</td>
                <td className="border border-gray-800 p-2 text-right font-mono text-gray-300">{entry.count}</td>
                <td className="border border-gray-800 p-2 text-right font-mono text-green-400">{Math.round(entry.length)}m</td>
              </tr>
            ))}
            <tr className="bg-gray-800/60 font-bold text-gray-200">
              <td className="border border-gray-700 p-2">TOTAL</td>
              <td className="border border-gray-700 p-2 text-right font-mono">{allItems.length}</td>
              <td className="border border-gray-700 p-2 text-right font-mono text-green-400">{totalCableLength}m</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Compact Breaker BOM Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-300">2. Circuit Breakers & Switchgear Schedule</h3>
          <span className="text-xs text-gray-400 font-mono">Total Units: {totalBreakers}</span>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-800/80 text-gray-200">
              <th className="border border-gray-700 p-2 text-left">Rating (In)</th>
              <th className="border border-gray-700 p-2 text-center">Type</th>
              <th className="border border-gray-700 p-2 text-center">Poles</th>
              <th className="border border-gray-700 p-2 text-left">Model / Brand</th>
              <th className="border border-gray-700 p-2 text-center">Sourcing Status</th>
              <th className="border border-gray-700 p-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {breakerRows.map((entry, idx) => (
              <tr key={idx} className="hover:bg-gray-800/40">
                <td className="border border-gray-800 p-2 font-mono font-bold text-blue-400">{entry.ratingLabel}</td>
                <td className="border border-gray-800 p-2 text-center font-semibold text-gray-300">{entry.category}</td>
                <td className="border border-gray-800 p-2 text-center font-mono text-gray-400">{entry.poles}</td>
                <td className="border border-gray-800 p-2 font-medium text-gray-200">{entry.model}</td>
                <td className="border border-gray-800 p-2 text-center">
                  {entry.fallbackType === 'SAME_FAMILY' || !entry.fallbackType ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                      Standard Family
                    </span>
                  ) : entry.fallbackType === 'OTHER_FAMILY' ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Other Family
                    </span>
                  ) : entry.fallbackType === 'OTHER_BRAND' ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Alt Brand ({entry.manufacturer})
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Generic Spec
                    </span>
                  )}
                </td>
                <td className="border border-gray-800 p-2 text-right font-mono font-bold text-orange-400">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Procurement Annex / Technical Specification Notes */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <button
          onClick={() => setAnnexOpen(!annexOpen)}
          className="w-full p-3.5 flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-orange-400" />
            <span className="text-xs font-bold text-gray-200">
              Procurement Annex & Engineering Specifications for Purchase Engineers
            </span>
          </div>
          {annexOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>

        {annexOpen && (
          <div className="p-4 space-y-3 text-xs">
            <p className="text-gray-400 leading-relaxed">
              This section defines the minimum breaking capacity ($I_cu$), trip unit curves, and IEC standard compliance required when sourcing devices:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {breakerRows.map((b, idx) => {
                const spec = b.genericSpec ?? {
                  ratingAmps: b.ratingAmps,
                  category: b.category,
                  poles: b.poles === '1P' ? 1 : 3,
                  requiredIcuKa: b.category === 'ACB' ? 50 : b.category === 'MCCB' ? 36 : 10,
                  tripUnitType:
                    b.category === 'ACB'
                      ? 'Electronic LSI / LSIG (Adjustable Ir, Isd, tsd, Ii)'
                      : b.category === 'MCCB' && b.ratingAmps >= 160
                      ? 'Electronic LSI (Adjustable Ir, Isd, tsd)'
                      : 'Thermal-Magnetic (IEC 60947-2 TMD)',
                  standard: b.category === 'MCB' ? 'IEC 60898-1 / IEC 60947-2' : 'IEC 60947-2',
                };
                return (
                  <div key={idx} className="p-3 rounded-lg border border-gray-800 bg-gray-950/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-blue-400 font-mono text-sm">{b.ratingLabel} {b.category} ({b.poles})</strong>
                      <span className="text-gray-400 font-mono text-[11px]">Qty: {b.count}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-300 font-mono">
                      <div>Min Icu: <strong className="text-orange-400">{spec.requiredIcuKa} kA</strong></div>
                      <div>Standard: <strong className="text-gray-200">{spec.standard}</strong></div>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Trip Unit: <span className="text-gray-200 font-medium">{spec.tripUnitType}</span>
                    </div>
                    {b.fallbackType && b.fallbackType !== 'SAME_FAMILY' && (
                      <div className="text-[10px] text-amber-400/90 italic pt-0.5">
                        Note: Sourced via {b.fallbackType === 'OTHER_FAMILY' ? 'alternative brand family' : b.fallbackType === 'OTHER_BRAND' ? `alternative brand (${b.manufacturer})` : 'generic specification'}.
                      </div>
                    )}
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
