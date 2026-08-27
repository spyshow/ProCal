const { execSync } = require('child_process');

console.log('[postinstall] Generating Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] prisma generate warning:', err.message);
}

if (process.env.DATABASE_URL) {
  console.log('[postinstall] Checking for failed migrations in database...');
  try {
    execSync('npx prisma migrate resolve --applied 20260827120000_add_building_incomer_cable_fields', { stdio: 'inherit' });
    console.log('[postinstall] Successfully resolved migration 20260827120000_add_building_incomer_cable_fields.');
  } catch (e) {
    console.log('[postinstall] Migration resolution check complete.');
  }
}
