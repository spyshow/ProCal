import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

/**
 * The agent API is a genuinely external surface: it is authenticated with a
 * Personal Access Token rather than a session cookie, because the caller may be an
 * MCP client in another process or a third-party integration.
 *
 * That makes the ordering in `authenticateAgentRequest` the security property
 * worth testing. In particular the services deliberately do *not* authorise —
 * they assume the caller already did — so a route that skips step 3 is an
 * authorisation bypass, not a formality.
 */

const mocks = {
  resolveMcpActorWithToken: vi.fn(),
  verifyProjectAccessAsUser: vi.fn(),
  consumeRateLimit: vi.fn(),
};

vi.mock('@/lib/mcp-auth', () => ({
  resolveMcpActorWithToken: vi.fn(async (r: Request) => mocks.resolveMcpActorWithToken(r)),
}));

vi.mock('@/lib/project-auth', () => ({
  verifyProjectAccessAsUser: vi.fn(async (...a: unknown[]) => mocks.verifyProjectAccessAsUser(...a)),
}));

vi.mock('@/lib/services/rate-limit', () => ({
  consumeRateLimit: vi.fn(async (...a: unknown[]) => mocks.consumeRateLimit(...a)),
}));

const { authenticateAgentRequest, handleAgentRequest } = await import('./request');

const ACTOR = { id: 'u1', username: 'alice', name: 'Alice', role: 'USER', credits: 5, email: null };

function req(headers: Record<string, string> = { authorization: 'Bearer secret' }): Request {
  return new Request('http://localhost/api/agent/v1/projects', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveMcpActorWithToken.mockResolvedValue({ user: ACTOR, tokenId: 'tok-1' });
  mocks.consumeRateLimit.mockResolvedValue({ allowed: true, limit: 60, remaining: 59, retryAfterSeconds: 0 });
  mocks.verifyProjectAccessAsUser.mockResolvedValue({ user: ACTOR, member: {}, project: {} });
});

describe('authenticateAgentRequest', () => {
  it('rejects a request with no bearer token', async () => {
    mocks.resolveMcpActorWithToken.mockResolvedValue(null);

    const res = await authenticateAgentRequest(req({}), { path: '/projects' });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected rejection');
    expect(res.response.status).toBe(401);
    expect(res.response.headers.get('WWW-Authenticate')).toContain('procal-agent');
  });

  it('does not charge a rate limit for an unauthenticated request', async () => {
    // Otherwise an anonymous caller could exhaust a legitimate token's budget.
    mocks.resolveMcpActorWithToken.mockResolvedValue(null);

    await authenticateAgentRequest(req({}), { path: '/projects' });

    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
  });

  it('keys the rate limit on the token, not the user', async () => {
    await authenticateAgentRequest(req(), { path: '/projects' });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'tok-1' })
    );
  });

  it('charges export endpoints the tighter budget', async () => {
    await authenticateAgentRequest(req(), { path: '/projects/:projectId/export/report-pdf' });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'export' })
    );
  });

  it('refuses when over budget, with a Retry-After header', async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: false, limit: 6, remaining: 0, retryAfterSeconds: 42,
    });

    const res = await authenticateAgentRequest(req(), { path: '/projects' });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected rejection');
    expect(res.response.status).toBe(429);
    expect(res.response.headers.get('Retry-After')).toBe('42');
  });

  it('checks project access for a project-scoped route', async () => {
    await authenticateAgentRequest(req(), { path: '/projects/:projectId', projectId: 'p1' });
    expect(mocks.verifyProjectAccessAsUser).toHaveBeenCalledWith(
      ACTOR, 'p1', expect.objectContaining({ requiredAction: 'VIEW' })
    );
  });

  it('does not check project access on an unscoped route', async () => {
    await authenticateAgentRequest(req(), { path: '/projects' });
    expect(mocks.verifyProjectAccessAsUser).not.toHaveBeenCalled();
  });

  it('turns a denied project into a 403 with the service message', async () => {
    mocks.verifyProjectAccessAsUser.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: You are not a member of this project' }, { status: 403 })
    );

    const res = await authenticateAgentRequest(req(), { path: '/projects/:projectId', projectId: 'p1' });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected rejection');
    expect(res.response.status).toBe(403);
    const body = (await res.response.json()) as { error: string };
    expect(body.error).toMatch(/not a member/);
  });

  it('honours a stricter requiredAction for a write route', async () => {
    await authenticateAgentRequest(req(), {
      path: '/projects/:projectId/recalculate',
      projectId: 'p1',
      projectAccess: { requiredAction: 'EDIT' },
    });
    expect(mocks.verifyProjectAccessAsUser).toHaveBeenCalledWith(
      ACTOR, 'p1', expect.objectContaining({ requiredAction: 'EDIT' })
    );
  });
});

describe('handleAgentRequest', () => {
  it('returns the handler payload as JSON', async () => {
    const res = await handleAgentRequest(req(), { path: '/projects' }, async () => ({ ok: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: 1 });
  });

  it('turns a thrown 404 into a JSON 404, not an HTML crash', async () => {
    const res = await handleAgentRequest(req(), { path: '/projects' }, async () => {
      throw Object.assign(new Error('Project not found.'), { status: 404 });
    });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('not_found');
  });

  it('returns 500 and logs when the failure is unexpected', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handleAgentRequest(req(), { path: '/projects' }, async () => {
      throw new Error('kaboom');
    });
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('never runs the handler when authentication fails', async () => {
    mocks.resolveMcpActorWithToken.mockResolvedValue(null);
    const handler = vi.fn();

    await handleAgentRequest(req({}), { path: '/projects' }, handler);

    expect(handler).not.toHaveBeenCalled();
  });
});
