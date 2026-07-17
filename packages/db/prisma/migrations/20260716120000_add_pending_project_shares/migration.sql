-- CreateTable
CREATE TABLE "pending_project_shares" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "addedById" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_project_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_project_shares_email_idx" ON "pending_project_shares"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pending_project_shares_email_projectId_key" ON "pending_project_shares"("email", "projectId");

-- AddForeignKey
ALTER TABLE "pending_project_shares" ADD CONSTRAINT "pending_project_shares_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_project_shares" ADD CONSTRAINT "pending_project_shares_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
