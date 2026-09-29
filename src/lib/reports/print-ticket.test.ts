import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPrintTicket, verifyPrintTicket } from './print-ticket';

/**
 * The print ticket is the only thing letting headless Chromium — which has no
 * session cookie — read a project report. It is a security boundary, so these
 * tests cover forgery, tampering, and expiry, not just the happy path.
 */
describe('print tickets', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-print-tickets';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('round-trips the payload it was given', () => {
    const ticket = createPrintTicket({ projectId: 'p1', userId: 'u1' });
    const payload = verifyPrintTicket(ticket);

    expect(payload).not.toBeNull();
    expect(payload?.projectId).toBe('p1');
    expect(payload?.userId).toBe('u1');
  });

  it('preserves the optional building and manufacturer', () => {
    const ticket = createPrintTicket({
      projectId: 'p1',
      userId: 'u1',
      buildingId: 'b1',
      manufacturer: 'Schneider',
    });
    const payload = verifyPrintTicket(ticket);

    expect(payload?.buildingId).toBe('b1');
    expect(payload?.manufacturer).toBe('Schneider');
  });

  it('rejects a tampered payload', () => {
    // Re-sign nothing: swap the projectId but keep the original signature.
    const ticket = createPrintTicket({ projectId: 'p1', userId: 'u1' });
    const [payloadB64, sig] = ticket.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payloadB64, 'base64url').toString()), projectId: 'p2' })
    ).toString('base64url');

    expect(verifyPrintTicket(`${forged}.${sig}`)).toBeNull();
    expect(verifyPrintTicket(ticket)).not.toBeNull();
  });

  it('rejects a ticket signed with a different secret', () => {
    const ticket = createPrintTicket({ projectId: 'p1', userId: 'u1' });
    process.env.JWT_SECRET = 'a-completely-different-secret';
    expect(verifyPrintTicket(ticket)).toBeNull();
  });

  it('rejects an expired ticket', () => {
    const ticket = createPrintTicket({ projectId: 'p1', userId: 'u1', ttlSeconds: -1 });
    expect(verifyPrintTicket(ticket)).toBeNull();
  });

  it('rejects malformed input rather than throwing', () => {
    expect(verifyPrintTicket(null)).toBeNull();
    expect(verifyPrintTicket(undefined)).toBeNull();
    expect(verifyPrintTicket('')).toBeNull();
    expect(verifyPrintTicket('no-dot-here')).toBeNull();
    expect(verifyPrintTicket('.onlysig')).toBeNull();
    expect(verifyPrintTicket('onlypayload.')).toBeNull();
    expect(verifyPrintTicket('!!!.???')).toBeNull();
    // Valid base64url, valid signature length, but not JSON.
    expect(verifyPrintTicket('aGVsbG8.dC1hYmM')).toBeNull();
  });

  it('defaults to a two-minute life', () => {
    const payload = verifyPrintTicket(createPrintTicket({ projectId: 'p1', userId: 'u1' }));
    expect(payload).not.toBeNull();
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(120);
  });
});
