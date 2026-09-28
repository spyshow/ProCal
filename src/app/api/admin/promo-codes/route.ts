import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * Admin CRUD for promotional codes — the "offer" half of free-credit grants.
 * Individual grants live in `PATCH /api/admin/users/[id]`.
 */

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, dash and underscore')
    .transform((s) => s.toUpperCase()),
  credits: z.number().int().min(1).max(1000),
  maxRedemptions: z.number().int().min(1).max(100000).default(1),
  description: z.string().trim().max(200).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const codes = await db.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({
      codes: codes.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error('GET /api/admin/promo-codes Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await db.promoCode.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json({ error: 'That code already exists' }, { status: 409 });
    }

    const code = await db.promoCode.create({
      data: {
        code: data.code,
        credits: data.credits,
        maxRedemptions: data.maxRedemptions,
        description: data.description ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    return NextResponse.json(
      { code: { ...code, createdAt: code.createdAt.toISOString() } },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/admin/promo-codes Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** Bulk grant: one action that credits several users at once. */
const bulkSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  credits: z.number().int().min(1).max(1000),
  note: z.string().trim().max(200).optional(),
});

export async function PATCH(request: Request) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const parsed = bulkSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { userIds, credits, note } = parsed.data;

    // Sequential rather than $transaction: a partial bulk grant is recoverable by
    // re-running, whereas one bad user id failing an all-or-nothing batch is not
    // something an admin can see or fix.
    const granted: string[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];
    for (const userId of userIds) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        skipped.push({ userId, reason: 'not found' });
        continue;
      }
      await db.$transaction([
        db.user.update({ where: { id: userId }, data: { credits: { increment: credits } } }),
        db.creditTransaction.create({
          data: {
            userId,
            delta: credits,
            reason: 'ADMIN_GRANT',
            actorId: gate.id,
            note: note ?? `Bulk grant of ${credits} credit${credits === 1 ? '' : 's'}`,
          },
        }),
      ]);
      granted.push(userId);
    }

    return NextResponse.json({ granted, skipped, creditsEach: credits });
  } catch (error) {
    console.error('PATCH /api/admin/promo-codes Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
