'use client';

import type { FloorItem, Project } from '@/types';

export interface BOMScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface BOMItem {
  sizeNum: number;
  sizeLabel: string;
  length: number;
  count: number;
}

interface BreakerBOMItem {
  ratingAmps: number;
  ratingLabel: string;
  count: number;
}

/**
 * Printable Bill of Materials schedule.
 *
 * Aggregates cable and breaker quantities across every floor item and building load
 * in the project (optionally filtered to a single building).
 */
export default function BOMSchedule({ project, buildingId, showHeader = true }: BOMScheduleProps) {
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
        cableLength: bl.cableLength || 10,
        floor: 0,
        building: b.name,
      });
    }
  }

  const cableBOM: Record<number, BOMItem> = {};
  const breakerBOM: Record<number, BreakerBOMItem> = {};
  const cableLengthFallback = (floor: number) => 10 + (floor - 1) * 5;

  for (const item of allItems) {
    const sizeNum = parseFloat(item.cableSize) || 4;
    const sizeLabel = `${sizeNum} mm²`;

    if (!cableBOM[sizeNum]) {
      cableBOM[sizeNum] = { sizeNum, sizeLabel, length: 0, count: 0 };
    }
    cableBOM[sizeNum].length += item.cableLength ?? cableLengthFallback(item.floor);
    cableBOM[sizeNum].count += 1;

    const breakerAmps = parseFloat(String(item.breakerSize).replace(/[^0-9.]/g, '')) || 16;
    const breakerLabel = `${breakerAmps}A`;

    if (!breakerBOM[breakerAmps]) {
      breakerBOM[breakerAmps] = { ratingAmps: breakerAmps, ratingLabel: breakerLabel, count: 0 };
    }
    breakerBOM[breakerAmps].count += 1;
  }

  const cableRows = Object.values(cableBOM).sort((a, b) => a.sizeNum - b.sizeNum);
  const breakerRows = Object.values(breakerBOM).sort((a, b) => a.ratingAmps - b.ratingAmps);

  const totalCableLength = Math.round(cableRows.reduce((s, e) => s + e.length, 0));

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="font-semibold">{project.name}</span>
          <span>{project.date || new Date().toLocaleDateString()}</span>
        </div>
      )}
      <h2 className="text-lg font-bold border-b pb-2">Bill of Materials (BOM)</h2>

      <h3 className="font-bold">Cable Schedule</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Size (mm²)</th>
            <th className="border p-2 text-right">Circuits</th>
            <th className="border p-2 text-right">Est. Length (m)</th>
          </tr>
        </thead>
        <tbody>
          {cableRows.map((entry) => (
            <tr key={entry.sizeNum} className="hover:bg-gray-50">
              <td className="border p-2 font-mono font-semibold">{entry.sizeLabel}</td>
              <td className="border p-2 text-right font-mono">{entry.count}</td>
              <td className="border p-2 text-right font-mono">{Math.round(entry.length)}m</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="border p-2">TOTAL</td>
            <td className="border p-2 text-right font-mono">{allItems.length}</td>
            <td className="border p-2 text-right font-mono">{totalCableLength}m</td>
          </tr>
        </tbody>
      </table>

      <h3 className="font-bold mt-4">Breaker Schedule</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Rating (A)</th>
            <th className="border p-2 text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {breakerRows.map((entry) => (
            <tr key={entry.ratingAmps} className="hover:bg-gray-50">
              <td className="border p-2 font-mono font-semibold">{entry.ratingLabel}</td>
              <td className="border p-2 text-right font-mono">{entry.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
