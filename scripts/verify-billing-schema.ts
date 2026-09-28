import 'dotenv/config';
import { db } from '../src/lib/db';
import { canStartProject, projectsStartedSince } from '../src/lib/billing/entitlement';

/**
 * Read-only smoke test of the MCP + billing schema against the REAL database.
 *
 * The unit tests mock `db`, so nothing has yet proven that these tables exist and
 * that the entitlement queries are valid Postgres. This checks both without
 * writing a single row: the gate and the counter are read-only by nature.
 *
 * Run after `npx prisma migrate deploy`:
 *   npx tsx scripts/verify-billing-schema.ts
 */

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  console.log('=== 1. tables exist ===');
  const tables = [
    'McpToken',
    'McpArtifact',
    'Subscription',
    'CreditTransaction',
    'PromoCode',
    'CheckoutIntent',
  ];
  const rows = await db.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      ${Prisma.join(tables)}
    )
  `;
  const found = new Set(rows.map((r) => r.table_name));
  for (const t of tables) check(`table ${t}`, found.has(t));

  console.log('\n=== 2. new columns present ===');
  const cols = await db.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Subscription'
      AND column_name IN ('currentPeriodStart', 'currentPeriodEnd', 'tier', 'status')
  `;
  const colSet = new Set(cols.map((c) => c.column_name));
  for (const c of ['currentPeriodStart', 'currentPeriodEnd', 'tier', 'status']) {
    check(`Subscription.${c}`, colSet.has(c));
  }

  console.log('\n=== 3. indexes present ===');
  const idx = await db.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'McpToken_tokenHash_key',
        'CheckoutIntent_stripeSessionId_key',
        'PromoCode_code_key',
        'Subscription_stripeSubscriptionId_key'
      )
  `;
  const idxSet = new Set(idx.map((i) => i.indexname));
  for (const i of [
    'McpToken_tokenHash_key',
    'CheckoutIntent_stripeSessionId_key',
    'PromoCode_code_key',
    'Subscription_stripeSubscriptionId_key',
  ]) {
    check(`index ${i}`, idxSet.has(i));
  }

  console.log('\n=== 4. entitlement queries run against real data ===');
  const users = await db.user.findMany({
    select: { id: true, username: true, role: true, credits: true, disabled: true },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  check('users readable', users.length > 0, `${users.length} sampled`);

  for (const u of users) {
    // The exact shape canStartProject issues internally.
    const gate = await canStartProject({
      id: u.id,
      role: u.role,
      credits: u.credits,
    });
    const counted = await projectsStartedSince(u.id, new Date(Date.now() - 30 * 864e5));
    console.log(
      `  · ${u.username} (${u.role}, ${u.credits} credits) → ${gate.allowed ? 'ALLOWED' : 'BLOCKED'}` +
        `${gate.reason ? ` via ${gate.reason}` : ''}` +
        `${gate.allowance ? ` ${gate.usedThisPeriod}/${gate.allowance} used` : ''}` +
        ` · 30d projects: ${counted}`
    );
    if (gate.reason === 'quota_exhausted') {
      check(
        `  ${u.username} quota message avoids "buy credits"`,
        !/buy credits/i.test(gate.message ?? '')
      );
    }
  }

  console.log('\n=== 5. quota arithmetic is sane ===');
  const probe = users[0];
  if (probe) {
    const all = await projectsStartedSince(probe.id, new Date(0));
    const last30 = await projectsStartedSince(probe.id, new Date(Date.now() - 30 * 864e5));
    check(
      'a shorter window never counts more than a longer one',
      last30 <= all,
      `30d=${last30} all=${all}`
    );
  }

  console.log(`\n${failures === 0 ? 'SCHEMA OK — no writes were made' : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
  process.exit(0);
}

import { Prisma } from '../src/generated/prisma/client';

main().catch((e) => {
  console.error('\nsmoke test error:', e);
  process.exit(1);
});
