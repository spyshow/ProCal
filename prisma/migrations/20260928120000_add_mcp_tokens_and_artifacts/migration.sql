-- Personal Access Tokens for the MCP server, and storage for MCP-generated
-- binaries (report PDF, drawings PDF, Excel workbook).
--
-- Only SHA-256 token hashes are stored. The raw secret is shown to the user
-- exactly once at mint time and is not recoverable.
--
-- Idempotent: safe to run against a database where the tables already exist.

-- CreateTable
CREATE TABLE IF NOT EXISTS "McpToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "McpArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "McpToken_tokenHash_key" ON "McpToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "McpToken_userId_idx" ON "McpToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "McpArtifact_userId_idx" ON "McpArtifact"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "McpArtifact_expiresAt_idx" ON "McpArtifact"("expiresAt");

-- AddForeignKey
ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpArtifact" ADD CONSTRAINT "McpArtifact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
