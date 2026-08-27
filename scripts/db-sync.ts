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
      // ProjectRevision table (issued engineering revisions with JSON snapshots)
      `CREATE TABLE IF NOT EXISTS "ProjectRevision" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "rev" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "createdById" TEXT NOT NULL,
        "snapshotJson" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProjectRevision_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE INDEX IF NOT EXISTS "ProjectRevision_projectId_idx" ON "ProjectRevision"("projectId");`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRevision_projectId_fkey') THEN
          ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRevision_createdById_fkey') THEN
          ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;`,

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
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableMaterial" TEXT DEFAULT 'copper';`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserCableSize" TEXT;`,

      // FloorItem columns
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "installMethod" TEXT DEFAULT 'C';`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableInsulation" TEXT DEFAULT 'XLPE';`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableMaterial" TEXT DEFAULT 'copper';`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "voltageDrop" DOUBLE PRECISION;`,
      `ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "assignedPhase" INTEGER;`,

      // BuildingLoad columns
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "installMethod" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableInsulation" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableMaterial" TEXT DEFAULT 'copper';`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableSize" TEXT;`,
      `ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "assignedPhase" INTEGER;`,

      // Building columns
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "earthingSystem" TEXT DEFAULT 'TN-S';`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "lightningProtection" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "supplyVoltage" TEXT DEFAULT '400V 3-Phase';`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableSize" TEXT;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableLength" DOUBLE PRECISION;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerInstallMethod" TEXT;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableInsulation" TEXT;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableMaterial" TEXT DEFAULT 'copper';`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerAmbientTemp" DOUBLE PRECISION DEFAULT 30;`,
      `ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerGroupingCount" INTEGER DEFAULT 1;`,

      // Fix any failed migration records in _prisma_migrations
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
          UPDATE "_prisma_migrations"
          SET "finished_at" = COALESCE("finished_at", NOW()),
              "applied_steps_count" = CASE WHEN "applied_steps_count" = 0 THEN 1 ELSE "applied_steps_count" END
          WHERE "migration_name" = '20260827120000_add_building_incomer_cable_fields' AND "finished_at" IS NULL;
        END IF;
      END $$;`,
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
