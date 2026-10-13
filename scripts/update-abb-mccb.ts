import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { upsertBreakerFamilies, getFamilyKey } from "../src/lib/breaker-families";
import { resolveDatabaseSsl } from "../src/lib/db-ssl";
import { abbTmaxXtCatalog, abbTmaxXtLegacyModels } from "../prisma/data/abb-tmax-xt";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: resolveDatabaseSsl(connectionString),
  max: 10,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log(`Starting idempotent ABB Tmax XT catalog update...`);
  console.log(`Total ABB MCCB models to sync: ${abbTmaxXtCatalog.length}`);

  // 1. Ensure BreakerFamily exists for ABB MCCB Tmax XT
  const familyKeys = abbTmaxXtCatalog.map((item) => ({
    manufacturer: item.manufacturer,
    category: item.category,
    series: item.series,
  }));
  const familyIdByKey = await upsertBreakerFamilies(db, familyKeys);
  console.log(`Synced ${familyIdByKey.size} breaker family entries.`);

  // 2. Remove legacy renamed models if any exist
  if (abbTmaxXtLegacyModels.length > 0) {
    const deleted = await db.equipmentCatalog.deleteMany({
      where: {
        OR: abbTmaxXtLegacyModels.map((m) => ({
          manufacturer: "ABB",
          series: m.series,
          model: m.model,
        })),
      },
    });
    if (deleted.count > 0) {
      console.log(`Cleaned up ${deleted.count} legacy renamed models.`);
    }
  }

  // 3. Upsert models in batches of 15
  const batchSize = 15;
  let processed = 0;

  for (let i = 0; i < abbTmaxXtCatalog.length; i += batchSize) {
    const chunk = abbTmaxXtCatalog.slice(i, i + batchSize);
    await Promise.all(
      chunk.map((item) => {
        const familyId = familyIdByKey.get(
          getFamilyKey(item.manufacturer, item.category, item.series)
        );
        return db.equipmentCatalog.upsert({
          where: {
            catalogUniqueKey: {
              manufacturer: item.manufacturer,
              category: item.category,
              series: item.series,
              model: item.model,
              ratedCurrent: item.ratedCurrent,
              poles: item.poles,
            },
          },
          update: { ...item, familyId },
          create: { ...item, familyId },
        });
      })
    );
    processed += chunk.length;
    if (processed % 60 === 0 || processed === abbTmaxXtCatalog.length) {
      console.log(`Synced ${processed}/${abbTmaxXtCatalog.length} models...`);
    }
  }

  console.log(`Successfully updated ${abbTmaxXtCatalog.length} ABB Tmax XT MCCB models in the database.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
