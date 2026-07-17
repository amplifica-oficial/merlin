-- AlterTable
ALTER TABLE "pending_project_shares" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill existing rows with createdAt + 30 days
UPDATE "pending_project_shares"
SET "expiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "expiresAt" IS NULL;

-- CreateIndex
CREATE INDEX "pending_project_shares_expiresAt_idx" ON "pending_project_shares"("expiresAt");
