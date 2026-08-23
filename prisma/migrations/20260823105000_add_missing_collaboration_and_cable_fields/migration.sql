-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30,
ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;

-- AlterTable BuildingLoad
ALTER TABLE "BuildingLoad" ADD COLUMN IF NOT EXISTS "cableMaterial" TEXT DEFAULT 'copper',
ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30,
ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;

-- AlterTable FloorDesign
ALTER TABLE "FloorDesign" ADD COLUMN IF NOT EXISTS "riserBreakerSize" TEXT,
ADD COLUMN IF NOT EXISTS "riserCableMaterial" TEXT DEFAULT 'copper',
ADD COLUMN IF NOT EXISTS "riserAmbientTemp" DOUBLE PRECISION DEFAULT 30,
ADD COLUMN IF NOT EXISTS "riserGroupingCount" INTEGER DEFAULT 1;

-- AlterTable FloorItem
ALTER TABLE "FloorItem" ADD COLUMN IF NOT EXISTS "cableMaterial" TEXT DEFAULT 'copper',
ADD COLUMN IF NOT EXISTS "ambientTemp" DOUBLE PRECISION DEFAULT 30,
ADD COLUMN IF NOT EXISTS "groupingCount" INTEGER DEFAULT 1;

-- CreateTable ProjectMember
CREATE TABLE IF NOT EXISTS "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "permissions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectInvite
CREATE TABLE IF NOT EXISTS "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "permissions" TEXT,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectAuditLog
CREATE TABLE IF NOT EXISTS "ProjectAuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectReviewItem
CREATE TABLE IF NOT EXISTS "ProjectReviewItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectRevision
CREATE TABLE IF NOT EXISTS "ProjectRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rev" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectInvite_token_key" ON "ProjectInvite"("token");
CREATE INDEX IF NOT EXISTS "ProjectInvite_projectId_idx" ON "ProjectInvite"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectInvite_token_idx" ON "ProjectInvite"("token");
CREATE INDEX IF NOT EXISTS "ProjectInvite_email_idx" ON "ProjectInvite"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectAuditLog_projectId_createdAt_idx" ON "ProjectAuditLog"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectAuditLog_projectId_entityType_idx" ON "ProjectAuditLog"("projectId", "entityType");
CREATE INDEX IF NOT EXISTS "ProjectAuditLog_projectId_userId_idx" ON "ProjectAuditLog"("projectId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectReviewItem_projectId_status_idx" ON "ProjectReviewItem"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectRevision_projectId_idx" ON "ProjectRevision"("projectId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_projectId_fkey') THEN
        ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_userId_fkey') THEN
        ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectInvite_projectId_fkey') THEN
        ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectInvite_invitedById_fkey') THEN
        ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAuditLog_projectId_fkey') THEN
        ALTER TABLE "ProjectAuditLog" ADD CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAuditLog_userId_fkey') THEN
        ALTER TABLE "ProjectAuditLog" ADD CONSTRAINT "ProjectAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectReviewItem_projectId_fkey') THEN
        ALTER TABLE "ProjectReviewItem" ADD CONSTRAINT "ProjectReviewItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectReviewItem_createdById_fkey') THEN
        ALTER TABLE "ProjectReviewItem" ADD CONSTRAINT "ProjectReviewItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRevision_projectId_fkey') THEN
        ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRevision_createdById_fkey') THEN
        ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
