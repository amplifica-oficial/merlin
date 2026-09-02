-- AlterTable
ALTER TABLE "emails" ADD COLUMN "failedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "emails_contactId_failedAt_idx" ON "emails"("contactId", "failedAt");
