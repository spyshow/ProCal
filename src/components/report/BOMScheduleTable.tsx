import { formatCableSizeFor } from '@/lib/calculations/cables';
import { createFindBreaker, type FindBreaker, type EquipmentItem } from '@/lib/calculations/feeders';
import { aggregateDetailedBOM, type BreakerSettingItem } from '@/lib/reports/aggregates';
import type { Project } from '@/types';
import { ShieldCheck } from 'lucide-react';

export interface BOMScheduleTableProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
  equipment?: EquipmentItem[];
  breakerSettings?: BreakerSettingItem[];
  findBreaker?: FindBreaker;
}

export default function BOMScheduleTable({
  project,
  buildingId,
  showHeader = true,
  equipment = [],
  breakerSettings = [],
  findBreaker: preloadedFindBreaker,
}: BOMScheduleTableProps) {
  const findBreaker =
    preloadedFindBreaker ||
    createFindBreaker(
      equipment,
      {
        ACB: project.defaultAcbFamilyId ?? undefined,
        MCCB: project.defaultMccbFamilyId ?? undefined,
        MCB: project.defaultMcbFamilyId ?? undefined,
      },
      project.preferredManufacturer
    );

  const { allItems, cableRows, totalCableLength, breakerRows, totalBreakers } =
    aggregateDetailedBOM(project, findBreaker, breakerSettings, buildingId);

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
        <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 flex items-center justify-between">
          <span>1. Cable Drums &amp; Total Conductor Sizing Bill of Quantities</span>
          <span className="font-mono text-slate-500 text-[11px]">Total Estimated Run: {totalCableLength} m</span>
        </h3>
        <table className="w-full text-center text-xs border border-slate-300 rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="p-2 border-r border-slate-800 text-center">Cable Specification</th>
              <th className="p-2 border-r border-slate-800 text-center">Cores / System</th>
              <th className="p-2 border-r border-slate-800 text-center">Conductor Size</th>
              <th className="p-2 border-r border-slate-800 text-center">Connected Circuits</th>
              <th className="p-2 text-center">Total Estimated Length (m)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {cableRows.map((entry) => (
              <tr key={entry.key} className="bg-white">
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900 text-center">{entry.sizeLabel}</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px] font-semibold">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.cores === 2 ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                    {entry.cores === 2 ? '2-Core (1φ)' : '4-Core (3φ)'}
                  </span>
                </td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-600">{formatCableSizeFor(entry.sizeNum, project.calculationStandard)}</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-600">{entry.count}</td>
                <td className="p-2 text-center font-mono font-bold text-amber-700">{Math.round(entry.length)} m</td>
              </tr>
            ))}
            <tr className="bg-slate-100 text-slate-900 font-bold text-xs border-t-2 border-slate-300">
              <td className="p-2 border-r border-slate-200 uppercase tracking-wider text-center" colSpan={3}>Total Aggregated Cables</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-900">{allItems.length} circuits</td>
              <td className="p-2 text-center font-mono text-amber-700">{totalCableLength} m</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Circuit Breakers & Switchgear Schedule */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
            2. Protective Switchgear &amp; Circuit Breakers BOQ
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Total Units: <strong className="text-slate-900">{totalBreakers}</strong></span>
        </div>
        <table className="w-full text-center text-xs border border-slate-300 rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="p-2 border-r border-slate-800 text-center">Rating (In)</th>
              <th className="p-2 border-r border-slate-800 text-center">Category</th>
              <th className="p-2 border-r border-slate-800 text-center">Poles</th>
              <th className="p-2 border-r border-slate-800 text-center">Model &amp; Manufacturer</th>
              <th className="p-2 border-r border-slate-800 text-center">Sourcing Status</th>
              <th className="p-2 text-center">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {breakerRows.map((entry, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900 text-center">{entry.ratingLabel}</td>
                <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-900">{entry.category}</td>
                <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">{entry.poles}</td>
                <td className="p-2 border-r border-slate-200 font-medium text-slate-900 text-center">{entry.model}</td>
                <td className="p-2 border-r border-slate-200 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 border border-slate-200 text-slate-700">
                    {entry.fallbackType === 'SAME_FAMILY' || !entry.fallbackType
                      ? 'Catalog Match'
                      : entry.fallbackType === 'OTHER_FAMILY'
                      ? 'Alternative Family'
                      : entry.fallbackType === 'OTHER_BRAND'
                      ? `Alt Brand (${entry.manufacturer})`
                      : 'Generic Spec'}
                  </span>
                </td>
                <td className="p-2 text-center font-mono font-bold text-amber-700">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Procurement Technical Specifications Annex */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 overflow-hidden">
        <div className="w-full p-3 flex items-center justify-between bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-500" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              3. Procurement Annex &amp; Engineering Specifications for Purchase Orders
            </span>
          </div>
        </div>

        <div className="p-3.5 space-y-3 text-xs">
          <p className="text-slate-500 text-[11px] leading-relaxed">
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
                <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900 font-mono text-xs">{b.ratingLabel} {b.category} ({b.poles})</strong>
                    <span className="text-slate-500 font-mono text-[10px]">Qty: {b.count}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-500 font-mono">
                    <div>Min Breaking Cap: <strong className="text-rose-700">{spec.requiredIcuKa} kA</strong></div>
                    <div>Standard: <strong className="text-slate-900">{spec.standard}</strong></div>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Trip Unit: <span className="text-slate-900 font-medium">{spec.tripUnitType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
