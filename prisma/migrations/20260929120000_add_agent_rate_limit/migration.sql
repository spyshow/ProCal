-- Per-identity rate-limit windows for the agent (MCP) surface.
--
-- The export tools each launch a headless Chromium instance, so an unbounded
-- loop over procal_export_report_pdf or procal_export_drawings_pdf could
-- saturate the serverless function pool and the database at once. Nothing
-- bounded call frequency before this.
--
-- The window is stored here rather than in process memory because the endpoint
-- runs on Vercel, where each serverless instance has its own heap: an in-process
-- counter resets on every cold start and limits nothing.
--
-- `key` is "<bucket>:<identity>" (e.g. 'export:mcp_a1b2c3'), so one token cannot
-- spend another's budget and the tighter export budget is accounted separately
-- from ordinary tool calls.
--
-- Idempotent: safe to re-run.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRateLimit_pkey" PRIMARY KEY ("key")
);

-- Supports sweeping lapsed windows, which the read path never does inline.
CREATE INDEX IF NOT EXISTS "AgentRateLimit_windowStart_idx" ON "AgentRateLimit"("windowStart");
