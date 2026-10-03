// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomList } from './RoomList';
import { RoomData } from './RoomInput';

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    isRtl: false,
  }),
}));

describe('RoomList', () => {
  it('adds a new room with the correct load density from roomDensities', () => {
    const onChange = vi.fn();
    const rooms: RoomData[] = [
      {
        id: 'r1',
        type: 'BEDROOM',
        name: 'Bed 1',
        area: 15,
        hasAc: false,
        loadDensity: 80,
        connectedLoad: 1200,
      },
    ];

    const customDensities = {
      kitchen: 160,
      bedroom: 85,
      livingRoom: 115,
      diningRoom: 95,
      bathroom: 65,
      hall: 55,
      other: 75,
    };

    render(
      <RoomList
        rooms={rooms}
        onChange={onChange}
        country="Syria"
        roomDensities={customDensities}
      />
    );

    // Click "Add Room"
    const addBtn = screen.getByRole('button', { name: /Add Room/i });
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedRooms = onChange.mock.calls[0][0];
    expect(updatedRooms).toHaveLength(2);

    // Next room type after BEDROOM in ROOM_TYPES is LIVING_ROOM
    const addedRoom = updatedRooms[1];
    expect(addedRoom.type).toBe('LIVING_ROOM');
    // It should have density 115 (from customDensities.livingRoom), NOT 70!
    expect(addedRoom.loadDensity).toBe(115);
  });

  it('updates room density when room type is changed in the list', () => {
    let currentRooms: RoomData[] = [
      {
        id: 'r1',
        type: 'BEDROOM',
        name: 'Bed 1',
        area: 20,
        hasAc: false,
        loadDensity: 80,
        connectedLoad: 1600,
      },
    ];

    const onChange = vi.fn((newRooms) => {
      currentRooms = newRooms;
    });

    const customDensities = {
      kitchen: 175,
      bedroom: 85,
      livingRoom: 120,
      diningRoom: 95,
      bathroom: 65,
      hall: 55,
      other: 75,
    };

    const { rerender } = render(
      <RoomList
        rooms={currentRooms}
        onChange={onChange}
        country="Syria"
        roomDensities={customDensities}
      />
    );

    const typeSelect = screen.getByLabelText('Room type');
    fireEvent.change(typeSelect, { target: { value: 'KITCHEN' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(currentRooms[0].type).toBe('KITCHEN');
    expect(currentRooms[0].loadDensity).toBe(175);
    expect(currentRooms[0].connectedLoad).toBe(20 * 175); // 3500
  });
});
