-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRAINER', 'TRAINEE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PointCategory" AS ENUM ('CLASS', 'PROJECT', 'PUBLIC_VOTE');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRAINEE',
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenAddress" TEXT,
    "tokenSymbol" TEXT,
    "tokenDecimals" INTEGER NOT NULL DEFAULT 18,
    "badgeAddress" TEXT,
    "chainId" INTEGER NOT NULL,
    "deployedBlock" BIGINT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMembership" (
    "id" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "ClassMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLog" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "receiverWallet" TEXT NOT NULL,
    "awardedById" TEXT,
    "points" INTEGER NOT NULL,
    "amountWei" DECIMAL(78,0) NOT NULL,
    "category" "PointCategory" NOT NULL,
    "note" TEXT,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "logIndex" INTEGER,
    "blockNumber" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "PointLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAward" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "badgeType" "BadgeType" NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "periodKey" TEXT NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "logIndex" INTEGER,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickCall" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctOptionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "QuickCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickCallResponse" (
    "id" TEXT NOT NULL,
    "quickCallId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT,
    "clientClickAt" TIMESTAMP(3),
    "serverReceivedAt" TIMESTAMP(3) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "rank" INTEGER,
    "isCorrect" BOOLEAN,

    CONSTRAINT "QuickCallResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");

-- CreateIndex
CREATE INDEX "Classroom_creatorId_idx" ON "Classroom"("creatorId");

-- CreateIndex
CREATE INDEX "Classroom_tokenAddress_idx" ON "Classroom"("tokenAddress");

-- CreateIndex
CREATE INDEX "ClassMembership_classroomId_status_idx" ON "ClassMembership"("classroomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassMembership_userId_classroomId_key" ON "ClassMembership"("userId", "classroomId");

-- CreateIndex
CREATE INDEX "PointLog_classroomId_status_createdAt_idx" ON "PointLog"("classroomId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PointLog_receiverId_createdAt_idx" ON "PointLog"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLog_classroomId_category_idx" ON "PointLog"("classroomId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PointLog_txHash_logIndex_key" ON "PointLog"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "BadgeAward_userId_badgeType_idx" ON "BadgeAward"("userId", "badgeType");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAward_classroomId_badgeType_periodKey_key" ON "BadgeAward"("classroomId", "badgeType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAward_txHash_logIndex_key" ON "BadgeAward"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "QuickCall_classroomId_startedAt_idx" ON "QuickCall"("classroomId", "startedAt");

-- CreateIndex
CREATE INDEX "QuickCallResponse_quickCallId_latencyMs_idx" ON "QuickCallResponse"("quickCallId", "latencyMs");

-- CreateIndex
CREATE UNIQUE INDEX "QuickCallResponse_quickCallId_userId_key" ON "QuickCallResponse"("quickCallId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerCursor_chainId_contractAddress_key" ON "IndexerCursor"("chainId", "contractAddress");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMembership" ADD CONSTRAINT "ClassMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMembership" ADD CONSTRAINT "ClassMembership_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMembership" ADD CONSTRAINT "ClassMembership_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCall" ADD CONSTRAINT "QuickCall_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCall" ADD CONSTRAINT "QuickCall_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCallResponse" ADD CONSTRAINT "QuickCallResponse_quickCallId_fkey" FOREIGN KEY ("quickCallId") REFERENCES "QuickCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCallResponse" ADD CONSTRAINT "QuickCallResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

