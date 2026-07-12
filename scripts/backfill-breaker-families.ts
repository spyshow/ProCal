import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { upsertBreakerFamilies, getFamilyKey } from "../src/lib/breaker-families";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const rows = await db.equipmentCatalog.findMany();
  const familyKeys = rows.map((row) => ({
    manufacturer: row.manufacturer,
    category: row.category,
    series: row.series,
  }));
  const familyByKey = await upsertBreakerFamilies(db, familyKeys);

  for (const row of rows) {
    const familyId = familyByKey.get(getFamilyKey(row.manufacturer, row.category, row.series));
    if (familyId && !row.familyId) {
      await db.equipmentCatalog.update({ where: { id: row.id }, data: { familyId } });
    }
  }

  console.log(`Backfilled ${familyByKey.size} families for ${rows.length} catalog rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
