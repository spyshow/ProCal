'use client';

import { useEffect, useState } from 'react';
import type { EquipmentItem } from '@/lib/calculations/feeders';

/**
 * Shared equipment-catalog fetch with in-flight + short-TTL caching.
 *
 * The reports page mounts every schedule component at once (active tab +
 * hidden print section), and each used to fetch `/api/equipment` on its own —
 * 3 identical ~200KB downloads per page load. This hook dedupes concurrent
 * calls with the same query into one request, and serves repeat mounts from a
 * short-lived cache so tab switches / print-section re-renders stay cheap.
 */
const inflight = new Map<string, Promise<EquipmentItem[]>>();
const cache = new Map<string, { data: EquipmentItem[]; at: number }>();
const TTL_MS = 60_000;

export function fetchEquipmentCatalog(query: string): Promise<EquipmentItem[]> {
  const key = query || ''; // "/api/equipment?" → ""
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return Promise.resolve(cached.data);
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const url = `/api/equipment${query ? `?${query}` : ''}`;
  const promise = fetch(url)
    .then((res) => (res.ok ? res.json() : []))
    .then((data: EquipmentItem[]) => {
      cache.set(key, { data, at: Date.now() });
      return data;
    })
    .catch(() => [] as EquipmentItem[]);
  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}

export function useEquipmentCatalog(query: string): { equipment: EquipmentItem[]; catalogLoaded: boolean } {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEquipmentCatalog(query).then((data) => {
      if (!cancelled) {
        setEquipment(data);
        setCatalogLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return { equipment, catalogLoaded };
}
