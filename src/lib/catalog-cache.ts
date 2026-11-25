import { db } from "@/lib/db";

const DEFAULT_CATALOG_TTL_MS = 5 * 60 * 1000;

export type CachedCatalogRow = Awaited<
  ReturnType<typeof db.equipmentCatalog.findMany<{ include: { family: true } }>>
>[number];

let cachedRows: CachedCatalogRow[] | null = null;
let cacheExpiresAt = 0;
let inflightPromise: Promise<CachedCatalogRow[]> | null = null;

/**
 * Clears the in-memory EquipmentCatalog cache and any pending read-through promise.
 * Must be called whenever an admin creates, updates, or deletes breaker catalog rows.
 */
export function invalidateEquipmentCatalogCache(): void {
  cachedRows = null;
  cacheExpiresAt = 0;
  inflightPromise = null;
}

/**
 * Returns the EquipmentCatalog (with BreakerFamily relations) via an in-memory TTL cache
 * with concurrent in-flight Promise deduplication.
 */
export async function getCachedEquipmentCatalog(options?: {
  ttlMs?: number;
}): Promise<CachedCatalogRow[]> {
  const ttlMs =
    options?.ttlMs ?? (process.env.NODE_ENV === "test" ? 0 : DEFAULT_CATALOG_TTL_MS);

  const now = Date.now();
  if (ttlMs > 0 && cachedRows !== null && now < cacheExpiresAt) {
    return cachedRows;
  }

  if (ttlMs > 0 && inflightPromise) {
    return inflightPromise;
  }

  const fetchCatalog = async (): Promise<CachedCatalogRow[]> => {
    const findMany = db.equipmentCatalog?.findMany;
    if (!findMany) return [];
    const rows = await findMany({
      include: { family: true },
      orderBy: [
        { manufacturer: "asc" },
        { category: "asc" },
        { ratedCurrent: "asc" },
      ],
    });
    if (ttlMs > 0) {
      cachedRows = rows;
      cacheExpiresAt = Date.now() + ttlMs;
    }
    return rows;
  };

  if (ttlMs <= 0) {
    return fetchCatalog();
  }

  const promise = fetchCatalog().finally(() => {
    if (inflightPromise === promise) {
      inflightPromise = null;
    }
  });
  inflightPromise = promise;
  return promise;
}
