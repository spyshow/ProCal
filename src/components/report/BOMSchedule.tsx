'use client';

import type { FloorItem, Project } from '@/types';

export interface BOMScheduleProps {
  project: Project;
  buildingId?: string;
  showHeader?: boolean;
}

interface BOMItem {
  size: string;
  length: number;
  count: number;
}

interface BreakerBOMItem {
  rating: string;
  count: number;
}

/**
 * Printable Bill of Materials schedule.
 *
 * Aggregates cable and breaker quantities across every floor item in the
 * project (optionally filtered to a single building).
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
  }

  const cableBOM: Record<string, BOMItem> = {};
  const breakerBOM: Record<string, BreakerBOMItem> = {};
  const cableLengthFallback = (floor: number) => 10 + (floor - 1) * 5;

  for (const item of allItems) {
    const cableKey = item.cableSize;
    if (!cableBOM[cableKey]) {
      cableBOM[cableKey] = { size: item.cableSize, length: 0, count: 0 };
    }
    cableBOM[cableKey].length += item.cableLength ?? cableLengthFallback(item.floor);
    cableBOM[cableKey].count += 1;

    const breakerKey = item.breakerSize;
    if (!breakerBOM[breakerKey]) {
      breakerBOM[breakerKey] = { rating: item.breakerSize, count: 0 };
    }
    breakerBOM[breakerKey].count += 1;
  }

  const cableRows = Object.values(cableBOM);
  const breakerRows = Object.values(breakerBOM);

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
            <tr key={entry.size} className="hover:bg-gray-50">
              <td className="border p-2 font-mono font-semibold">{entry.size} mm²</td>
              <td className="border p-2 text-right font-mono">{entry.count}</td>
              <td className="border p-2 text-right font-mono">{entry.length}m</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="border p-2">TOTAL</td>
            <td className="border p-2 text-right font-mono">{allItems.length}</td>
            <td className="border p-2 text-right font-mono">
              {cableRows.reduce((s, e) => s + e.length, 0)}m
            </td>
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
            <tr key={entry.rating} className="hover:bg-gray-50">
              <td className="border p-2 font-mono font-semibold">{entry.rating}</td>
              <td className="border p-2 text-right font-mono">{entry.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
