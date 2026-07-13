/**
 * One-off backfill: convert legacy Building.elevators/waterPumps/firePump/splitAc/centralAc
 * values into LoadLibraryItem rows (one per project+category) + BuildingLoad rows.
 *
 * Run once after the BuildingLoad table exists and BEFORE the 5 legacy columns are dropped:
 *   npx tsx prisma/scripts/backfill-building-loads.ts
 *
 * Idempotent-ish: skips a building that already has any BuildingLoad rows.
 */
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: "file:./dev.db" }),
});

// Legacy kW + library metadata per category. Matches the old hardcoded values in
// src/lib/calculations/feeders.ts (Elevator 22, Pump 7.5, Fire 15, Split AC 5, Central AC = centralAc kW).
type Cat = {
  key: string; // library item name + category
  category: string;
  power: number; // kW
  // quantity per building is read from the legacy column; for fire/central it's always 1
  fromColumn: "elevators" | "waterPumps" | "splitAc";
  isFlag?: boolean; // firePump
  isKwColumn?: boolean; // centralAc (already kW)
};

const CATEGORIES: Cat[] = [
  { key: "Elevator", category: "Elevator", power: 22, fromColumn: "elevators" },
  { key: "Water Pump", category: "Pump", power: 7.5, fromColumn: "waterPumps" },
  { key: "Split AC", category: "AC", power: 5, fromColumn: "splitAc" },
];

async function main() {
  // Buildings still carry the legacy columns at this point (db push added BuildingLoad
  // without dropping them). Query via $queryRaw to read columns the generated client
  // may no longer expose after the schema edit.
  const buildings = (await db.$queryRawUnsafe(`
    SELECT id, projectId, elevators, waterPumps, firePump, splitAc, centralAc
    FROM Building
  `)) as Array<{
    id: string;
    projectId: string;
    elevators: number;
    waterPumps: number;
    waterpumps: number;
    firePump: number;
    splitAc: number;
    centralAc: number;
  }>;

  // Cache: `${projectId}|${name}` -> library item id, so each project gets one item per category.
  const libCache = new Map<string, string>();
  let createdLib = 0;
  let createdLoads = 0;

  for (const b of buildings) {
    // Skip buildings that already have building loads (re-run safety).
    const existing = await db.buildingLoad.count({ where: { buildingId: b.id } });
    if (existing > 0) {
      console.log(`Building ${b.id}: skipped (already has ${existing} loads)`);
      continue;
    }

    const entries: { libId: string; quantity: number }[] = [];

    const ensureLib = async (name: string, category: string, power: number) => {
      const cacheKey = `${b.projectId}|${name}`;
      let libId = libCache.get(cacheKey);
      if (!libId) {
        const found = await db.loadLibraryItem.findFirst({
          where: { projectId: b.projectId, name, category },
        });
        if (found) {
          libId = found.id;
        } else {
          const created = await db.loadLibraryItem.create({
            data: {
              name,
              category,
              power,
              voltage: 400,
              phase: 3,
              powerFactor: 0.85,
              demandFactor: 1.0,
              quantity: 1,
              runningCurrent: 0,
              notes: "Backfilled from legacy building equipment",
              projectId: b.projectId,
            },
          });
          libId = created.id;
          createdLib++;
        }
        libCache.set(cacheKey, libId);
      }
      return libId;
    };

    for (const c of CATEGORIES) {
      const qty = (b as any)[c.fromColumn] as number;
      if (qty && qty > 0) {
        const libId = await ensureLib(c.key, c.category, c.power);
        entries.push({ libId, quantity: qty });
      }
    }

    // Fire pump: boolean flag -> 1 unit
    if (b.firePump) {
      const libId = await ensureLib("Fire Pump", "Pump", 15);
      entries.push({ libId, quantity: 1 });
    }

    // Central AC: centralAc column is already kW; create a dedicated library item
    // carrying that exact kW (category AC), quantity 1.
    if (b.centralAc && b.centralAc > 0) {
      const name = "Central AC";
      const cacheKey = `${b.projectId}|${name}`;
      let libId = libCache.get(cacheKey);
      if (!libId) {
        const found = await db.loadLibraryItem.findFirst({
          where: { projectId: b.projectId, name, category: "AC" },
        });
        libId = found?.id;
        if (!libId) {
          const created = await db.loadLibraryItem.create({
            data: {
              name,
              category: "AC",
              power: b.centralAc,
              voltage: 400,
              phase: 3,
              powerFactor: 0.85,
              demandFactor: 1.0,
              quantity: 1,
              runningCurrent: 0,
              notes: "Backfilled from legacy building.centralAc",
              projectId: b.projectId,
            },
          });
          libId = created.id;
          createdLib++;
        }
        if (libId) libCache.set(cacheKey, libId);
      }
      if (libId) entries.push({ libId, quantity: 1 });
    }

    for (const e of entries) {
      await db.buildingLoad.create({
        data: { buildingId: b.id, loadLibraryItemId: e.libId, quantity: e.quantity },
      });
      createdLoads++;
    }

    if (entries.length > 0) {
      console.log(`Building ${b.id}: attached ${entries.length} building load(s)`);
    } else {
      console.log(`Building ${b.id}: no legacy equipment to backfill`);
    }
  }

  console.log(`\nDone. Created ${createdLib} library item(s), ${createdLoads} building load(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
