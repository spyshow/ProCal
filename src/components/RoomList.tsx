'use client';

import { Plus } from 'lucide-react';
import { RoomInput, RoomData } from './RoomInput';
import { ROOM_TYPES, COUNTRY_DEFAULTS } from '@/lib/country-defaults';
import type { AcSizingRule } from '@/lib/country-defaults';

interface RoomListProps {
  rooms: RoomData[];
  onChange: (rooms: RoomData[]) => void;
  country?: string;
  acRules?: AcSizingRule[];
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function RoomList({ rooms, onChange, country = 'Syria', acRules }: RoomListProps) {
  const defaults = COUNTRY_DEFAULTS[country];
  const rules = acRules || defaults?.acSizingRules || [];

  const handleAddRoom = () => {
    const lastRoom = rooms[rooms.length - 1];
    const lastType = lastRoom?.type || 'BEDROOM';
    const typeIndex = ROOM_TYPES.findIndex((r) => r.value === lastType);
    const nextType = ROOM_TYPES[(typeIndex + 1) % ROOM_TYPES.length].value;

    const defaultDensity = defaults?.roomDensities[nextType.toLowerCase() as keyof typeof defaults.roomDensities] || 70;

    const newRoom: RoomData = {
      id: generateId(),
      type: nextType,
      name: '',
      area: 0,
      hasAc: false,
      loadDensity: defaultDensity,
      connectedLoad: 0,
    };

    onChange([...rooms, newRoom]);
  };

  const handleChange = (id: string, updates: Partial<RoomData>) => {
    const updated = rooms.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
    onChange(updated);
  };

  const handleRemove = (id: string) => {
    if (rooms.length <= 1) return;
    onChange(rooms.filter((r) => r.id !== id));
  };

  // Calculate totals
  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const totalLoad = rooms.reduce((sum, r) => sum + r.connectedLoad, 0);
  const totalAcLoad = rooms
    .filter((r) => r.hasAc)
    .reduce((sum, r) => sum + (r.connectedLoad - r.area * r.loadDensity), 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Rooms ({rooms.length})
        </h3>
        <button
          type="button"
          onClick={handleAddRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-orange-400 transition-colors"
        >
          <Plus size={12} />
          Add Room
        </button>
      </div>

      {/* Room List */}
      <div className="space-y-2">
        {rooms.map((room) => (
          <RoomInput
            key={room.id}
            room={room}
            acRules={rules}
            onChange={handleChange}
            onRemove={handleRemove}
            canRemove={rooms.length > 1}
          />
        ))}
      </div>

      {/* Totals */}
      <div className="flex items-center gap-6 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <div>
          <span className="text-[10px] text-gray-500 uppercase">Total Area</span>
          <p className="text-sm font-mono text-gray-300">{totalArea.toFixed(1)} m²</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase">Total Load</span>
          <p className="text-sm font-mono text-orange-400">{totalLoad.toFixed(0)} VA</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase">AC Load</span>
          <p className="text-sm font-mono text-blue-400">{totalAcLoad.toFixed(0)} VA</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase">Connected</span>
          <p className="text-sm font-mono text-green-400">{(totalLoad / 1000).toFixed(2)} kW</p>
        </div>
      </div>
    </div>
  );
}
