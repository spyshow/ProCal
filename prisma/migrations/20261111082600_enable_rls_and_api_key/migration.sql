-- CreateTable ApiKey (idempotent if already created via db push)
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- Ensure screenshotUrl column exists on ProjectReviewItem
ALTER TABLE "ProjectReviewItem" ADD COLUMN IF NOT EXISTS "screenshotUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_userId_fkey') THEN
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Enable Row Level Security (RLS) on ApiKey and all public application tables
-- (Blocks direct PostgREST anon/authenticated access while Prisma's postgres role bypasses RLS)
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectReviewItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Building" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BuildingLoad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApartmentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApartmentRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoadLibraryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FloorDesign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FloorItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentCatalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BreakerFamily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BreakerSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;
