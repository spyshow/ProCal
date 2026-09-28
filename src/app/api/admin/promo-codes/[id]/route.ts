import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * Disable or delete one promo code.
 *
 * Delete is hard; `DELETE /api/admin/promo-codes` with `?mode=disable` is the soft
 * path. A hard delete would leave `CreditTransaction.promoCodeId` dangling —
 * harmless thanks to ON DELETE SET NULL, but the ledger loses the link back to
 * which offer a credit came from.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const active = typeof body.active === 'boolean' ? body.active : null;
    if (active === null) {
      return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
    }

    const code = await db.promoCode.update({
      where: { id },
      data: { active },
    });
    return NextResponse.json({ code: { ...code, createdAt: code.createdAt.toISOString() } });
  } catch (error) {
    console.error('PATCH /api/admin/promo-codes/[id] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;

    const { id } = await params;
    const mode = new URL(request.url).searchParams.get('mode') ?? 'delete';

    if (mode === 'disable') {
      const code = await db.promoCode.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ disabled: code.code });
    }

    const existing = await db.promoCode.findUnique({ where: { id }, select: { redemptions: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    if (existing.redemptions > 0) {
      return NextResponse.json(
        {
          error:
            'This code has already been redeemed. Disable it instead so the credit ledger keeps its link.',
          hint: 'DELETE ?mode=disable',
        },
        { status: 409 }
      );
    }

    await db.promoCode.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/admin/promo-codes/[id] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
