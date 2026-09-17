import { useMemo } from 'react';
import { computeFeeders, createFindBreaker, type FindBreaker, type EquipmentItem } from '@/lib/calculations/feeders';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { formatCableSizeFor, parseCableSize, calculateCableAmpacity } from '@/lib/calculations/cables';
import { codeOf } from '@/lib/calculations/codes';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { TraceableCell } from '@/components/common/TraceableCell';
import {
  buildDesignCurrentTrace,
  buildBreakerSizingTrace,
  buildCableAmpacityTrace,
} from '@/lib/calculations/trace-engine';
import type { Project } from '@/types';

export interface MDBScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
  equipment?: EquipmentItem[];
  findBreaker?: FindBreaker;
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
  powerFactor?: number;
  isThreePhase?: boolean;
  upsizeReason?: string;
  isSubPanel?: boolean;
  isMainIncomer?: boolean;
  category?: 'ACB' | 'MCCB' | 'MCB';
  breakingCapacityKa?: number | null;
}

/**
 * Printable Main Distribution Board feeder schedule.
 *
 * Uses `computeFeeders` to list every outgoing MDB feeder, SMDB sub-panel feeder,
 * and downstream circuit breaker matching the rest of the application.
 */
export default function MDBSchedule({
  project,
  buildingId,
  showHeader = true,
  equipment: preloadedEquipment,
  findBreaker: preloadedFindBreaker,
}: MDBScheduleProps) {
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project.preferredManufacturer]);
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
        project.preferredManufacturer
      ),
    [preloadedFindBreaker, equipment, project]
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
        mainIncomerCurrent,
      } = computeFeeders(bldg, project, findBreaker);

      const feederFloor = (feederName: string): number => {
        const m = feederName.match(/^F(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };

      const currentToKw = (current: number, isThreePhase: boolean = true, pf: number = project.powerFactor) =>
        isThreePhase
          ? (Math.sqrt(3) * (project.voltage / 1000) * current * pf)
          : ((project.voltage / Math.sqrt(3) / 1000) * current * pf);

      // Main incomer row: demand uses building total demand kW directly from balance
      const allBldgItems = [
        ...bldg.floorDesigns.flatMap((fd) => fd.items),
        ...(bldg.buildingLoads ?? []),
      ];
      const bldgBalance = phaseBalance(allBldgItems as any, project as any);

      mdbIndex += 1;
      rows.push({
        idx: mdbIndex,
        building: bldg.name,
        floor: 0,
        feeder: 'Main Incomer',
        type: mainIncomerSettings.category ?? (mainBreakerIn >= 630 ? 'ACB' : 'MCCB'),
        category: 'ACB',
        breakingCapacityKa: 65,
        demand: bldgBalance.totalKw,
        current: mainIncomerCurrent,
        breaker: `${mainBreakerIn}A`,
        cable: mainParallelRuns > 1
          ? `${mainParallelRuns} × ${mainCableSize} mm²`
          : `${mainCableSize} mm²`,
        cableIz: mainCableIz,
        powerFactor: project.powerFactor,
        isThreePhase: true,
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
          category: f.category,
          breakingCapacityKa: f.breakingCapacityKa,
          demand: f.demandKw ?? currentToKw(f.current, f.isThreePhase, f.powerFactor ?? project.powerFactor),
          current: f.current,
          breaker: `${f.breakerSize}A`,
          cable: f.formattedCableSize ?? `${f.cableSize} mm²`,
          cableIz: f.cableIz,
          powerFactor: f.powerFactor ?? project.powerFactor,
          isThreePhase: f.isThreePhase,
          upsizeReason: f.upsizeReason,
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
            category: f.category,
            breakingCapacityKa: f.breakingCapacityKa,
            demand: f.demandKw ?? currentToKw(f.current, f.isThreePhase, f.powerFactor ?? project.powerFactor),
            current: f.current,
            breaker: `${f.breakerSize}A`,
            cable: f.formattedCableSize ?? `${f.cableSize} mm²`,
            cableIz: f.cableIz,
            powerFactor: f.powerFactor ?? project.powerFactor,
            isThreePhase: f.isThreePhase,
            upsizeReason: f.upsizeReason,
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
        <div className="p-6 text-center text-sm text-slate-500 font-mono">Loading breaker catalog…</div>
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
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden shadow-xs">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800">Feeder Description</th>
            <th className="p-2 border-r border-slate-800 text-center">Type</th>
            <th className="p-2 border-r border-slate-800 text-right">Demand (kW)</th>
            <th className="p-2 border-r border-slate-800 text-center">Current (A)</th>
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
                  ? 'bg-amber-50/90 font-bold border-b-2 border-amber-300 text-slate-900'
                  : row.isSubPanel
                  ? 'bg-sky-50/80 font-semibold text-slate-900'
                  : idx % 2 === 0
                  ? 'bg-white'
                  : 'bg-slate-100'
              }
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{row.idx}</td>
              <td className="p-2 border-r border-slate-200">{row.building}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">{row.isMainIncomer ? '—' : `F${row.floor}`}</td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.feeder}</td>
              <td className="p-2 border-r border-slate-200 text-center text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                  {row.type.replace('_', ' ')}
                </span>
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() =>
                    buildDesignCurrentTrace({
                      loadName: `${row.building} - ${row.feeder}`,
                      powerKw: row.demand,
                      powerFactor: row.powerFactor ?? project.powerFactor ?? 0.85,
                      voltageV: project.voltage || 400,
                      isThreePhase: row.isThreePhase ?? true,
                      calculatedCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                      isFirePump: (row.feeder || '').toLowerCase().includes('fire') || (row.type || '').toLowerCase().includes('fire'),
                      isMotor: ['pump', 'motor', 'elevator', 'hvac', 'chiller', 'ac', 'fan'].some(k => (row.feeder || '').toLowerCase().includes(k) || (row.type || '').toLowerCase().includes(k)),
                      sizingReason: row.upsizeReason,
                    })
                  }
                >
                  {row.demand.toFixed(1)}
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-amber-700">
                <TraceableCell
                  getTrace={() =>
                    buildDesignCurrentTrace({
                      loadName: `${row.building} - ${row.feeder}`,
                      powerKw: row.demand,
                      powerFactor: row.powerFactor ?? project.powerFactor ?? 0.85,
                      voltageV: project.voltage || 400,
                      isThreePhase: row.isThreePhase ?? true,
                      calculatedCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                      isFirePump: (row.feeder || '').toLowerCase().includes('fire') || (row.type || '').toLowerCase().includes('fire'),
                      isMotor: ['pump', 'motor', 'elevator', 'hvac', 'chiller', 'ac', 'fan'].some(k => (row.feeder || '').toLowerCase().includes(k) || (row.type || '').toLowerCase().includes(k)),
                      sizingReason: row.upsizeReason,
                    })
                  }
                >
                  {row.current.toFixed(1)}
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const breakerNumeric = parseInt(row.breaker.replace(/\D/g, ''), 10) || Math.ceil(row.current);
                    const isMcb = row.category === 'MCB' || (!row.category && breakerNumeric <= 63 && !['SMDB', 'SERVICE_PANEL', 'PUMP_PANEL', 'ELEVATOR_PANEL'].includes(row.type));
                    const defaultIcu = breakerNumeric >= 630 ? 65 : isMcb ? 10 : 36;
                    return buildBreakerSizingTrace({
                      circuitName: `${row.building} - ${row.feeder}`,
                      designCurrentA: row.current,
                      selectedTripA: breakerNumeric,
                      category: row.category ?? (isMcb ? 'MCB' : breakerNumeric >= 630 ? 'ACB' : 'MCCB'),
                      frameSizeA: breakerNumeric >= 630 ? breakerNumeric : isMcb ? breakerNumeric : breakerNumeric > 160 ? 250 : 160,
                      breakingCapacityKa: row.breakingCapacityKa ?? defaultIcu,
                      cableAmpacityA: row.cableIz,
                      calculationStandard: project.calculationStandard,
                      isFirePump: (row.feeder || '').toLowerCase().includes('fire') || (row.type || '').toLowerCase().includes('fire'),
                      isMotor: ['pump', 'motor', 'elevator', 'hvac', 'chiller', 'ac', 'fan'].some(k => (row.feeder || '').toLowerCase().includes(k) || (row.type || '').toLowerCase().includes(k)),
                      sizingReason: row.upsizeReason,
                    });
                  }}
                >
                  {row.breaker}
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">
                <TraceableCell
                  getTrace={() => {
                    const parsed = parseCableSize(row.cable);
                    const cableSize = parsed ? parsed.size : 16;
                    const runs = parsed ? parsed.runs : 1;
                    const amp = calculateCableAmpacity(cableSize, true, {
                      material: 'copper',
                      insulation: 'XLPE',
                      installMethod: 'E',
                      ambientTemp: project.ambientTemp || 30,
                      groupingCount: project.groupingCount || 1,
                      parallelRuns: runs,
                      code: codeOf(project.calculationStandard),
                    });
                    return buildCableAmpacityTrace({
                      circuitName: `${row.building} - ${row.feeder}`,
                      cableSizeMm2: cableSize,
                      parallelRuns: runs,
                      material: 'copper',
                      insulation: 'XLPE',
                      installMethod: 'Method E',
                      ambientTempC: project.ambientTemp || 30,
                      groupingCount: project.groupingCount || 1,
                      tempFactor: amp.tempFactor ?? 1.0,
                      groupFactor: amp.groupFactor ?? 1.0,
                      nominalAmpacityPerRun: amp.singleNominalAmpacity,
                      deratedAmpacityPerRun: amp.singleDeratedAmpacity,
                      totalDeratedAmpacity: amp.deratedAmpacity,
                      breakerSizeA: parseInt(row.breaker.replace(/\D/g, ''), 10) || undefined,
                      designCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {formatCableSizeFor(row.cable, project.calculationStandard)}
                </TraceableCell>
              </td>
              <td className="p-2 text-right font-mono text-slate-600">
                {row.cableIz != null ? (
                  <TraceableCell
                    getTrace={() => {
                      const parsed = parseCableSize(row.cable);
                      const cableSize = parsed ? parsed.size : 16;
                      const runs = parsed ? parsed.runs : 1;
                      const amp = calculateCableAmpacity(cableSize, true, {
                        material: 'copper',
                        insulation: 'XLPE',
                        installMethod: 'E',
                        ambientTemp: project.ambientTemp || 30,
                        groupingCount: project.groupingCount || 1,
                        parallelRuns: runs,
                        code: codeOf(project.calculationStandard),
                      });
                      return buildCableAmpacityTrace({
                        circuitName: `${row.building} - ${row.feeder}`,
                        cableSizeMm2: cableSize,
                        parallelRuns: runs,
                        material: 'copper',
                        insulation: 'XLPE',
                        installMethod: 'Method E',
                        ambientTempC: project.ambientTemp || 30,
                        groupingCount: project.groupingCount || 1,
                        tempFactor: amp.tempFactor ?? 1.0,
                        groupFactor: amp.groupFactor ?? 1.0,
                        nominalAmpacityPerRun: amp.singleNominalAmpacity,
                        deratedAmpacityPerRun: amp.singleDeratedAmpacity,
                        totalDeratedAmpacity: amp.deratedAmpacity,
                        breakerSizeA: parseInt(row.breaker.replace(/\D/g, ''), 10) || undefined,
                        designCurrentA: row.current,
                        calculationStandard: project.calculationStandard,
                      });
                    }}
                  >
                    {row.cableIz.toFixed(0)}
                  </TraceableCell>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
