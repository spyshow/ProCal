'use client';

import { Trash2 } from 'lucide-react';
import { ROOM_TYPES } from '@/lib/country-defaults';
import { calculateRoomLoad } from '@/lib/country-defaults';
import type { AcSizingRule } from '@/lib/country-defaults';

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

  const acWatts = room.hasAc ? calculateRoomLoad(room.area, 0, true, acRules) : 0;

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-gray-800 bg-gray-900/40">
      {/* Room Type */}
      <div className="col-span-2">
        <label className="block text-[10px] text-gray-500 mb-1">Type</label>
        <select
          value={room.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="dense-input w-full rounded text-xs"
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
        <label className="block text-[10px] text-gray-500 mb-1">Name</label>
        <input
          value={room.name}
          onChange={(e) => onChange(room.id, { name: e.target.value })}
          className="dense-input w-full rounded text-xs"
          placeholder="e.g., Master Bedroom"
          aria-label="Room name"
        />
      </div>

      {/* Area */}
      <div className="col-span-2">
        <label className="block text-[10px] text-gray-500 mb-1">Area (m²)</label>
        <input
          type="number"
          value={room.area || ''}
          onChange={(e) => handleAreaChange(parseFloat(e.target.value) || 0)}
          className="dense-input w-full rounded text-xs"
          min="0"
          step="0.5"
          aria-label="Room area in square meters"
        />
      </div>

      {/* Load Density */}
      <div className="col-span-2">
        <label className="block text-[10px] text-gray-500 mb-1">Density (VA/m²)</label>
        <input
          type="number"
          value={room.loadDensity || ''}
          onChange={(e) => handleDensityChange(parseFloat(e.target.value) || 0)}
          className="dense-input w-full rounded text-xs"
          min="0"
          step="5"
          aria-label="Load density in VA per square meter"
        />
      </div>

      {/* AC Toggle */}
      <div className="col-span-1">
        <label className="block text-[10px] text-gray-500 mb-1">AC</label>
        <button
          type="button"
          onClick={() => handleAcToggle(!room.hasAc)}
          className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
            room.hasAc
              ? 'bg-orange-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
          aria-pressed={room.hasAc}
          aria-label={room.hasAc ? 'Remove AC' : 'Add AC'}
        >
          {room.hasAc ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Connected Load */}
      <div className="col-span-1">
        <label className="block text-[10px] text-gray-500 mb-1">Load (VA)</label>
        <div className="py-1.5 px-2 rounded bg-gray-800 text-xs font-mono text-orange-400 text-right">
          {room.connectedLoad.toFixed(0)}
        </div>
      </div>

      {/* Remove Button */}
      <div className="col-span-1 flex justify-center">
        <label className="block text-[10px] text-transparent mb-1">Remove</label>
        <button
          type="button"
          onClick={() => onRemove(room.id)}
          disabled={!canRemove}
          className={`p-1.5 rounded transition-colors ${
            canRemove
              ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
              : 'text-gray-700 cursor-not-allowed'
          }`}
          aria-label="Remove room"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
