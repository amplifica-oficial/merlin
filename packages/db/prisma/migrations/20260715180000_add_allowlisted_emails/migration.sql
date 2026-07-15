-- CreateTable
CREATE TABLE "allowlisted_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowlisted_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowlisted_emails_email_key" ON "allowlisted_emails"("email");

-- AddForeignKey
ALTER TABLE "allowlisted_emails" ADD CONSTRAINT "allowlisted_emails_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
