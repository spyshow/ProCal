// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomInput, RoomData } from './RoomInput';

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    isRtl: false,
  }),
}));

const mockAcRules = [
  { maxArea: 15, btu: 9000, watts: 2637 },
  { maxArea: 25, btu: 12000, watts: 3516 },
  { maxArea: Infinity, btu: 18000, watts: 5274 },
];

const mockRoomDensities = {
  kitchen: 150,
  bedroom: 80,
  livingRoom: 100,
  diningRoom: 90,
  bathroom: 60,
  hall: 50,
  other: 70,
};

describe('RoomInput', () => {
  it('updates loadDensity and connectedLoad when room type changes', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const room: RoomData = {
      id: 'room-1',
      type: 'BEDROOM',
      name: 'Master Bedroom',
      area: 20,
      hasAc: false,
      loadDensity: 80,
      connectedLoad: 1600, // 20 * 80
    };

    render(
      <RoomInput
        room={room}
        acRules={mockAcRules}
        roomDensities={mockRoomDensities}
        onChange={onChange}
        onRemove={onRemove}
        canRemove={true}
      />
    );

    const typeSelect = screen.getByLabelText('Room type');
    fireEvent.change(typeSelect, { target: { value: 'KITCHEN' } });

    expect(onChange).toHaveBeenCalledWith('room-1', {
      type: 'KITCHEN',
      loadDensity: 150,
      connectedLoad: 3000, // 20 * 150
    });
  });

  it('updates loadDensity for LIVING_ROOM using livingRoom density and recalculates with AC', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const room: RoomData = {
      id: 'room-2',
      type: 'BEDROOM',
      name: 'Room',
      area: 20,
      hasAc: true,
      loadDensity: 80,
      connectedLoad: 20 * 80 + 3516,
    };

    render(
      <RoomInput
        room={room}
        acRules={mockAcRules}
        roomDensities={mockRoomDensities}
        onChange={onChange}
        onRemove={onRemove}
        canRemove={true}
      />
    );

    const typeSelect = screen.getByLabelText('Room type');
    fireEvent.change(typeSelect, { target: { value: 'LIVING_ROOM' } });

    expect(onChange).toHaveBeenCalledWith('room-2', {
      type: 'LIVING_ROOM',
      loadDensity: 100,
      connectedLoad: 20 * 100 + 3516, // 2000 + 3516 = 5516
    });
  });

  it('uses custom project room densities if provided', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    const customProjectDensities = {
      kitchen: 180,
      bedroom: 95,
      livingRoom: 125,
      diningRoom: 110,
      bathroom: 70,
      hall: 55,
      other: 85,
    };

    const room: RoomData = {
      id: 'room-3',
      type: 'BEDROOM',
      name: '',
      area: 10,
      hasAc: false,
      loadDensity: 95,
      connectedLoad: 950,
    };

    render(
      <RoomInput
        room={room}
        acRules={mockAcRules}
        roomDensities={customProjectDensities}
        onChange={onChange}
        onRemove={onRemove}
        canRemove={true}
      />
    );

    const typeSelect = screen.getByLabelText('Room type');
    fireEvent.change(typeSelect, { target: { value: 'DINING_ROOM' } });

    expect(onChange).toHaveBeenCalledWith('room-3', {
      type: 'DINING_ROOM',
      loadDensity: 110,
      connectedLoad: 1100, // 10 * 110
    });
  });
});
