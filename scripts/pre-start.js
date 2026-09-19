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
      console.log('[pre-start] Checking for stalled/failed migrations in _prisma_migrations...');
      const res = await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
            DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL;
          END IF;
        END $$;
      `);
      console.log('[pre-start] Stalled migrations cleaned up successfully.');
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
}

ensureMigrationReady()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[pre-start] Unexpected error:', err);
    process.exit(1);
  });
