import { createHmac, timingSafeEqual } from 'node:crypto';
import { getJwtSecret } from '@/lib/env';

/**
 * Single-use, short-lived tickets for the headless print route.
 *
 * The report schedules are client components (they own the "Show Your Work"
 * trace popover and the equipment fetch), so they cannot be server-rendered to a
 * string — Next's RSC transform turns a `'use client'` import into a client
 * reference and `renderToStaticMarkup` throws. Commit 0b483e0 hit this and fixed
 * it by having the browser POST its rendered DOM; that works for the UI but an MCP
 * client has no browser.
 *
 * So the PDF path drives a real browser instead: headless Chromium loads
 * `/print/report`, which renders the *same* components client-side, and we lift
 * the DOM out of it. A ticket is how that page authenticates, because Chromium is
 * a fresh process with no session cookie.
 *
 * The ticket is deliberately narrow: one project, one user, a two-minute life, and
 * a signature over the whole payload. It is not a credential — it grants nothing
 * on its own, and only lets its bearer read one project's report for two minutes.
 */

const TICKET_TTL_SECONDS = 120;

export interface PrintTicketPayload {
  /** Project to render. */
  projectId: string;
  /** User the report is being rendered for; re-checked against project access. */
  userId: string;
  /** Optional single-building report. */
  buildingId?: string;
  /** Optional manufacturer override for breaker lookup. */
  manufacturer?: string;
  /** Issued-at, seconds. */
  iat: number;
  /** Expiry, seconds. */
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getJwtSecret()).update(payloadB64).digest('base64url');
}

export function createPrintTicket(input: {
  projectId: string;
  userId: string;
  buildingId?: string;
  manufacturer?: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PrintTicketPayload = {
    projectId: input.projectId,
    userId: input.userId,
    ...(input.buildingId ? { buildingId: input.buildingId } : {}),
    ...(input.manufacturer ? { manufacturer: input.manufacturer } : {}),
    iat: now,
    exp: now + (input.ttlSeconds ?? TICKET_TTL_SECONDS),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify a ticket's signature and expiry.
 *
 * Returns null on any failure — bad shape, bad signature, or expired — so callers
 * only need one null check. Never throws, and never reveals which check failed.
 */
export function verifyPrintTicket(ticket: string | null | undefined): PrintTicketPayload | null {
  if (!ticket) return null;

  const dot = ticket.lastIndexOf('.');
  if (dot <= 0) return null;

  const payloadB64 = ticket.slice(0, dot);
  const providedSig = ticket.slice(dot + 1);
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = sign(payloadB64);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: PrintTicketPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as PrintTicketPayload;
  } catch {
    return null;
  }

  if (!payload?.projectId || !payload?.userId || !payload?.exp) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;

  return payload;
}
