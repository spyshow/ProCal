import { useMemo } from 'react';
import { computeFeeders, createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import type { Project } from '@/types';

export interface MDBScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface MDBRow {
  idx: number;
  building: string;
  floor: number;
  feeder: string;
  type: string;
  demand: number;
  current: number;
  breaker: string;
  cable: string;
  /** Derated cable ampacity (Iz, A) — must cover the breaker rating. */
  cableIz?: number;
  isSubPanel?: boolean;
  isMainIncomer?: boolean;
}

/**
 * Printable Main Distribution Board feeder schedule.
 *
 * Uses `computeFeeders` to list every outgoing MDB feeder, SMDB sub-panel feeder,
 * and downstream circuit breaker matching the rest of the application.
 */
export default function MDBSchedule({ project, buildingId, showHeader = true }: MDBScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project.preferredManufacturer]);
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
        project.preferredManufacturer
      ),
    [equipment, project]
  );

  // The full feeder schedule is derived purely from project inputs + the live
  // catalog. Memoized so unrelated reports-page state changes (tab switches,
  // revision panel, export spinners) don't recompute every building's feeders.
  const mdbRows: MDBRow[] = useMemo(() => {
    const rows: MDBRow[] = [];
    let mdbIndex = 0;

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
        mainCableIz,
      } = computeFeeders(bldg, project, findBreaker);

      const feederFloor = (feederName: string): number => {
        const m = feederName.match(/^F(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };

      const currentToKw = (current: number) =>
        (Math.sqrt(3) * (project.voltage / 1000) * current * project.powerFactor);

      // Main incomer row: the catalog-frame breaker and its re-sized cable
      // (size + parallel runs + derated ampacity Iz) come from computeFeeders,
      // so this report shows the same device as the panel / breaker-schedule /
      // coordination pages. Demand/current use the tuned pickup Ir.
      mdbIndex += 1;
      rows.push({
        idx: mdbIndex,
        building: bldg.name,
        floor: 0,
        feeder: 'Main Incomer',
        type: mainIncomerSettings.category ?? (mainBreakerIn >= 630 ? 'ACB' : 'MCCB'),
        demand: currentToKw(mainIncomerSettings.ir),
        current: mainIncomerSettings.ir,
        breaker: `${mainBreakerIn}A`,
        cable: mainParallelRuns > 1
          ? `${mainParallelRuns} × ${mainCableSize} mm²`
          : `${mainCableSize} mm²`,
        cableIz: mainCableIz,
        isMainIncomer: true,
      });

      for (const f of mdbFeeders) {
        mdbIndex += 1;
        const floor = feederFloor(f.name);
        rows.push({
          idx: mdbIndex,
          building: bldg.name,
          floor,
          feeder: f.name,
          type: f.type,
          demand: currentToKw(f.current),
          current: f.current,
          breaker: `${f.breakerSize}A`,
          cable: f.formattedCableSize ?? `${f.cableSize} mm²`,
          cableIz: f.cableIz,
          isSubPanel: f.type === 'SMDB',
        });
      }

      for (const floorNumber of smdbFloorNumbers) {
        for (const f of smdbFeeders(floorNumber)) {
          mdbIndex += 1;
          rows.push({
            idx: mdbIndex,
            building: bldg.name,
            floor: floorNumber,
            feeder: f.name,
            type: f.type,
            demand: currentToKw(f.current),
            current: f.current,
            breaker: `${f.breakerSize}A`,
            cable: f.formattedCableSize ?? `${f.cableSize} mm²`,
            cableIz: f.cableIz,
            isSubPanel: false,
          });
        }
      }
    }
    return rows;
  }, [project, buildingId, findBreaker]);

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
            Main Distribution Board (MDB) Schedule
          </h2>
          <span className="text-[11px] font-mono text-slate-600">
            Total Feeders: <span className="font-bold text-slate-900">{mdbRows.length}</span>
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
          Main Distribution Board (MDB) Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">{project.calculationStandard ?? 'IEC 60364'}</span>
        </span>
      </div>
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800">Feeder Description</th>
            <th className="p-2 border-r border-slate-800 text-center">Type</th>
            <th className="p-2 border-r border-slate-800 text-right">Demand (kW)</th>
            <th className="p-2 border-r border-slate-800 text-right">Current (A)</th>
            <th className="p-2 border-r border-slate-800 text-center">Protection (In)</th>
            <th className="p-2 border-r border-slate-800 text-center">Feeder Cable</th>
            <th className="p-2 text-right">Iz (A)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {mdbRows.map((row, idx) => (
            <tr
              key={row.idx}
              className={
                row.isMainIncomer
                  ? 'bg-amber-50/90 font-bold border-b-2 border-amber-300'
                  : row.isSubPanel
                  ? 'bg-sky-50/60 font-semibold'
                  : idx % 2 === 0
                  ? 'bg-white'
                  : 'bg-slate-50/80'
              }
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{row.idx}</td>
              <td className="p-2 border-r border-slate-200">{row.building}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">{row.isMainIncomer ? '—' : `F${row.floor}`}</td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.feeder}</td>
              <td className="p-2 border-r border-slate-200 text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  {row.type.replace('_', ' ')}
                </span>
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">{row.demand.toFixed(1)}</td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-amber-700">
                {row.current.toFixed(1)}
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">{row.breaker}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-800">{row.cable}</td>
              <td className="p-2 text-right font-mono text-slate-700">
                {row.cableIz != null ? `${row.cableIz.toFixed(0)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
