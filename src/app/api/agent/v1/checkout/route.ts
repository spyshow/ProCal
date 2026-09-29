import { handleAgentRequest } from '@/lib/agent/request';
import { canStartProject } from '@/lib/billing/entitlement';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/v1/checkout — report whether the account can start a project.
 *
 * Starts a Stripe Checkout only when the account is on neither a subscription nor
 * a credit balance. Stripe checkout itself is a redirect to a hosted page and
 * keeps its session semantics, so this reports entitlement rather than minting a
 * session: a client that needs to pay sends the user to /billing.
 */
export async function POST(request: Request) {
  return handleAgentRequest(request, { path: '/checkout' }, async ({ user }) => {
    const entitlement = await canStartProject(user);

    if (entitlement.allowed) {
      return {
        canStartProject: true,
        alreadyEntitled: true,
        tier: entitlement.tier,
        remaining: entitlement.remaining,
        allowance: entitlement.allowance,
      };
    }

    return {
      canStartProject: false,
      alreadyEntitled: false,
      reason: entitlement.reason ?? 'payment_required',
      // Quota exhaustion is not a payment problem: the account already pays.
      // Telling that caller to buy credits would be wrong.
      checkoutUrl: entitlement.reason === 'quota_exhausted' ? null : '/billing',
      message:
        entitlement.reason === 'quota_exhausted'
          ? 'This plan has used its project allowance for the period. Existing projects remain fully accessible.'
          : 'This account has no project capacity. Complete a purchase on /billing, then retry the same request.',
    };
  });
}
