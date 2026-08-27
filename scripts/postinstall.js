const { execSync } = require('child_process');
const { Pool } = require('pg');

console.log('[postinstall] Generating Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] prisma generate warning:', err.message);
}

async function runDbPatch() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  console.log('[postinstall] Checking database schema & migrations...');
  const isRemoteDb =
    connectionString.includes('supabase.co') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('render.com') ||
    connectionString.includes('sslmode=') ||
    connectionString.includes('dpg-');

  const pool = new Pool({
    connectionString,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    try {
      console.log('[postinstall] Applying missing columns to Building table...');
      await client.query(`
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableSize" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableLength" DOUBLE PRECISION;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerInstallMethod" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableInsulation" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableMaterial" TEXT DEFAULT 'copper';
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerAmbientTemp" DOUBLE PRECISION DEFAULT 30;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerGroupingCount" INTEGER DEFAULT 1;

        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
            UPDATE "_prisma_migrations"
            SET "finished_at" = COALESCE("finished_at", NOW()),
                "applied_steps_count" = CASE WHEN "applied_steps_count" = 0 THEN 1 ELSE "applied_steps_count" END
            WHERE "migration_name" = '20260827120000_add_building_incomer_cable_fields' AND "finished_at" IS NULL;
          END IF;
        END $$;
      `);
      console.log('[postinstall] Database schema patch applied successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[postinstall] DB patch notice:', err.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

runDbPatch().then(() => {
  console.log('[postinstall] Done.');
});
