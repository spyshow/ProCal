import { PrismaClient } from "@/generated/prisma/client";

/**
 * Strip trailing frame-size digits from a series name so e.g.
 * "ComPacT NSX160" and "ComPacT NSX250" both map to "ComPacT NSX".
 */
export function normalizeFamilyName(series: string): string {
  return series.replace(/(?<=[A-Z]{2,})\d+$/, "").trim();
}

interface FamilyKey {
  manufacturer: string;
  category: string;
  name: string;
}

/**
 * Upsert breaker families derived from a list of series strings.
 * Returns a Map keyed by `${manufacturer}|${category}|${name}` -> familyId.
 */
export async function upsertBreakerFamilies(
  db: PrismaClient,
  entries: Array<{ manufacturer: string; category: string; series: string }>
): Promise<Map<string, string>> {
  const familyMap = new Map<string, FamilyKey>();
  for (const entry of entries) {
    const name = normalizeFamilyName(entry.series);
    const key = `${entry.manufacturer}|${entry.category}|${name}`;
    if (!familyMap.has(key)) {
      familyMap.set(key, {
        manufacturer: entry.manufacturer,
        category: entry.category,
        name,
      });
    }
  }

  const results: Array<{ id: string; manufacturer: string; category: string; name: string }> = [];
  for (const family of familyMap.values()) {
    const upserted = await db.breakerFamily.upsert({
      where: {
        manufacturer_category_name: {
          manufacturer: family.manufacturer,
          category: family.category,
          name: family.name,
        },
      },
      update: {},
      create: family,
    });
    results.push(upserted);
  }

  return new Map(results.map((f) => [`${f.manufacturer}|${f.category}|${f.name}`, f.id]));
}

export function getFamilyKey(manufacturer: string, category: string, series: string): string {
  return `${manufacturer}|${category}|${normalizeFamilyName(series)}`;
}
