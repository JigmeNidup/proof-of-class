-- CreateEnum
CREATE TYPE "TrainerStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trainerPitch" TEXT,
ADD COLUMN     "trainerRequestedAt" TIMESTAMP(3),
ADD COLUMN     "trainerReviewNote" TEXT,
ADD COLUMN     "trainerReviewedAt" TIMESTAMP(3),
ADD COLUMN     "trainerReviewedBy" TEXT,
ADD COLUMN     "trainerStatus" "TrainerStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "User_trainerStatus_trainerRequestedAt_idx" ON "User"("trainerStatus", "trainerRequestedAt");

-- Grandfather anyone who was already a trainer before approval existed.
-- Without this they keep role = TRAINER but fail the new APPROVED check and
-- lose access to classrooms they already own.
UPDATE "User"
SET "trainerStatus" = 'APPROVED',
    "trainerReviewedAt" = NOW(),
    "trainerReviewNote" = 'Auto-approved: existed before the approval system'
WHERE "role" = 'TRAINER';
