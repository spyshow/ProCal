import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The apartment sizing rule, which existed twice: once in
 * `POST /api/buildings/[id]/recalculate` and once in the MCP freshness guard,
 * which described the other as logic it "mirrors".
 *
 * `isUndersizedBreaker` is the part that matters. A manually-set breaker smaller
 * than its circuit's design current is an overload risk, so the rule clears the
 * breaker and the cable and lets the engine size them. Getting this wrong writes
 * an unsafe design into stored engineering numbers while the app still looks
 * correct — the worst failure mode in a submittal tool.
 *
 * The decision logic is pure, so it is tested directly. The database is mocked
 * because the queries around it are thin; `architecture.test.ts` pins the fact
 * that this file is the only place the rule exists.
 */

const mocks = {
  floorItemFindMany: vi.fn(),
  floorItemUpdate: vi.fn(),
  projectUpdate: vi.fn(),
  transaction: vi.fn(),
  projectFindUnique: vi.fn(),
  buildingFindMany: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    floorItem: { findMany: mocks.floorItemFindMany, update: mocks.floorItemUpdate },
    project: { findUnique: mocks.projectFindUnique, update: mocks.projectUpdate },
    building: { findMany: mocks.buildingFindMany },
    $transaction: mocks.transaction,
  },
}));

const { isUndersizedBreaker, sizeApartmentItem, applyApartmentSizing, countResidentialApartmentsByBuilding } =
  await import('./recalculate');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.projectFindUnique.mockResolvedValue({
    id: 'p1',
    voltage: 400,
    powerFactor: 0.9,
    buildings: [],
  });
  mocks.buildingFindMany.mockResolvedValue([]);
});

describe('isUndersizedBreaker', () => {
  const current = 100; // A

  it('flags a breaker below the design current', () => {
    expect(isUndersizedBreaker('63 A', current)).toBe(true);
    expect(isUndersizedBreaker('80A', current)).toBe(true);
  });

  it('accepts a breaker at or above the design current', () => {
    expect(isUndersizedBreaker('100 A', current)).toBe(false);
    expect(isUndersizedBreaker('160 A', current)).toBe(false);
  });

  it('tolerates a 0.1 A rounding gap so a correctly sized breaker is not cleared', () => {
    // Design current 100.05 A with a 100 A breaker is the engine's own rounding,
    // not an operator error. Clearing it would loop forever.
    expect(isUndersizedBreaker('100 A', 100.05)).toBe(false);
  });

  it('treats an absent breaker as not undersized, since there is nothing to clear', () => {
    expect(isUndersizedBreaker(null, current)).toBe(false);
    expect(isUndersizedBreaker(undefined, current)).toBe(false);
    expect(isUndersizedBreaker('', current)).toBe(false);
  });

  it('reads the rating out of a labelled breaker string', () => {
    // Breakers are stored in whatever form the catalog used: "63 A", "MCB-63",
    // "C32". The numeric part is the rating, so all of these are judgeable.
    expect(isUndersizedBreaker('MCB-63', 100)).toBe(true);
    expect(isUndersizedBreaker('C32', 40)).toBe(true);
    expect(isUndersizedBreaker('MCB-160', 100)).toBe(false);
  });

  it('leaves a breaker it cannot read a rating from alone', () => {
    // No digits means no rating to judge. Clearing it would destroy a value the
    // engine cannot replace.
    expect(isUndersizedBreaker('Standard Circuit Breaker', 100)).toBe(false);
    expect(isUndersizedBreaker('MCB', 100)).toBe(false);
  });
});

describe('sizeApartmentItem', () => {
  const base = {
    id: 'item-1',
    voltageDrop: 2.5,
    breakerSize: '63 A',
    cableSize: '10 mm²',
  };

  const rooms = [
    { connectedLoad: 3000 },
    { connectedLoad: 2000 },
  ];

  it('derives connected load, max demand and current from the template rooms', () => {
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 0.9,
      diversityFactor: 0.8,
      isThreePhase: true,
      rooms,
      item: { ...base, breakerSize: null, cableSize: null },
    });

    // 5000 VA -> 5 kVA connected; 5 kVA * 0.8 diversity = 4 kVA max demand
    expect(result.data.calculatedConnectedLoad).toBe(5);
    expect(result.data.calculatedMaxDemand).toBeCloseTo(4, 5);
    // 4000 / (sqrt(3) * 0.4 kV * 0.9)
    expect(result.data.calculatedCurrent).toBeCloseTo(6.41, 1);
  });

  it('computes single-phase current without the sqrt(3) factor', () => {
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 1,
      diversityFactor: 1,
      isThreePhase: false,
      rooms,
      item: { ...base, breakerSize: null, cableSize: null },
    });

    // 5000 VA / ((0.4 / sqrt(3)) * 1)
    expect(result.data.calculatedCurrent).toBeCloseTo(21.65, 1);
  });

  it('clears an undersized manual breaker and its cable so the engine re-sizes', () => {
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 0.9,
      diversityFactor: 1,
      isThreePhase: true,
      rooms: [{ connectedLoad: 20000 }], // ~29 A three-phase
      item: { ...base, breakerSize: '16 A', cableSize: '2.5 mm²' },
    });

    expect(result.data.breakerSize).toBeNull();
    expect(result.data.cableSize).toBeNull();
  });

  it('keeps a manual breaker that is safely oversized', () => {
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 0.9,
      diversityFactor: 1,
      isThreePhase: true,
      rooms: [{ connectedLoad: 2000 }],
      item: { ...base, breakerSize: '63 A', cableSize: '10 mm²' },
    });

    expect(result.data.breakerSize).toBeUndefined();
    expect(result.data.cableSize).toBeUndefined();
  });

  it('clears the 0.1 V-drop placeholder so the engine re-computes it', () => {
    // 0.1 is the "never sized" sentinel, not a real measurement.
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 0.9,
      diversityFactor: 1,
      isThreePhase: true,
      rooms,
      item: { ...base, voltageDrop: 0.1, breakerSize: null, cableSize: null },
    });

    expect(result.data.voltageDrop).toBeNull();
  });

  it('leaves a real voltage drop alone', () => {
    const result = sizeApartmentItem({
      voltage: 400,
      powerFactor: 0.9,
      diversityFactor: 1,
      isThreePhase: true,
      rooms,
      item: { ...base, voltageDrop: 2.5, breakerSize: null, cableSize: null },
    });

    expect(result.data.voltageDrop).toBeUndefined();
  });
});

