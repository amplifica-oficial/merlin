-- CreateEnum
CREATE TYPE "ProjectFileKind" AS ENUM ('FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "ProjectFileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "ProjectFileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "status" "ProjectFileStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_files_projectId_parentId_kind_name_idx" ON "project_files"("projectId", "parentId", "kind", "name");

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "project_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
