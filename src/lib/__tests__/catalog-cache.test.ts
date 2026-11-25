import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCachedEquipmentCatalog,
  invalidateEquipmentCatalogCache,
} from "@/lib/catalog-cache";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    equipmentCatalog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe("EquipmentCatalog TTL Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateEquipmentCatalogCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateEquipmentCatalogCache();
  });

  it("caches catalog rows within TTL and deduplicates concurrent requests", async () => {
    const sample = [{ id: "eq-1", model: "E2.2B 1600", ratedCurrent: 1600, family: null }];
    mockFindMany.mockResolvedValue(sample);

    const [a, b] = await Promise.all([
      getCachedEquipmentCatalog({ ttlMs: 60_000 }),
      getCachedEquipmentCatalog({ ttlMs: 60_000 }),
    ]);

    expect(a).toEqual(sample);
    expect(b).toEqual(sample);
    expect(mockFindMany).toHaveBeenCalledTimes(1);

    const c = await getCachedEquipmentCatalog({ ttlMs: 60_000 });
    expect(c).toEqual(sample);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("refreshes catalog rows after TTL expiry", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "eq-1", model: "Old" }])
      .mockResolvedValueOnce([{ id: "eq-2", model: "New" }]);

    const first = await getCachedEquipmentCatalog({ ttlMs: 60_000 });
    expect(first[0].id).toBe("eq-1");

    vi.advanceTimersByTime(61_000);

    const second = await getCachedEquipmentCatalog({ ttlMs: 60_000 });
    expect(second[0].id).toBe("eq-2");
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });

  it("clears cached rows when invalidateEquipmentCatalogCache is called", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "eq-1", model: "Initial" }])
      .mockResolvedValueOnce([{ id: "eq-3", model: "Updated" }]);

    const first = await getCachedEquipmentCatalog({ ttlMs: 60_000 });
    expect(first[0].id).toBe("eq-1");

    invalidateEquipmentCatalogCache();

    const second = await getCachedEquipmentCatalog({ ttlMs: 60_000 });
    expect(second[0].id).toBe("eq-3");
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
