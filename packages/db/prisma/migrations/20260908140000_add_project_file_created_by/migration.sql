-- AlterTable
ALTER TABLE "project_files" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "project_files_createdById_idx" ON "project_files"("createdById");

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
