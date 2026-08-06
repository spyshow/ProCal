import { calculateVoltageDrop } from '@/lib/calculations/cables';
import { isThreePhaseForItem } from '@/lib/calculations/feeders';
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

const cableLengthFallback = (floor: number) => 10 + (floor - 1) * 5;

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
        const length = item.cableLength ?? cableLengthFallback(fd.floorNumber);
        const cableSizeNum = parseFloat(item.cableSize) || 4;
        const systemVoltage = project.voltage === 400 ? 400 : 230;

        const calculatedVD = calculateVoltageDrop(
          item.calculatedCurrent,
          length,
          cableSizeNum,
          project.powerFactor || 0.85,
          isThreePhase,
          systemVoltage
        ).dropPercent;

        const vd = item.voltageDrop && item.voltageDrop > 0 ? item.voltageDrop : calculatedVD;
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
      const length = bl.cableLength || 10;
      const cableSizeNum = parseFloat(bl.cableSize || '') || 4;
      const systemVoltage = project.voltage === 400 ? 400 : 230;

      const vd = calculateVoltageDrop(
        current,
        length,
        cableSizeNum,
        lib.powerFactor || project.powerFactor || 0.85,
        isThreePhase,
        systemVoltage
      ).dropPercent;

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
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <h2 className="text-lg font-bold border-b pb-2">Voltage Drop Schedule</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-center">Floor</th>
            <th className="border p-2 text-left">Circuit</th>
            <th className="border p-2 text-right">Current (A)</th>
            <th className="border p-2 text-center">Cable (mm²)</th>
            <th className="border p-2 text-right">Length (m)</th>
            <th className="border p-2 text-right">VDrop (%)</th>
            <th className="border p-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="border p-2 text-gray-600">{row.buildingName}</td>
              <td className="border p-2 text-center font-mono text-orange-600">F{row.floor}</td>
              <td className="border p-2 font-semibold">{row.circuit}</td>
              <td className="border p-2 text-right font-mono">{row.current.toFixed(1)}</td>
              <td className="border p-2 text-center font-mono">{row.cable}</td>
              <td className="border p-2 text-right font-mono">{row.length}</td>
              <td className="border p-2 text-right font-mono">{row.vd.toFixed(2)}%</td>
              <td
                className={`border p-2 text-center font-semibold ${
                  row.status === 'OK'
                    ? 'text-green-600'
                    : row.status === 'WARNING'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        IEC 60364-5-52 limits: 3% for lighting, 5% for power loads.
      </p>
    </div>
  );
}
