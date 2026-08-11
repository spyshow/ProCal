import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://procal:procal@localhost:5432/procal';

const isRemoteDb =
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('sslmode=');

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database...');

    const statements = [
      // Project columns
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "maxVoltageDropLighting" DOUBLE PRECISION DEFAULT 3;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "maxVoltageDropPower" DOUBLE PRECISION DEFAULT 5;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "calculationStandard" TEXT DEFAULT 'IEC';`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "defaultAcbFamilyId" TEXT;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "defaultMccbFamilyId" TEXT;`,
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "defaultMcbFamilyId" TEXT;`,

      // FloorDesign columns
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserBreakerSize" TEXT;`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserAmbientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserGroupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserInstallMethod" TEXT DEFAULT 'C';`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableInsulation" TEXT DEFAULT 'XLPE';`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableSize" TEXT;`,

      // FloorItem columns
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "installMethod" TEXT DEFAULT 'C';`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableInsulation" TEXT DEFAULT 'XLPE';`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "voltageDrop" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "assignedPhase" INTEGER;`,

      // BuildingLoad columns
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "installMethod" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableInsulation" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableSize" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "assignedPhase" INTEGER;`,

      // Building columns
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "earthingSystem" TEXT DEFAULT 'TN-S';`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lightningProtection" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "supplyVoltage" TEXT DEFAULT '400V 3-Phase';`,
    ];

    for (const sql of statements) {
      console.log(`Executing: ${sql}`);
      await client.query(sql);
    }

    console.log('✅ Database schema synchronized successfully!');
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
