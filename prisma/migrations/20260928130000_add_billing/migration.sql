-- Billing: subscriptions, an auditable credit ledger, promotional codes, and
-- in-flight checkout intents.
--
-- Pairs with 20260928120000_add_mcp_tokens_and_artifacts.
-- Idempotent: safe to re-run.
--
-- `Subscription.currentPeriodStart` is what bounds the per-period project
-- allowance (1 / 5 / 15 by tier). Without it the gate would have to guess the
-- period boundary from currentPeriodEnd, which drifts on anniversary billing.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "maxRedemptions" INTEGER NOT NULL,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "promoCodeId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckoutIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tier" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "specJson" TEXT,
    "projectId" TEXT,
    "stripeSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key"
    ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_active_idx" ON "PromoCode"("active");

CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_stripeSessionId_idx"
    ON "CreditTransaction"("stripeSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutIntent_stripeSessionId_key"
    ON "CheckoutIntent"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "CheckoutIntent_userId_idx" ON "CheckoutIntent"("userId");
CREATE INDEX IF NOT EXISTS "CheckoutIntent_status_idx" ON "CheckoutIntent"("status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- creditTransactions.promoCodeId -> PromoCode, set null on delete so revoking a
-- code never destroys the ledger rows that reference it.
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
