-- Free trial project (1 building, 2 levels, watermarked exports)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN NOT NULL DEFAULT false;

-- Existing users who already own a project are not new evaluators: no trial.
UPDATE "User" SET "hasUsedTrial" = true
WHERE EXISTS (SELECT 1 FROM "Project" p WHERE p."userId" = "User"."id");
