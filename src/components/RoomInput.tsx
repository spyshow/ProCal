'use client';

import { Trash2 } from 'lucide-react';
import { ROOM_TYPES } from '@/lib/country-defaults';
import { calculateRoomLoad } from '@/lib/country-defaults';
import type { AcSizingRule } from '@/lib/country-defaults';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RoomData {
  id: string;
  type: string;
  name: string;
  area: number;
  hasAc: boolean;
  loadDensity: number;
  connectedLoad: number;
}

interface RoomInputProps {
  room: RoomData;
  acRules: AcSizingRule[];
  onChange: (id: string, updates: Partial<RoomData>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export function RoomInput({ room, acRules, onChange, onRemove, canRemove }: RoomInputProps) {
  const handleTypeChange = (type: string) => {
    onChange(room.id, { type });
  };

  const handleAreaChange = (area: number) => {
    const connectedLoad = calculateRoomLoad(area, room.loadDensity, room.hasAc, acRules);
    onChange(room.id, { area, connectedLoad });
  };

  const handleDensityChange = (loadDensity: number) => {
    const connectedLoad = calculateRoomLoad(room.area, loadDensity, room.hasAc, acRules);
    onChange(room.id, { loadDensity, connectedLoad });
  };

  const handleAcToggle = (hasAc: boolean) => {
    const connectedLoad = calculateRoomLoad(room.area, room.loadDensity, hasAc, acRules);
    onChange(room.id, { hasAc, connectedLoad });
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-slate-800 bg-slate-950/70 backdrop-blur-md hover:border-slate-700 transition-all">
      {/* Room Type */}
      <div className="col-span-2">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Type</label>
        <select
          value={room.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="flex h-8 w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 shadow-sm focus:outline-none focus:border-orange-500"
          aria-label="Room type"
        >
          {ROOM_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {rt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Room Name */}
      <div className="col-span-3">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Name</label>
        <Input
          value={room.name}
          onChange={(e) => onChange(room.id, { name: e.target.value })}
          className="h-8 text-xs"
          placeholder="e.g. Master Bedroom"
          aria-label="Room name"
        />
      </div>

      {/* Area */}
      <div className="col-span-2">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Area (m²)</label>
        <Input
          type="number"
          value={room.area || ''}
          onChange={(e) => handleAreaChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-xs"
          min="0"
          step="0.5"
          aria-label="Room area in square meters"
        />
      </div>

      {/* Load Density */}
      <div className="col-span-2">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Density (VA/m²)</label>
        <Input
          type="number"
          value={room.loadDensity || ''}
          onChange={(e) => handleDensityChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-xs"
          min="0"
          step="5"
          aria-label="Load density in VA per square meter"
        />
      </div>

      {/* AC Toggle */}
      <div className="col-span-1">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">AC</label>
        <button
          type="button"
          onClick={() => handleAcToggle(!room.hasAc)}
          className={cn(
            "w-full h-8 rounded text-xs font-semibold transition-all duration-150 border",
            room.hasAc
              ? "bg-orange-600 border-orange-500 text-white shadow-[0_0_10px_rgba(234,88,12,0.4)]"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
          )}
          aria-pressed={room.hasAc}
          aria-label={room.hasAc ? 'Remove AC' : 'Add AC'}
        >
          {room.hasAc ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Connected Load */}
      <div className="col-span-1">
        <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Load (VA)</label>
        <div className="h-8 py-1.5 px-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-orange-400 font-bold text-right flex items-center justify-end">
          {room.connectedLoad.toFixed(0)}
        </div>
      </div>

      {/* Remove Button */}
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(room.id)}
          disabled={!canRemove}
          className={cn(
            "h-8 w-8 rounded flex items-center justify-center transition-colors",
            canRemove
              ? "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
              : "text-slate-700 cursor-not-allowed"
          )}
          aria-label="Remove room"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
