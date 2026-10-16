-- CreateEnum
CREATE TYPE "LandingPageKind" AS ENUM ('PUCK', 'HTML');

-- AlterTable
ALTER TABLE "landing_pages" ADD COLUMN "kind" "LandingPageKind" NOT NULL DEFAULT 'PUCK';
