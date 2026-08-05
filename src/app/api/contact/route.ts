import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendLeadNotification } from "@/lib/notify";
import { db } from "@/lib/db";

/**
 * GET /api/contact — does this user already have an OPEN lead?
 *
 * Backs the /billing button self-disable + notice (eng-review CQ-C, client side
 * of the one-OPEN-per-user loop). Same self-auth + exclusion posture as POST.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const open = await db.contactRequest.findFirst({
    where: { userId: user.id, status: "OPEN" },
    select: { id: true },
  });
  return NextResponse.json({ hasOpen: open != null });
}

/**
 * POST /api/contact — the captured-lead submit (Approach B).
 *
 * Self-auths (mirrors /api/projects/route.ts:31-34) and returns JSON 401 rather
 * than relying on the middleware redirect: /api/contact is excluded from the
 * matcher (src/middleware.ts) so an expired session yields JSON here, not the
 * 302→/login HTML that the matcher produces elsewhere — no silent-failure class.
 *
 * Branch A (eng-review D4): send-first-then-persist. The SMTP notification is
 * the HARD merge gate — an undelivered row is never created. If sendLeadNotification
 * resolves {ok:false} we return 502 and write nothing (the tested invariant T2).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Hand-rolled validation — matches the codebase's no-zod idiom (register,
  // admin/users). email is the submit-time snapshot stored on the row and used
  // as the SMTP Reply-To; pre-filled from user.email on /billing but editable
  // (so legacy users with null email can still submit a replyable address).
  const { email, message, requestedCredits } = body as {
    email?: string;
    message?: string;
    requestedCredits?: number;
  };

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "A message is required" }, { status: 400 });
  }
  const trimmedMessage = message.trim().slice(0, 4000);
  const creditsRequested =
    requestedCredits === undefined || requestedCredits === null
      ? null
      : Number.isInteger(requestedCredits) && requestedCredits > 0
        ? requestedCredits
        : null; // non-integer / non-positive ignored, not rejected — generous on an ask

  // CQ-C: one OPEN lead per user. findFirst by (userId, OPEN) — pure-Prisma, no
  // partial unique index (the eng-reviewed posture for portability).
  // ponytail: dedupe race — two concurrent POSTs can both pass this findFirst
  // (both see no OPEN row) and then both send + persist, producing two emails
  // and two OPEN rows. The nerve of this is low (a single user double-clicking)
  // and the dup-notification-on-retry ceiling is documented; a unique partial
  // index or a transaction with SELECT FOR UPDATE would close it but adds DB-
  // specific surface. Upgrade if a user ever spams the endpoint.
  const existing = await db.contactRequest.findFirst({
    where: { userId: user.id, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an open credit request. An admin will reach out." },
      { status: 409 }
    );
  }

  // Branch A: notify first. Only on success do we persist the lead ledger row.
  const sent = await sendLeadNotification({
    replyToEmail: email.trim(),
    name: user.name,
    username: user.username,
    message: trimmedMessage,
    requestedCredits: creditsRequested,
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: "Could not send your request right now. Please try again." },
      { status: 502 }
    );
  }

  await db.contactRequest.create({
    data: {
      userId: user.id,
      email: email.trim(),
      message: trimmedMessage,
      requestedCredits: creditsRequested,
      status: "OPEN",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
