import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { upsertBreakerFamilies, getFamilyKey } from "../src/lib/breaker-families";

const connectionString = process.env.DATABASE_URL;
const isRemoteDb =
  connectionString?.includes("supabase.co") ||
  connectionString?.includes("pooler.supabase.com") ||
  connectionString?.includes("sslmode=");

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create default engineer user
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await db.user.upsert({
    where: { username: "engineer" },
    update: {},
    create: {
      username: "engineer",
      name: "Lead Electrical Engineer",
      passwordHash,
      role: "ADMIN", // dev seed admin — gates /api/admin/* and the sidebar Admin button
    },
  });
  console.log("User seeded:", user.username);

  // 2. Equipment Catalog list
  const catalogData = [
    // --- ABB Air Circuit Breakers (ACB) ---
    {
      category: "ACB",
      manufacturer: "ABB",
      series: "Emax 2",
      model: "E1.2B 800",
      ratedCurrent: 800,
      poles: 3,
      breakingCapacity: 42,
      tripUnit: "Ekip Dip LSI",
      settingsJson: JSON.stringify({
        L: { range: "0.4..1.0xIn", delay: "3..144s" },
        S: { range: "0.6..10xIn", delay: "0.05..0.4s" },
        I: { range: "1.5..15xIn", delay: "Instant" },
        G: { range: "0.1..1.0xIn", delay: "0.1..0.8s" },
      }),
    },
    {
      category: "ACB",
      manufacturer: "ABB",
      series: "Emax 2",
      model: "E2.2B 1600",
      ratedCurrent: 1600,
      poles: 3,
      breakingCapacity: 42,
      tripUnit: "Ekip Touch LSI",
      settingsJson: JSON.stringify({
        L: { range: "0.4..1.0xIn", delay: "3..144s" },
        S: { range: "0.6..10xIn", delay: "0.05..0.4s" },
        I: { range: "1.5..15xIn", delay: "Instant" },
        G: { range: "0.1..1.0xIn", delay: "0.1..0.8s" },
      }),
    },
    {
      category: "ACB",
      manufacturer: "ABB",
      series: "Emax 2",
      model: "E2.2N 2000",
      ratedCurrent: 2000,
      poles: 3,
      breakingCapacity: 66,
      tripUnit: "Ekip Touch LSIG",
      settingsJson: JSON.stringify({
        L: { range: "0.4..1.0xIn", delay: "3..144s" },
        S: { range: "0.6..10xIn", delay: "0.05..0.4s" },
        I: { range: "1.5..15xIn", delay: "Instant" },
        G: { range: "0.1..1.0xIn", delay: "0.1..0.8s" },
      }),
    },

    // --- Schneider Air Circuit Breakers (ACB) ---
    {
      category: "ACB",
      manufacturer: "Schneider",
      series: "Masterpact MTZ1",
      model: "MTZ1 H1 1000",
      ratedCurrent: 1000,
      poles: 3,
      breakingCapacity: 42,
      tripUnit: "MicroLogic 5.0 X",
      settingsJson: JSON.stringify({
        L: { range: "0.4..1.0xIn", delay: "0.5..24s" },
        S: { range: "1.5..10xIr", delay: "0.05..0.4s" },
        I: { range: "2..15xIn", delay: "Instant" },
      }),
    },
    {
      category: "ACB",
      manufacturer: "Schneider",
      series: "Masterpact MTZ2",
      model: "MTZ2 H1 1600",
      ratedCurrent: 1600,
      poles: 3,
      breakingCapacity: 65,
      tripUnit: "MicroLogic 6.0 X",
      settingsJson: JSON.stringify({
        L: { range: "0.4..1.0xIn", delay: "0.5..24s" },
        S: { range: "1.5..10xIr", delay: "0.05..0.4s" },
        I: { range: "2..15xIn", delay: "Instant" },
        G: { range: "0.2..1.0xIn", delay: "0.1..0.4s" },
      }),
    },

    // --- ABB MCCBs (Tmax XT) ---
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT1", model: "XT1B 160 TMD 40A", ratedCurrent: 40, poles: 3, breakingCapacity: 18, tripUnit: "TMD (Thermal Magnetic)" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT1", model: "XT1N 160 TMD 63A", ratedCurrent: 63, poles: 3, breakingCapacity: 36, tripUnit: "TMD (Thermal Magnetic)" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT1", model: "XT1N 160 TMD 100A", ratedCurrent: 100, poles: 3, breakingCapacity: 36, tripUnit: "TMD (Thermal Magnetic)" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT2", model: "XT2N 160 Ekip LSI 160A", ratedCurrent: 160, poles: 3, breakingCapacity: 36, tripUnit: "Ekip LSI" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT3", model: "XT3N 250 TMD 200A", ratedCurrent: 200, poles: 3, breakingCapacity: 36, tripUnit: "TMD" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT4", model: "XT4N 250 Ekip LSI 250A", ratedCurrent: 250, poles: 3, breakingCapacity: 36, tripUnit: "Ekip LSI" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT5", model: "XT5N 400 Ekip LSI 400A", ratedCurrent: 400, poles: 3, breakingCapacity: 36, tripUnit: "Ekip LSI" },
    { category: "MCCB", manufacturer: "ABB", series: "Tmax XT7", model: "XT7S 630 Ekip LSI 630A", ratedCurrent: 630, poles: 3, breakingCapacity: 50, tripUnit: "Ekip LSI" },

    // --- Schneider MCCBs (ComPacT NSX) ---
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSXm", model: "NSXm 50A TM50D", ratedCurrent: 50, poles: 3, breakingCapacity: 25, tripUnit: "TM-D" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSXm", model: "NSXm 80A TM80D", ratedCurrent: 80, poles: 3, breakingCapacity: 25, tripUnit: "TM-D" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSX100", model: "NSX100N 100A TM100D", ratedCurrent: 100, poles: 3, breakingCapacity: 50, tripUnit: "TM-D" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSX160", model: "NSX160N 160A MicroLogic 2.2", ratedCurrent: 160, poles: 3, breakingCapacity: 50, tripUnit: "MicroLogic 2.2" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSX250", model: "NSX250N 250A MicroLogic 2.2", ratedCurrent: 250, poles: 3, breakingCapacity: 50, tripUnit: "MicroLogic 2.2" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSX400", model: "NSX400N 400A MicroLogic 2.3", ratedCurrent: 400, poles: 3, breakingCapacity: 50, tripUnit: "MicroLogic 2.3" },
    { category: "MCCB", manufacturer: "Schneider", series: "ComPacT NSX630", model: "NSX630N 630A MicroLogic 2.3", ratedCurrent: 630, poles: 3, breakingCapacity: 50, tripUnit: "MicroLogic 2.3" },

    // --- ABB MCBs (S200 Series) ---
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S201-C10 (1P)", ratedCurrent: 10, poles: 1, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S201-C16 (1P)", ratedCurrent: 16, poles: 1, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S201-C20 (1P)", ratedCurrent: 20, poles: 1, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S201-C32 (1P)", ratedCurrent: 32, poles: 1, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C10 (3P)", ratedCurrent: 10, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C16 (3P)", ratedCurrent: 16, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C20 (3P)", ratedCurrent: 20, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C25 (3P)", ratedCurrent: 25, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C32 (3P)", ratedCurrent: 32, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C40 (3P)", ratedCurrent: 40, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "ABB", series: "S200", model: "S203-C63 (3P)", ratedCurrent: 63, poles: 3, breakingCapacity: 6, tripUnit: "C-Curve" },

    // --- Schneider MCBs (Acti9 iC60) ---
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 1P 10A C", ratedCurrent: 10, poles: 1, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 1P 16A C", ratedCurrent: 16, poles: 1, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 1P 20A C", ratedCurrent: 20, poles: 1, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 1P 32A C", ratedCurrent: 32, poles: 1, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 10A C", ratedCurrent: 10, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 16A C", ratedCurrent: 16, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 20A C", ratedCurrent: 20, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 25A C", ratedCurrent: 25, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 32A C", ratedCurrent: 32, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 40A C", ratedCurrent: 40, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },
    { category: "MCB", manufacturer: "Schneider", series: "Acti9 iC60", model: "iC60N 3P 63A C", ratedCurrent: 63, poles: 3, breakingCapacity: 10, tripUnit: "C-Curve" },

    // --- Surge Protection Devices (SPD) ---
    { category: "SPD", manufacturer: "ABB", series: "OVR", model: "OVR T2 3P+N 40-275", ratedCurrent: 40, poles: 4, breakingCapacity: 40, tripUnit: "Type 2" },
    { category: "SPD", manufacturer: "Schneider", series: "Acti9 iPRD", model: "iPRD40 3P+N", ratedCurrent: 40, poles: 4, breakingCapacity: 40, tripUnit: "Type 2" },

    // --- Contactors ---
    { category: "CONTACTOR", manufacturer: "ABB", series: "AF", model: "AF09-30-10", ratedCurrent: 9, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "ABB", series: "AF", model: "AF16-30-10", ratedCurrent: 16, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "ABB", series: "AF", model: "AF30-30-00", ratedCurrent: 30, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "ABB", series: "AF", model: "AF80-30-00", ratedCurrent: 80, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "Schneider", series: "TeSys D", model: "LC1D09P7", ratedCurrent: 9, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "Schneider", series: "TeSys D", model: "LC1D18P7", ratedCurrent: 18, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "Schneider", series: "TeSys D", model: "LC1D32P7", ratedCurrent: 32, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },
    { category: "CONTACTOR", manufacturer: "Schneider", series: "TeSys D", model: "LC1D80P7", ratedCurrent: 80, poles: 3, breakingCapacity: 0, tripUnit: "230V Coil" },

    // --- Power Meters ---
    { category: "METER", manufacturer: "ABB", series: "M4M", model: "M4M 20 Modbus", ratedCurrent: 5, poles: 3, breakingCapacity: 0, tripUnit: "Class 0.5S" },
    { category: "METER", manufacturer: "ABB", series: "M4M", model: "M4M 30 Ethernet", ratedCurrent: 5, poles: 3, breakingCapacity: 0, tripUnit: "Class 0.5S" },
    { category: "METER", manufacturer: "Schneider", series: "PowerLogic", model: "PM5110", ratedCurrent: 5, poles: 3, breakingCapacity: 0, tripUnit: "Class 0.5S" },
    { category: "METER", manufacturer: "Schneider", series: "PowerLogic", model: "PM5560", ratedCurrent: 5, poles: 3, breakingCapacity: 0, tripUnit: "Class 0.2S" },
  ];

  const familyKeys = catalogData.map((item) => ({
    manufacturer: item.manufacturer,
    category: item.category,
    series: item.series,
  }));
  const familyIdByKey = await upsertBreakerFamilies(db, familyKeys);

  for (const item of catalogData) {
    const familyId = familyIdByKey.get(getFamilyKey(item.manufacturer, item.category, item.series));
    // upsert on catalogUniqueKey (manufacturer, category, series, model, ratedCurrent, poles)
    // so re-running migrate dev / db seed doesn't duplicate the catalog rows.
    await db.equipmentCatalog.upsert({
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
  }

  console.log(`Seeded ${familyIdByKey.size} breaker families.`);
  console.log(`Seeded ${catalogData.length} equipment items.`);
  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
