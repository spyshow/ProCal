import { db } from "@/lib/db";
import { COUNTRY_DEFAULTS, type CountryConfig } from "./country-defaults";

/**
 * Durable country-default overrides backed by the AppSetting table
 * (keys "country:<code>"). Replaces the previous process-memory map that
 * silently reset on every serverless cold start / deploy.
 *
 * Overrides layer ON TOP of COUNTRY_DEFAULTS at read time. If the
 * AppSetting table is not migrated yet, hydration fails softly and the
 * behavior degrades to the old in-memory-only semantics.
 */

const PREFIX = "country:";
let hydration: Promise<void> | null = null;
const overrides = new Map<string, CountryConfig>();

async function hydrate(): Promise<void> {
  try {
    const rows = await db.appSetting.findMany({
      where: { key: { startsWith: PREFIX } },
    });
    for (const row of rows) {
      const country = decodeURIComponent(row.key.slice(PREFIX.length));
      try {
        overrides.set(country, JSON.parse(row.value) as CountryConfig);
      } catch {
        // Corrupt row — ignore, defaults still apply.
      }
    }
  } catch (error) {
    console.warn(
      "[country-overrides] AppSetting unavailable; overrides stay in-memory for this instance. Run 'npx prisma migrate deploy'. Cause:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function getEffectiveCountrySettings(): Promise<Record<string, CountryConfig>> {
  if (!hydration) {
    hydration = hydrate();
  }
  await hydration;
  return { ...COUNTRY_DEFAULTS, ...Object.fromEntries(overrides) };
}

export async function saveCountryOverride(
  country: string,
  settings: CountryConfig
): Promise<"db" | "memory"> {
  if (!hydration) {
    hydration = hydrate();
  }
  await hydration;
  overrides.set(country, settings);
  try {
    const key = PREFIX + encodeURIComponent(country);
    const value = JSON.stringify(settings);
    await db.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    return "db";
  } catch (error) {
    console.warn(
      "[country-overrides] Persist failed; override kept in-memory only. Cause:",
      error instanceof Error ? error.message : error
    );
    return "memory";
  }
}

/** Test hook: clears the per-process hydration state. */
export function resetForTests(): void {
  hydration = null;
  overrides.clear();
}
