const { execSync } = require('child_process');
const { Pool } = require('pg');

async function ensureMigrationReady() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[pre-start] No DATABASE_URL found. Skipping migration prep.');
    return;
  }

  const isRemoteDb =
    connectionString.includes('supabase.co') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('neon.tech') ||
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
      console.log('[pre-start] Checking database schema & migrations...');
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
            DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL;
          END IF;
        END $$;

        -- Ensure User.theme and other potential schema columns exist
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "theme" TEXT DEFAULT 'dark';
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableSize" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableLength" DOUBLE PRECISION;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerInstallMethod" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableInsulation" TEXT;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerCableMaterial" TEXT DEFAULT 'copper';
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerAmbientTemp" DOUBLE PRECISION DEFAULT 30;
        ALTER TABLE "Building" ADD COLUMN IF NOT EXISTS "incomerGroupingCount" INTEGER DEFAULT 1;
      `);
      console.log('[pre-start] Schema verification and migration cleanup complete.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[pre-start] Warning while cleaning stalled migrations:', err.message);
  } finally {
    await pool.end().catch(() => {});
  }

  console.log('[pre-start] Running npx prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('[pre-start] Migrations deployed successfully.');
  } catch (err) {
    console.error('[pre-start] prisma migrate deploy failed:', err.message);
    process.exit(1);
  }

  // Ensure initial admin user and breaker catalog are seeded
  console.log('[pre-start] Ensuring initial seed data exists...');
  try {
    process.env.SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'password123';
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
    console.log('[pre-start] Seed check complete.');
  } catch (err) {
    console.warn('[pre-start] Seed notice (non-fatal):', err.message);
  }
}

ensureMigrationReady()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[pre-start] Unexpected error:', err);
    process.exit(1);
  });
