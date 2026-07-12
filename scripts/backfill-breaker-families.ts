import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const db = new PrismaClient({ adapter });

function normalizeFamilyName(series: string): string {
  return series.replace(/(?<=[A-Z]{2,})\d+$/, "").trim();
}

async function main() {
  const rows = await db.equipmentCatalog.findMany();

  // Group by product family, stripping frame-size suffixes like
  // "ComPacT NSX160" -> "ComPacT NSX".
  const groups = new Map<string, { manufacturer: string; category: string; name: string }>();
  for (const row of rows) {
    const name = normalizeFamilyName(row.series);
    const key = `${row.manufacturer}|${row.category}|${name}`;
    if (!groups.has(key)) {
      groups.set(key, { manufacturer: row.manufacturer, category: row.category, name });
    }
  }

  for (const family of groups.values()) {
    await db.breakerFamily.upsert({
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
  }

  const families = await db.breakerFamily.findMany();
  const familyByKey = new Map(families.map((f) => [`${f.manufacturer}|${f.category}|${f.name}`, f.id]));

  for (const row of rows) {
    const name = normalizeFamilyName(row.series);
    const key = `${row.manufacturer}|${row.category}|${name}`;
    const familyId = familyByKey.get(key);
    if (familyId && !row.familyId) {
      await db.equipmentCatalog.update({ where: { id: row.id }, data: { familyId } });
    }
  }

  console.log(`Backfilled ${families.length} families for ${rows.length} catalog rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
