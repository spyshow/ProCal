import {
  computeItemVoltageDrop,
  getItemCableLength,
  getBuildingLoadCableLength,
  parseCableSize,
  formatCableSizeFor,
} from '@/lib/calculations/cables';
import { isThreePhaseForItem } from '@/lib/calculations/feeders';
import { TraceableCell } from '@/components/common/TraceableCell';
import {
  buildVoltageDropTrace,
  buildDesignCurrentTrace,
} from '@/lib/calculations/trace-engine';
import type { Project } from '@/types';

export interface VDScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface VDRow {
  id: string;
  buildingName: string;
  floor: number;
  circuit: string;
  current: number;
  cable: string;
  length: number;
  vd: number;
  status: 'OK' | 'WARNING' | 'FAIL';
}

/**
 * Printable voltage-drop schedule.
 *
 * Shows estimated voltage drop for every circuit and flags it against the
 * IEC 60364-5-52 limits used elsewhere in the app (3% lighting, 5% power).
 */
export default function VDSchedule({ project, buildingId, showHeader = true }: VDScheduleProps) {
  const rows: VDRow[] = [];

  for (const b of project.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        const isThreePhase = isThreePhaseForItem(item);
        const length = getItemCableLength(item, fd.floorNumber);
        // Shared engine helper: parses "2 × 240 mm²" parallel notation,
        // applies runs + conductor material, and uses Uo = U_LL/√3 as the
        // denominator for single-phase circuits.
        const calculatedVD = computeItemVoltageDrop({
          current: item.calculatedCurrent,
          lengthMeters: length,
          cableSizeInput: item.cableSize,
          powerFactor: project.powerFactor || 0.85,
          isThreePhase,
          systemVoltageLL: project.voltage,
          material: (item.cableMaterial as 'copper' | 'aluminum' | undefined) || 'copper',
        })?.dropPercent;
        if (calculatedVD == null && !(item.voltageDrop && item.voltageDrop > 0)) continue;

        const vd = item.voltageDrop && item.voltageDrop > 0 ? item.voltageDrop : (calculatedVD ?? 0);
        const limit = item.type === 'APARTMENT' ? (project.maxVoltageDropLighting || 3) : (project.maxVoltageDropPower || 5);
        const status = vd <= limit ? 'OK' : vd <= limit * 1.2 ? 'WARNING' : 'FAIL';

        rows.push({
          id: item.id || `${b.id}-${fd.floorNumber}-${item.name}`,
          buildingName: b.name,
          floor: fd.floorNumber,
          circuit: item.name,
          current: item.calculatedCurrent,
          cable: item.cableSize,
          length,
          vd,
          status,
        });
      }
    }

    for (const bl of b.buildingLoads || []) {
      const lib = bl.loadLibraryItem;
      if (!lib) continue;
      const isThreePhase = lib.phase === 3;
      const totalKw = lib.power * bl.quantity;
      const current = isThreePhase
        ? totalKw / (Math.sqrt(3) * (lib.voltage / 1000) * lib.powerFactor)
        : totalKw / ((lib.voltage / 1000) * lib.powerFactor);
      const length = getBuildingLoadCableLength(bl);

      const calculatedVD = computeItemVoltageDrop({
        current,
        lengthMeters: length,
        cableSizeInput: bl.cableSize,
        powerFactor: lib.powerFactor || project.powerFactor || 0.85,
        isThreePhase,
        systemVoltageLL: project.voltage,
        material: (bl.cableMaterial as 'copper' | 'aluminum' | undefined) || 'copper',
      })?.dropPercent;
      // BuildingLoad rows carry no persisted override — computed only.
      if (calculatedVD == null) continue;

      const vd = calculatedVD;
      const limit = project.maxVoltageDropPower || 5;
      const status = vd <= limit ? 'OK' : vd <= limit * 1.2 ? 'WARNING' : 'FAIL';

      rows.push({
        id: bl.id,
        buildingName: b.name,
        floor: 0,
        circuit: lib.name,
        current,
        cable: bl.cableSize || '4 mm²',
        length,
        vd,
        status,
      });
    }
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
          Voltage Drop &amp; Compliance Analysis Schedule
        </h2>
        <span className="text-[11px] font-mono text-slate-600">
          Standard: <span className="font-bold text-slate-900">IEC 60364-5-52</span>
        </span>
      </div>
      <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
            <th className="p-2 border-r border-slate-800">#</th>
            <th className="p-2 border-r border-slate-800">Building</th>
            <th className="p-2 border-r border-slate-800 text-center">Floor</th>
            <th className="p-2 border-r border-slate-800">Circuit / Feeder</th>
            <th className="p-2 border-r border-slate-800 text-center">Ib (A)</th>
            <th className="p-2 border-r border-slate-800 text-center">Cable Size</th>
            <th className="p-2 border-r border-slate-800 text-right">Length (m)</th>
            <th className="p-2 border-r border-slate-800 text-right">Voltage Drop (&Delta;V %)</th>
            <th className="p-2 text-center">Compliance Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
            >
              <td className="p-2 border-r border-slate-200 font-mono text-slate-500">{idx + 1}</td>
              <td className="p-2 border-r border-slate-200 font-medium">{row.buildingName}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono">
                {row.floor === 0 ? 'MDB' : `F${row.floor}`}
              </td>
              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{row.circuit}</td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const is3Ph = (project.voltage || 400) >= 380;
                    const voltage = is3Ph ? (project.voltage || 400) : (project.voltage ? project.voltage / Math.sqrt(3) : 230);
                    const powerKw = is3Ph
                      ? (Math.sqrt(3) * (project.voltage || 400) * row.current * (project.powerFactor || 0.85)) / 1000
                      : ((project.voltage ? project.voltage / Math.sqrt(3) : 230) * row.current * (project.powerFactor || 0.85)) / 1000;
                    return buildDesignCurrentTrace({
                      loadName: `${row.buildingName} - ${row.circuit}`,
                      powerKw,
                      powerFactor: project.powerFactor || 0.85,
                      voltageV: Math.round(voltage),
                      isThreePhase: is3Ph,
                      calculatedCurrentA: row.current,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.current.toFixed(1)} A
                </TraceableCell>
              </td>
              <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                {formatCableSizeFor(row.cable, project.calculationStandard)}
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono text-slate-700">
                {row.length} m
              </td>
              <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                <TraceableCell
                  getTrace={() => {
                    const parsed = parseCableSize(row.cable);
                    const cableSize = parsed ? parsed.size : 4;
                    const runs = parsed ? parsed.runs : 1;
                    const is3Ph = (project.voltage || 400) >= 380;
                    const sysVolt = is3Ph ? (project.voltage || 400) : Math.round((project.voltage || 400) / Math.sqrt(3));
                    const dropVolts = (row.vd / 100) * sysVolt;
                    return buildVoltageDropTrace({
                      circuitName: `${row.buildingName} - ${row.circuit}`,
                      currentA: row.current,
                      lengthM: row.length,
                      cableSizeMm2: cableSize,
                      parallelRuns: runs,
                      powerFactor: project.powerFactor || 0.85,
                      systemVoltageV: sysVolt,
                      isThreePhase: is3Ph,
                      dropVolts,
                      dropPercent: row.vd,
                      maxDropPercentLimit: project.maxVoltageDropPower || 5.0,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  {row.vd.toFixed(2)} %
                </TraceableCell>
              </td>
              <td className="p-2 text-center">
                <TraceableCell
                  getTrace={() => {
                    const parsed = parseCableSize(row.cable);
                    const cableSize = parsed ? parsed.size : 4;
                    const runs = parsed ? parsed.runs : 1;
                    const is3Ph = (project.voltage || 400) >= 380;
                    const sysVolt = is3Ph ? (project.voltage || 400) : Math.round((project.voltage || 400) / Math.sqrt(3));
                    const dropVolts = (row.vd / 100) * sysVolt;
                    return buildVoltageDropTrace({
                      circuitName: `${row.buildingName} - ${row.circuit}`,
                      currentA: row.current,
                      lengthM: row.length,
                      cableSizeMm2: cableSize,
                      parallelRuns: runs,
                      powerFactor: project.powerFactor || 0.85,
                      systemVoltageV: sysVolt,
                      isThreePhase: is3Ph,
                      dropVolts,
                      dropPercent: row.vd,
                      maxDropPercentLimit: project.maxVoltageDropPower || 5.0,
                      calculationStandard: project.calculationStandard,
                    });
                  }}
                >
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      row.status === 'OK'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : row.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {row.status === 'OK' ? 'PASS' : row.status === 'WARNING' ? 'MARGINAL' : 'FAIL'}
                  </span>
                </TraceableCell>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] text-slate-500 font-mono mt-2 flex justify-between">
        <span>
          IEC 60364-5-52 project limits: Max {project.maxVoltageDropLighting || 3}% lighting / {project.maxVoltageDropPower || 5}% power (single-phase rows evaluated against Uo = {Math.round((project.voltage || 400) / Math.sqrt(3))} V).
        </span>
        <span>Total Circuits Checked: {rows.length}</span>
      </div>
    </div>
  );
}
