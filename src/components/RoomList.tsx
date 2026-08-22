'use client';

import { Plus } from 'lucide-react';
import { RoomInput, RoomData } from './RoomInput';
import { ROOM_TYPES, COUNTRY_DEFAULTS } from '@/lib/country-defaults';
import type { AcSizingRule } from '@/lib/country-defaults';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation();
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

  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const totalLoad = rooms.reduce((sum, r) => sum + r.connectedLoad, 0);
  const totalAcLoad = rooms
    .filter((r) => r.hasAc)
    .reduce((sum, r) => sum + (r.connectedLoad - r.area * r.loadDensity), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
          {t('calculator.apartmentLayout', 'Apartment Layout')} ({rooms.length} {t('calculator.roomsCount', 'Rooms')})
        </h3>
        <Button
          type="button"
          onClick={handleAddRoom}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <Plus size={14} className="text-orange-400" />
          {t('calculator.addRoom', 'Add Room')}
        </Button>
      </div>

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md shadow-lg">
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('calculator.totalArea', 'Total Area')}</span>
          <p className="text-base font-mono font-bold text-slate-200 mt-0.5">{totalArea.toFixed(1)} m²</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('common.totalLoad', 'Total Load')}</span>
          <p className="text-base font-mono font-bold text-orange-400 mt-0.5">{totalLoad.toFixed(0)} VA</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('calculator.acLoad', 'AC Load')}</span>
          <p className="text-base font-mono font-bold text-sky-400 mt-0.5">{totalAcLoad.toFixed(0)} VA</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('calculator.connectedPower', 'Connected Load')}</span>
          <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">{(totalLoad / 1000).toFixed(2)} kVA</p>
        </div>
      </div>
    </div>
  );
}