describe('countResidentialApartmentsByBuilding', () => {
  it('counts apartment units, not floors', () => {
    // The regression this service exists to prevent: the MCP guard used to pass
    // floorDesigns.length here, so a 4-unit, 10-floor tower counted as 10 units
    // instead of 40 and got a different diversity factor from the UI route.
    mocks.buildingFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Tower A',
        floorDesigns: [
          { items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }] },
          { items: [{ id: 'i5' }, { id: 'i6' }, { id: 'i7' }, { id: 'i8' }] },
        ],
      },
    ]);

    return countResidentialApartmentsByBuilding('p1').then((result) => {
      expect(result).toEqual([
        { buildingId: 'b1', name: 'Tower A', isCommercial: false, apartmentCount: 8 },
      ]);
    });
  });

  it('flags commercial buildings so they are excluded from the residential total', () => {
    mocks.buildingFindMany.mockResolvedValue([
      { id: 'b1', name: 'Retail Block', floorDesigns: [{ items: [{ id: 'i1' }] }] },
      { id: 'b2', name: 'OFFICE Wing', floorDesigns: [{ items: [{ id: 'i2' }] }] },
      { id: 'b3', name: 'Mall Annex', floorDesigns: [{ items: [{ id: 'i3' }] }] },
      { id: 'b4', name: 'Commercial Annex', floorDesigns: [{ items: [{ id: 'i4' }] }] },
    ]);

    return countResidentialApartmentsByBuilding('p1').then((result) => {
      expect(result.every((b) => b.isCommercial)).toBe(true);
    });
  });

  it('ignores circuits that are not apartment units', () => {
    // The query filters type = APARTMENT, so common areas and risers never count.
    mocks.buildingFindMany.mockResolvedValue([
      { id: 'b1', name: 'Tower A', floorDesigns: [{ items: [{ id: 'i1' }] }] },
    ]);

    return countResidentialApartmentsByBuilding('p1').then((result) => {
      expect(result[0].apartmentCount).toBe(1);
      expect(mocks.buildingFindMany.mock.calls[0][0].select.floorDesigns.select.items.where).toEqual({
        type: 'APARTMENT',
      });
    });
  });
});

describe('applyApartmentSizing', () => {
  it('returns null when the project does not exist', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    expect(await applyApartmentSizing('missing')).toBeNull();
  });

  it('stamps the engine version so a later run is a no-op', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: 'p1', buildings: [] });
    mocks.transaction.mockResolvedValue([]);

    const result = await applyApartmentSizing('p1');

    expect(result).toEqual({ itemsRecalculated: 0 });
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { engineVersion: expect.any(String) },
    });
  });

  it('commits the updates in a single transaction', async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: 'p1',
      voltage: 400,
      powerFactor: 0.9,
      buildings: [{ id: 'b1', name: 'Tower A', floorDesigns: [{ id: 'f1' }] }],
    });
    mocks.buildingFindMany.mockResolvedValue([
      { id: 'b1', name: 'Tower A', floorDesigns: [{ items: [{ id: 'i1' }] }] },
    ]);
    mocks.floorItemFindMany.mockResolvedValue([
      {
        id: 'i1',
        voltageDrop: 2.5,
        breakerSize: null,
        cableSize: null,
        apartmentTemplate: { phases: 1, rooms: [{ connectedLoad: 3000 }] },
      },
    ]);
    mocks.transaction.mockResolvedValue([]);

    const result = await applyApartmentSizing('p1');

    expect(result).toEqual({ itemsRecalculated: 1 });
    expect(mocks.floorItemUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('skips items with no apartment template', async () => {
    mocks.projectFindUnique.mockResolvedValue({
      id: 'p1',
      voltage: 400,
      powerFactor: 0.9,
      buildings: [{ id: 'b1', name: 'Tower A', floorDesigns: [{ id: 'f1' }] }],
    });
    mocks.buildingFindMany.mockResolvedValue([
      { id: 'b1', name: 'Tower A', floorDesigns: [{ items: [{ id: 'i1' }] }] },
    ]);
    mocks.floorItemFindMany.mockResolvedValue([
      { id: 'i1', voltageDrop: 1, breakerSize: null, cableSize: null, apartmentTemplate: null },
    ]);
    mocks.transaction.mockResolvedValue([]);

    const result = await applyApartmentSizing('p1');

    expect(result).toEqual({ itemsRecalculated: 0 });
    expect(mocks.floorItemUpdate).not.toHaveBeenCalled();
  });
});
